import { NextResponse } from 'next/server';
import { prisma, getTenantPrisma } from '@/lib/db';
import { decryptJSON } from '@/lib/encryption';
import { getConnector } from '@/lib/connectors/manager';
import { authorizeTenant } from '@/lib/auth-helper';

/**
 * GET - Retrieve message list for a lead.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const leadId = searchParams.get('leadId');

    if (!tenantId || !leadId) {
      return NextResponse.json({ error: 'tenantId and leadId are required' }, { status: 400 });
    }

    // Server-side tenant authorization check
    try {
      await authorizeTenant(tenantId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: err.status || 403 });
    }

    const tenantPrisma = getTenantPrisma(tenantId);
    const messages = await tenantPrisma.message.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages);
  } catch (error: any) {
    console.error('Failed to retrieve messages:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST - Send outbound messages manually or approve/edit AI draft replies.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, action } = body;

    if (!tenantId || !action) {
      return NextResponse.json({ error: 'tenantId and action are required' }, { status: 400 });
    }

    // Server-side tenant authorization check
    try {
      await authorizeTenant(tenantId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: err.status || 403 });
    }

    const tenantPrisma = getTenantPrisma(tenantId);

    // ACTION: send - Send a manual outbound reply to a lead
    if (action === 'send') {
      const { leadId, content } = body;
      if (!leadId || !content) {
        return NextResponse.json({ error: 'leadId and content are required for action=send' }, { status: 400 });
      }

      const lead = await tenantPrisma.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead || !lead.sourceLeadId) {
        return NextResponse.json({ error: 'Lead not found or has no external address' }, { status: 404 });
      }

      // Fetch active connector for this platform
      const connectorRecord = await prisma.connector.findFirst({
        where: {
          tenantId,
          platform: lead.sourcePlatform,
          status: 'active',
        },
      });

      if (!connectorRecord) {
        return NextResponse.json(
          { error: `No active connector configuration found for platform ${lead.sourcePlatform}` },
          { status: 400 }
        );
      }

      const connector = getConnector(lead.sourcePlatform);
      const credentials = decryptJSON(connectorRecord.encryptedCredentials);
      const config = {
        connectorId: connectorRecord.id,
        tenantId,
        platform: lead.sourcePlatform,
        credentials,
        config: connectorRecord.config as Record<string, any>,
      };

      // Dispatches reply to the external platform
      const sendResult = await connector.send(lead.sourceLeadId, content, config);

      // Saves output back to messages log
      const message = await tenantPrisma.message.create({
        data: {
          leadId: lead.id,
          direction: 'outbound',
          platform: lead.sourcePlatform,
          externalMessageId: sendResult.externalMessageId,
          content,
          aiProcessed: true,
          aiDraftStatus: 'none',
        },
      });

      return NextResponse.json(message, { status: 201 });
    }

    // ACTION: approve_draft - Review, edit, and dispatch a pending AI response
    if (action === 'approve_draft') {
      const { messageId, editedContent } = body;
      if (!messageId) {
        return NextResponse.json({ error: 'messageId is required for action=approve_draft' }, { status: 400 });
      }

      const inboundMessage = await tenantPrisma.message.findUnique({
        where: { id: messageId },
        include: { lead: true },
      });

      if (!inboundMessage) {
        return NextResponse.json({ error: 'Inbound message reference not found' }, { status: 404 });
      }

      const lead = inboundMessage.lead;
      const contentToSend = editedContent !== undefined ? editedContent : inboundMessage.aiDraftReply;

      if (!contentToSend) {
        return NextResponse.json({ error: 'Draft reply content is empty' }, { status: 400 });
      }

      if (!lead.sourceLeadId) {
        return NextResponse.json({ error: 'Lead lacks external platform routing address' }, { status: 400 });
      }

      const connectorRecord = await prisma.connector.findFirst({
        where: {
          tenantId,
          platform: lead.sourcePlatform,
          status: 'active',
        },
      });

      if (!connectorRecord) {
        return NextResponse.json({ error: `Active connector not found for platform ${lead.sourcePlatform}` }, { status: 400 });
      }

      const connector = getConnector(lead.sourcePlatform);
      const credentials = decryptJSON(connectorRecord.encryptedCredentials);
      const config = {
        connectorId: connectorRecord.id,
        tenantId,
        platform: lead.sourcePlatform,
        credentials,
        config: connectorRecord.config as Record<string, any>,
      };

      // Send outbound message
      const sendResult = await connector.send(lead.sourceLeadId, contentToSend, config);

      // Create outbound message record
      const outboundMessage = await tenantPrisma.message.create({
        data: {
          leadId: lead.id,
          direction: 'outbound',
          platform: lead.sourcePlatform,
          externalMessageId: sendResult.externalMessageId,
          content: contentToSend,
          aiProcessed: true,
          aiDraftStatus: 'approved',
        },
      });

      // Update the original inbound message status
      await tenantPrisma.message.update({
        where: { id: messageId },
        data: {
          aiDraftStatus: 'approved',
          aiDraftReply: contentToSend, // update draft if edited
        },
      });

      return NextResponse.json(outboundMessage, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action name' }, { status: 400 });
  } catch (error: any) {
    console.error('POST messages endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error?.message }, { status: 500 });
  }
}
