export interface ConnectorConfig {
  connectorId: string;
  tenantId: string;
  platform: string;
  credentials: Record<string, any>; // Decrypted credentials (e.g. tokens, app secrets)
  config: Record<string, any>;      // Public parameters (e.g. page_id, phone_number_id)
}

export interface WebhookResult {
  tenantId: string;
  leadExternalId: string; // Unified identifier for the contact on this platform (e.g., phone, chat ID)
  leadData: {
    name?: string;
    phone?: string;
    email?: string;
    rawPayload: any;
  };
  messageData?: {
    externalMessageId: string;
    content: string;
    direction: 'inbound' | 'outbound';
  };
}

export interface ILeadConnector {
  /**
   * Verifies the signature or token of an inbound webhook.
   */
  verifyWebhook(
    headers: Record<string, any>,
    body: any,
    config: ConnectorConfig
  ): Promise<boolean>;

  /**
   * Parses the raw platform webhook event and maps it into a unified Lead/Message schema structure.
   */
  handleWebhook(
    body: any,
    config: ConnectorConfig
  ): Promise<WebhookResult>;

  /**
   * Sends an outbound reply back to the platform.
   */
  send(
    recipientId: string,
    messageContent: string,
    config: ConnectorConfig
  ): Promise<{ externalMessageId: string }>;
}
