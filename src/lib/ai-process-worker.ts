import { prisma, getTenantPrisma } from './db';
import { decryptJSON } from './encryption';
import { getConnector } from './connectors/manager';
import { generateEmbedding, analyzeLeadMessage } from './ai';

/**
 * Main worker entry point to process an ingested webhook log.
 * Updates the WebhookEventLog row with its execution state and logs errors for retries.
 */
export async function processWebhookEvent(webhookEventId: string): Promise<void> {
  const logEntry = await prisma.webhookEventLog.findUnique({
    where: { id: webhookEventId },
    include: { connector: true },
  });

  if (!logEntry) {
    throw new Error(`WebhookEventLog row not found: ${webhookEventId}`);
  }

  if (!logEntry.connector) {
    await prisma.webhookEventLog.update({
      where: { id: webhookEventId },
      data: {
        status: 'failed',
        errorLog: 'No connector associated with this log entry.',
      },
    });
    return;
  }

  // Update status to processing
  await prisma.webhookEventLog.update({
    where: { id: webhookEventId },
    data: { status: 'processing' },
  });

  try {
    const connector = getConnector(logEntry.platform);
    
    // Decrypt credentials
    const credentials = decryptJSON(logEntry.connector.encryptedCredentials);
    
    const config = {
      connectorId: logEntry.connector.id,
      tenantId: logEntry.connector.tenantId,
      platform: logEntry.connector.platform,
      credentials,
      config: logEntry.connector.config as Record<string, any>,
    };

    // 1. Map webhook payload to unified format
    const webhookResult = await connector.handleWebhook(logEntry.payload, config);
    
    // 2. Associate tenant and connector identifiers back to the log entry for auditing
    await prisma.webhookEventLog.update({
      where: { id: webhookEventId },
      data: {
        tenantId: webhookResult.tenantId,
        connectorId: logEntry.connector.id,
      },
    });

    const tenantPrisma = getTenantPrisma(webhookResult.tenantId);

    // 3. Find or create the Lead
    let lead = await tenantPrisma.lead.findFirst({
      where: {
        sourcePlatform: logEntry.platform,
        sourceLeadId: webhookResult.leadExternalId,
      },
    });

    if (!lead) {
      // Check duplicate fallback via phone or email
      if (webhookResult.leadData.phone) {
        lead = await tenantPrisma.lead.findFirst({
          where: { contactPhone: webhookResult.leadData.phone },
        });
      }
      if (!lead && webhookResult.leadData.email) {
        lead = await tenantPrisma.lead.findFirst({
          where: { contactEmail: webhookResult.leadData.email },
        });
      }
    }

    if (!lead) {
      lead = await tenantPrisma.lead.create({
        data: {
          tenantId: webhookResult.tenantId,
          sourcePlatform: logEntry.platform,
          sourceLeadId: webhookResult.leadExternalId,
          contactName: webhookResult.leadData.name,
          contactPhone: webhookResult.leadData.phone,
          contactEmail: webhookResult.leadData.email,
          status: 'new',
          rawPayload: webhookResult.leadData.rawPayload,
        },
      });
    } else {
      // Keep contact data populated
      const updateData: any = {};
      if (!lead.contactName && webhookResult.leadData.name) {
        updateData.contactName = webhookResult.leadData.name;
      }
      if (!lead.contactPhone && webhookResult.leadData.phone) {
        updateData.contactPhone = webhookResult.leadData.phone;
      }
      if (!lead.contactEmail && webhookResult.leadData.email) {
        updateData.contactEmail = webhookResult.leadData.email;
      }
      if (Object.keys(updateData).length > 0) {
        lead = await tenantPrisma.lead.update({
          where: { id: lead.id },
          data: updateData,
        });
      }
    }

    // 4. Save the inbound message
    let message = null;
    if (webhookResult.messageData) {
      message = await tenantPrisma.message.create({
        data: {
          leadId: lead.id,
          direction: webhookResult.messageData.direction,
          platform: logEntry.platform,
          externalMessageId: webhookResult.messageData.externalMessageId,
          content: webhookResult.messageData.content,
          aiProcessed: false,
        },
      });
    }

    // 5. Trigger AI Layer on inbound message
    if (message && webhookResult.messageData?.direction === 'inbound') {
      // Gather conversation history
      const history = await tenantPrisma.message.findMany({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      // Reverse to get chronological order
      const historyChronological = [...history].reverse();
      const historyText = historyChronological
        .map((m) => `${m.direction === 'inbound' ? 'Lead' : 'CRM'}: ${m.content}`)
        .join('\n');

      // Match listings via pgvector cosine distance
      let listingsText = '';
      try {
        const messageEmbedding = await generateEmbedding(webhookResult.messageData.content);
        const embeddingStr = `[${messageEmbedding.join(',')}]`;

        const matchedListings: any[] = await prisma.$queryRaw`
          SELECT id, title, description, price, location, bedrooms, bathrooms, "propertyType",
                 (embedding <=> ${embeddingStr}::vector) as distance
          FROM "Listing"
          WHERE "tenantId" = ${webhookResult.tenantId}
          ORDER BY distance ASC
          LIMIT 3
        `;

        // Format listings
        listingsText = matchedListings
          .map(
            (l) =>
              `- [ID: ${l.id}] ${l.title} in ${l.location} | Price: $${Number(l.price)} | ${l.bedrooms} BHK | Description: ${l.description}`
          )
          .join('\n');
      } catch (err) {
        console.error('Vector similarity query failed, proceeding with empty matches:', err);
      }

      // Execute AI generation
      const clientTone = config.config.tone || 'professional, helpful, and warm';
      const aiAnalysis = await analyzeLeadMessage(
        webhookResult.messageData.content,
        historyText,
        listingsText,
        clientTone
      );

      // Update lead scoring profile
      await tenantPrisma.lead.update({
        where: { id: lead.id },
        data: {
          score: aiAnalysis.score,
          scoreReasoning: aiAnalysis.reasoning,
        },
      });

      // Handle auto-reply logic
      let aiDraftStatus = 'pending_approval';
      const isAutoRespondEnabled = config.config.autoRespond === true || config.config.auto_respond === true;
      const isResponseSafe = ['buying', 'renting', 'browsing'].includes(aiAnalysis.intent) && aiAnalysis.score !== 'cold';

      if (isAutoRespondEnabled && isResponseSafe) {
        try {
          const sendResult = await connector.send(webhookResult.leadExternalId, aiAnalysis.draft_reply, config);
          aiDraftStatus = 'auto_sent';

          // Record outbound auto-response
          await tenantPrisma.message.create({
            data: {
              leadId: lead.id,
              direction: 'outbound',
              platform: logEntry.platform,
              externalMessageId: sendResult.externalMessageId,
              content: aiAnalysis.draft_reply,
              aiProcessed: true,
            },
          });
        } catch (sendError) {
          console.error('Outbound auto-response failed, falling back to manual queue:', sendError);
          aiDraftStatus = 'pending_approval';
        }
      }

      // Save classification and draft details to DB
      await tenantPrisma.message.update({
        where: { id: message.id },
        data: {
          aiProcessed: true,
          aiClassification: {
            intent: aiAnalysis.intent,
            score: aiAnalysis.score,
            reasoning: aiAnalysis.reasoning,
            extracted_parameters: aiAnalysis.extracted_parameters,
          },
          aiDraftReply: aiAnalysis.draft_reply,
          aiDraftStatus,
        },
      });
    }

    // Success! Update status
    await prisma.webhookEventLog.update({
      where: { id: webhookEventId },
      data: { status: 'completed' },
    });

  } catch (error: any) {
    console.error(`AI processing worker failed for webhook event ${webhookEventId}:`, error);

    // Fail log tracking for retries
    const nextRetryCount = logEntry.retryCount + 1;
    const isDeadLetter = nextRetryCount >= 3;
    
    await prisma.webhookEventLog.update({
      where: { id: webhookEventId },
      data: {
        status: isDeadLetter ? 'dead_letter' : 'failed',
        retryCount: nextRetryCount,
        errorLog: `${error?.message || error || 'Unknown processing error'}\n${error?.stack || ''}`,
      },
    });
  }
}
