import { ILeadConnector } from './types';
import { whatsappConnector } from './whatsapp';
import { telegramConnector } from './telegram';
import { genericConnector } from './generic';
import { messengerConnector, instagramConnector, facebookLeadAdsConnector } from './meta_others';

export function getConnector(platform: string): ILeadConnector {
  switch (platform.toLowerCase()) {
    case 'whatsapp':
      return whatsappConnector;
    case 'telegram':
      return telegramConnector;
    case 'messenger':
    case 'facebook':
      return messengerConnector;
    case 'instagram':
      return instagramConnector;
    case 'facebook_ads':
    case 'instagram_ads':
    case 'lead_ads':
      return facebookLeadAdsConnector;
    case 'generic':
      return genericConnector;
    default:
      throw new Error(`Platform connector not supported: ${platform}`);
  }
}
