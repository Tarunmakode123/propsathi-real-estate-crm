import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/db';
import { decryptJSON } from '@/lib/encryption';
import { getConnector } from '@/lib/connectors/manager';
import { processWebhookEvent } from '@/lib/ai-process-worker';

/**
 * GET handler for Meta webhook verification challenge.
 * Verification flow: Meta sends a hub.challenge and hub.verify_token.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (['whatsapp', 'messenger', 'instagram'].includes(platform.toLowerCase())) {
      const expectedToken = process.env.META_VERIFY_TOKEN || 'propsathi_meta_secret_2026';
      
      if (mode === 'subscribe' && token === expectedToken) {
        console.log(`Webhook verified for Meta platform: ${platform}`);
        return new Response(challenge, { status: 200 });
      }
    }

    return new Response('Verification failed', { status: 403 });
  } catch (error) {
    console.error('GET Webhook verification error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * POST handler to receive inbound webhooks from all platforms.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;
    const { searchParams } = new URL(request.url);
    
    // Read raw body as text for signature verification
    const rawBody = await request.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Convert headers to a standard record map
    const headersMap: Record<string, string> = {};
    request.headers.forEach((val, key) => {
      headersMap[key] = val;
    });

    let connector = null;

    // 1. Route/resolve connector depending on platform and payload structure
    const platformLower = platform.toLowerCase();

    if (['whatsapp', 'messenger', 'instagram', 'facebook_ads'].includes(platformLower)) {
      let externalId = '';

      if (platformLower === 'whatsapp') {
        // WhatsApp phone ID
        externalId = body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || '';
      } else if (['messenger', 'instagram'].includes(platformLower)) {
        // Facebook Page ID or IG Account ID
        externalId = body.entry?.[0]?.id || '';
      } else if (platformLower === 'facebook_ads') {
        // Lead Ad form changes entry ID
        externalId = body.entry?.[0]?.id || '';
      }

      if (externalId) {
        connector = await prisma.connector.findUnique({
          where: {
            platform_externalId: {
              platform: platformLower,
              externalId,
            },
          },
        });
      }
    } else {
      // Telegram and Generic webhooks provide a direct connectorId in the URL query parameter
      const queryConnectorId = searchParams.get('connectorId');
      if (queryConnectorId) {
        connector = await prisma.connector.findUnique({
          where: { id: queryConnectorId },
        });
      }
    }

    if (!connector) {
      console.warn(`Webhook routing failed: Could not resolve connector for ${platformLower}`);
      // Returning 200 to acknowledge Meta/Telegram webhooks so they stop retrying, but logging internally
      return NextResponse.json({ error: 'Connector not configured or resolved' }, { status: 200 });
    }

    // 2. Instantiate and verify signature
    const connectorInstance = getConnector(connector.platform);
    const decryptedCredentials = decryptJSON(connector.encryptedCredentials);
    
    const config = {
      connectorId: connector.id,
      tenantId: connector.tenantId,
      platform: connector.platform,
      credentials: decryptedCredentials,
      config: connector.config as Record<string, any>,
    };

    const isVerified = await connectorInstance.verifyWebhook(headersMap, rawBody, config);
    if (!isVerified) {
      return NextResponse.json({ error: 'Unauthorized signature' }, { status: 401 });
    }

    // 3. Save raw webhook log entry with status = pending
    const eventLog = await prisma.webhookEventLog.create({
      data: {
        tenantId: connector.tenantId,
        connectorId: connector.id,
        platform: connector.platform,
        headers: headersMap,
        payload: body,
        status: 'pending',
      },
    });

    // 4. Trigger AI background processing asynchronously without blocking response
    after(async () => {
      try {
        await processWebhookEvent(eventLog.id);
      } catch (err) {
        console.error(`AI Background processing error on webhook log ${eventLog.id}:`, err);
      }
    });

    // Return immediate 200 OK to the platform
    return NextResponse.json({ success: true, logId: eventLog.id }, { status: 200 });
  } catch (error) {
    console.error('POST Webhook handler error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
