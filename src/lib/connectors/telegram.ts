import { ILeadConnector, ConnectorConfig, WebhookResult } from './types';

export class TelegramConnector implements ILeadConnector {
  /**
   * Verifies the Telegram webhook using the secret token header.
   */
  async verifyWebhook(
    headers: Record<string, any>,
    body: any,
    config: ConnectorConfig
  ): Promise<boolean> {
    const secretToken = headers['x-telegram-bot-api-secret-token'] || headers['X-Telegram-Bot-Api-Secret-Token'];
    const expectedToken = config.credentials.secretToken || config.credentials.secret_token;

    if (!expectedToken) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Skipping Telegram secret token verification in development (no secretToken configured).');
        return true;
      }
      return false;
    }

    return secretToken === expectedToken;
  }

  /**
   * Processes the Telegram update payload.
   */
  async handleWebhook(
    body: any,
    config: ConnectorConfig
  ): Promise<WebhookResult> {
    const message = body.message || body.edited_message;
    if (!message) {
      throw new Error('No message object found in Telegram webhook payload');
    }

    const from = message.from;
    const chat = message.chat;
    if (!from || !chat) {
      throw new Error('Incomplete Telegram sender/chat details');
    }

    const leadExternalId = chat.id.toString();
    
    // Construct name
    const firstName = from.first_name || '';
    const lastName = from.last_name || '';
    const username = from.username ? `@${from.username}` : '';
    const name = `${firstName} ${lastName}`.trim() || username || `TG User (${leadExternalId})`;

    // Handle contact sharing message if they shared their phone number
    let phone = undefined;
    let content = message.text || '';

    if (message.contact) {
      phone = message.contact.phone_number;
      content = `[Shared Contact: ${phone} for ${message.contact.first_name || ''}]`;
    }

    return {
      tenantId: config.tenantId,
      leadExternalId,
      leadData: {
        name,
        phone,
        rawPayload: body,
      },
      messageData: {
        externalMessageId: message.message_id.toString(),
        content,
        direction: 'inbound',
      },
    };
  }

  /**
   * Sends a message to a Telegram chat.
   */
  async send(
    recipientId: string,
    messageContent: string,
    config: ConnectorConfig
  ): Promise<{ externalMessageId: string }> {
    const botToken = config.credentials.botToken || config.credentials.bot_token;
    if (!botToken) {
      throw new Error('Missing botToken in Telegram connector credentials');
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: recipientId,
        text: messageContent,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(`Telegram API Error: ${data.description || response.statusText}`);
    }

    const msgId = data.result?.message_id;
    if (!msgId) {
      throw new Error('Telegram API succeeded but returned no message ID');
    }

    return {
      externalMessageId: msgId.toString(),
    };
  }
}

export const telegramConnector = new TelegramConnector();
