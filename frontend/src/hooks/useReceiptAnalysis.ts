import { useMutation } from '@tanstack/react-query';
import * as receiptsApi from '../api/receipts';
import type { EmailData } from '../types';

export function useScanEmails() {
  return useMutation({
    mutationFn: (emails: EmailData[]) => receiptsApi.scanEmails(emails),
  });
}
