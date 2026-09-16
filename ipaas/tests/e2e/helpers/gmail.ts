import { google } from 'googleapis';
import { readSecret } from './secrets.js';

function buildClient() {
  const clientId = readSecret('GMAIL_CLIENT_ID');
  const clientSecret = readSecret('GMAIL_CLIENT_SECRET');
  const refreshToken = readSecret('GMAIL_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN must be set');
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth });
}

/**
 * Polls the inbox for an OTP email matching `subjectPattern` that arrived
 * after `afterMs` (epoch ms). Returns the first 6-digit code found.
 * Throws if no OTP is found within `timeoutMs`.
 */
export async function waitForOTP(options: { subjectPattern: RegExp; afterMs: number; timeoutMs?: number; pollIntervalMs?: number }): Promise<string> {
  const { subjectPattern, afterMs, timeoutMs = 30_000, pollIntervalMs = 3_000 } = options;
  const gmail = buildClient();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const list = await gmail.users.messages.list({
      userId: 'me',
      q: `newer_than:1h`,
      maxResults: 10,
    });

    const messages = list.data.messages ?? [];

    for (const { id } of messages) {
      if (!id) continue;

      const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
      const internalDate = Number(msg.data.internalDate ?? 0);
      if (internalDate < afterMs) continue;

      const subjectHeader = msg.data.payload?.headers?.find((h) => h.name === 'Subject');
      if (!subjectHeader?.value || !subjectPattern.test(subjectHeader.value)) continue;

      const body = extractBody(msg.data);
      const match = body.match(/\b(\d{6})\b/);
      if (match) return match[1];
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`No OTP found matching ${subjectPattern} within ${timeoutMs}ms`);
}

function extractBody(message: import('googleapis').gmail_v1.Schema$Message): string {
  // snippet is always plain text — fastest path for finding an OTP
  if (message.snippet) return message.snippet;

  type Part = import('googleapis').gmail_v1.Schema$MessagePart;

  function findPlainText(parts: Part[]): string | null {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf8');
      }
      if (part.parts) {
        const nested = findPlainText(part.parts);
        if (nested) return nested;
      }
    }
    return null;
  }

  const plain = findPlainText(message.payload?.parts ?? []);
  if (plain) return plain;

  if (message.payload?.body?.data) {
    return Buffer.from(message.payload.body.data, 'base64').toString('utf8');
  }
  return '';
}
