import { ILeadConnector, ConnectorConfig, WebhookResult } from './types';

export class GenericConnector implements ILeadConnector {
  /**
   * Verifies the request using a custom header API Key / Secret Token.
   */
  async verifyWebhook(
    headers: Record<string, any>,
    body: any,
    config: ConnectorConfig
  ): Promise<boolean> {
    const headerName = config.config.authHeaderName || 'x-api-key';
    const secretToken = headers[headerName.toLowerCase()] || headers[headerName];
    const expectedToken = config.credentials.secretToken || config.credentials.secret_token;

    if (!expectedToken) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Skipping Generic webhook token verification in development (no secretToken configured).');
        return true;
      }
      return false;
    }

    return secretToken === expectedToken;
  }

  /**
   * Processes a generic webhook payload using JSON path mapping rules.
   */
  async handleWebhook(
    body: any,
    config: ConnectorConfig
  ): Promise<WebhookResult> {
    const mappings = config.config.mappings || {};
    
    // Resolve value using dot notation paths (e.g. 'lead.user.name')
    const resolvePath = (path: string, defaultValue = ''): string => {
      if (!path) return defaultValue;
      const parts = path.split('.');
      let current = body;
      for (const part of parts) {
        if (current === null || current === undefined) return defaultValue;
        current = current[part];
      }
      return current !== undefined && current !== null ? String(current) : defaultValue;
    };

    // Extract values based on configured paths
    const name = resolvePath(mappings.namePath, 'Generic Lead');
    const phone = resolvePath(mappings.phonePath) || undefined;
    const email = resolvePath(mappings.emailPath) || undefined;
    const content = resolvePath(mappings.contentPath, 'New lead created via generic webhook');
    const leadExternalId = resolvePath(mappings.externalIdPath) || crypto.randomUUID();

    return {
      tenantId: config.tenantId,
      leadExternalId,
      leadData: {
        name,
        phone,
        email,
        rawPayload: body,
      },
      messageData: {
        externalMessageId: crypto.randomUUID(),
        content,
        direction: 'inbound',
      },
    };
  }

  /**
   * Generic endpoints are read-only (inbound only).
   */
  async send(
    recipientId: string,
    messageContent: string,
    config: ConnectorConfig
  ): Promise<{ externalMessageId: string }> {
    throw new Error('Generic inbound webhook connector does not support outbound messaging.');
  }
}

export const genericConnector = new GenericConnector();
