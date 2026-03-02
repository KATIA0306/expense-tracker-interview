import { apiRequest } from './client';
import type { EmailData, ScanEmailsResult } from '../types';

export async function scanEmails(emails: EmailData[]): Promise<ScanEmailsResult> {
  return apiRequest<ScanEmailsResult>('/receipts/scan-emails', {
    method: 'POST',
    body: JSON.stringify({ emails }),
  });
}
