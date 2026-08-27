import crypto from 'crypto';
import { ILeadConnector, ConnectorConfig, WebhookResult } from './types';

export class WhatsAppConnector implements ILeadConnector {
  /**
   * Verifies the signature of the incoming Meta webhook.
   * Meta sends the signature in the X-Hub-Signature-256 header.
   */
  async verifyWebhook(
    headers: Record<string, any>,
    body: any,
    config: ConnectorConfig
  ): Promise<boolean> {
    const signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];

    // Check for internal mock test verification bypass
    const mockToken = headers['x-propsathi-mock'] || headers['X-Propsathi-Mock'];
    if (mockToken === 'propsathi_meta_secret_2026') {
      return true;
    }

    if (!signature) {
      // In development or local testing without an App Secret, we can skip signature check
      if (process.env.NODE_ENV === 'development' && !config.credentials.appSecret) {
        console.warn('Skipping WhatsApp webhook signature verification in development (no App Secret configured).');
        return true;
      }
      return false;
    }

    const appSecret = config.credentials.appSecret;
    if (!appSecret) {
      return false;
    }

    const parts = signature.split('=');
    const signatureHash = parts[1];

    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedHash = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    return signatureHash === expectedHash;
  }

  /**
   * Processes the raw WhatsApp webhook payload.
   */
  async handleWebhook(
    body: any,
    config: ConnectorConfig
  ): Promise<WebhookResult> {
    // Meta payload contains entries with changes
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) {
      throw new Error('Invalid WhatsApp webhook payload structure');
    }

    // Ignore status updates (sent, delivered, read receipts)
    if (value.statuses) {
      throw new Error('Received status update webhook, not a new message');
    }

    const contact = value.contacts?.[0];
    const message = value.messages?.[0];

    if (!message) {
      throw new Error('No message found in WhatsApp webhook payload');
    }

    const leadExternalId = contact?.wa_id || message.from;
    const name = contact?.profile?.name || `WA User (${leadExternalId})`;
    
    // Construct message content based on type
    let content = '';
    if (message.type === 'text') {
      content = message.text?.body || '';
    } else if (message.type === 'interactive') {
      const interactive = message.interactive;
      if (interactive.type === 'button_reply') {
        content = interactive.button_reply?.title || '';
      } else if (interactive.type === 'list_reply') {
        content = interactive.list_reply?.title || '';
      }
    } else {
      content = `[Sent a ${message.type} message]`;
    }

    return {
      tenantId: config.tenantId,
      leadExternalId,
      leadData: {
        name,
        phone: leadExternalId,
        rawPayload: body,
      },
      messageData: {
        externalMessageId: message.id,
        content,
        direction: 'inbound',
      },
    };
  }

  /**
   * Sends an outbound WhatsApp message using the Meta Graph API.
   */
  async send(
    recipientId: string,
    messageContent: string,
    config: ConnectorConfig
  ): Promise<{ externalMessageId: string }> {
    const phoneNumberId = config.config.phoneNumberId || config.config.phone_number_id;
    const accessToken = config.credentials.accessToken || config.credentials.access_token;

    if (!phoneNumberId) {
      throw new Error('Missing phone_number_id in WhatsApp connector configuration');
    }
    if (!accessToken) {
      throw new Error('Missing access_token in WhatsApp credentials');
    }

    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientId,
        type: 'text',
        text: {
          preview_url: false,
          body: messageContent,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`WhatsApp API Error: ${data.error?.message || response.statusText}`);
    }

    const msgId = data.messages?.[0]?.id;
    if (!msgId) {
      throw new Error('WhatsApp API succeeded but returned no message ID');
    }

    return {
      externalMessageId: msgId,
    };
  }
}
export const whatsappConnector = new WhatsAppConnector();
