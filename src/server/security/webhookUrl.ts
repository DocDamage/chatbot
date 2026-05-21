import { ValidationError } from '../../utils/errors';

export function validateWebhookUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ValidationError('Webhook URL is invalid');
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new ValidationError('Webhook URL must use http or https');
  }

  const hostname = parsed.hostname.toLowerCase();
  const privateHostPattern = /^(localhost|0\.0\.0\.0|127(?:\.|$)|10(?:\.|$)|192\.168(?:\.|$)|172\.(?:1[6-9]|2\d|3[0-1])(?:\.|$))/;
  if (process.env.ALLOW_PRIVATE_WEBHOOK_URLS !== 'true' && privateHostPattern.test(hostname)) {
    throw new ValidationError('Webhook URL cannot target private or loopback hosts');
  }

  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new ValidationError('Webhook URL must use https in production');
  }

  return parsed.toString();
}
