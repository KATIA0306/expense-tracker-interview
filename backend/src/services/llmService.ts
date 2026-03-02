import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import logger from '../logger.js';

// Email filter result
export interface EmailFilterResult {
  receiptEmailIds: string[];
}

// Batch extraction result
export interface BatchExtractedExpense {
  emailId: string;
  merchant: string;
  amount: number;
  date: string;
  category: string;
  description: string;
}

// Email structure for scanning
export interface Email {
  id: string;
  from: string;
  subject: string;
  date: string;
  body: string;
}

// Schema for email filtering response
const emailFilterSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    receiptEmailIds: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Array of email IDs that contain receipts or transaction information',
    },
  },
  required: ['receiptEmailIds'],
};

// Schema for batch expense extraction
const batchExtractSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    expenses: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          emailId: { type: SchemaType.STRING, description: 'ID of the source email' },
          merchant: { type: SchemaType.STRING, description: 'Name of the merchant or business' },
          amount: { type: SchemaType.NUMBER, description: 'Total amount spent' },
          date: { type: SchemaType.STRING, description: 'Date of transaction in YYYY-MM-DD format' },
          category: {
            type: SchemaType.STRING,
            description: 'Category: Food, Transport, Entertainment, Bills, Shopping, or Other',
          },
          description: { type: SchemaType.STRING, description: 'Brief description of the expense' },
        },
        required: ['emailId', 'merchant', 'amount', 'date', 'category', 'description'],
      },
    },
  },
  required: ['expenses'],
};

// Get GenAI instance
function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenerativeAI(apiKey);
}

// Get model for email filtering
function getEmailFilterModel() {
  const genAI = getGenAI();
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: emailFilterSchema,
    },
  });
}

// Get model for batch expense extraction
function getBatchExtractModel() {
  const genAI = getGenAI();
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: batchExtractSchema,
    },
  });
}

// Filter emails to find those containing receipts
export async function filterReceiptEmails(emails: Email[]): Promise<EmailFilterResult> {
  try {
    const model = getEmailFilterModel();

    const emailSummaries = emails.map((e) => ({
      id: e.id,
      from: e.from,
      subject: e.subject,
      bodyPreview: e.body.substring(0, 500),
    }));

    const prompt = `Analyze the following emails and identify which ones contain receipts,
transaction confirmations, purchase confirmations, or expense-related information.

Emails:
${JSON.stringify(emailSummaries, null, 2)}

Return the IDs of emails that contain receipt or transaction information.
Only include emails that represent actual purchases or expenses (money paid by the recipient).

CRITICAL: First exclude any email where (a) subject starts with "Shipped:" or (b) sender contains "shipment-tracking@". These are shipment notifications, never receipts—even if they mention totals or invoices.

Include: order confirmations that confirm payment was received (e.g. "Total charged", "Thank you for your order" with a total), payment confirmations (e.g. "Thank you for your payment", "Payment Confirmation"), trip receipts, purchase receipts. If the subject or body indicates a purchase was made or payment received, include it. Ignore HTML entities and formatting noise; focus on semantic content.
Do NOT include:
- Pre-checkout confirmations (e.g. "You will be charged at checkout", "charged at checkout")—payment not yet made; these are order-placed confirmations, not receipts.
- Newsletters, promotional emails, or marketing (deals, flyers, sale announcements).
- Shipping/shipment notifications. Exclude if the subject starts with "Shipped:" or the sender is "shipment-tracking@" or the body says "Your package was shipped" / "Out for delivery". These are NEVER receipts—exclude them even if they mention a total or invoice. Only the initial "Ordered:" / order confirmation email is a receipt; shipment tracking is not.
- Refunds or refund confirmations (money returned is not an expense).
- Booking or event details (itinerary, party package info, "Thank you for booking") that do not explicitly confirm a payment or total charged in that email. If the email only describes the event and no payment received line, exclude it.
- General communications, reminders, or non-transactional messages.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    logger.info({ responseLength: text.length, emailCount: emails.length }, 'Email filtering completed');

    const filterResult = JSON.parse(text) as EmailFilterResult;
    return filterResult;
  } catch (error) {
    logger.error({ err: error }, 'Failed to filter receipt emails');
    return { receiptEmailIds: [] };
  }
}

// Extract expenses from multiple emails
export async function extractExpensesFromEmails(emails: Email[]): Promise<BatchExtractedExpense[]> {
  try {
    const model = getBatchExtractModel();

    const emailsPayload = emails.map((e) => ({
      id: e.id,
      from: e.from,
      subject: e.subject,
      date: e.date,
      body: e.body,
    }));

    const prompt = `Analyze the following emails and extract expense/receipt information from each.
For each email, extract: merchant name, amount spent, date (YYYY-MM-DD format),
category (Food, Transport, Entertainment, Bills, Shopping, or Other), and a brief description.

Emails:
${JSON.stringify(emailsPayload, null, 2)}

Extract expense details only from emails that confirm a purchase or payment (order confirmations, payment confirmations, receipts).
If an email contains multiple transactions, create separate entries for each.

Date handling:
- Parse the date field (often RFC 2822 format like "Thu, 22 Jan 2026 15:31:30 +0000" or "28 Jan 2026 02:37:31 +0000") and output YYYY-MM-DD.
- Prefer order/purchase date from body when stated; otherwise use the email date.
- Examples: "Sun, 18 Jan 2026 17:00:18 +0000" → "2026-01-18"; "28 Jan 2026 02:37:31 +0000" → "2026-01-28".

Amount handling:
- Look for totals in formats like: $33.38, CA$56.51, CAD 305.08, Total $13.55, "Total $ 33 38" (spaces = decimal, so 33.38).
- Use the final total charged/paid when shown. Amount must be a number.
- If amount is not stated in the body (e.g. "invoice attached", "Thank you for your payment" with no total), use 0 and include a note in description (e.g. "Payment confirmation, amount in attached invoice").

Merchant: Use the sender/company name (e.g. from "Amazon.ca <auto-confirm@amazon.ca>" → "Amazon.ca").

Do NOT extract from: refund emails; shipping/shipment notifications (e.g. subject "Shipped:", body "Your package was shipped"—these are status updates, not receipts); newsletters or promotional emails. For those, return empty expenses array.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    logger.info({ responseLength: text.length, emailCount: emails.length }, 'Batch expense extraction completed');

    const extractResult = JSON.parse(text) as { expenses: BatchExtractedExpense[] };
    return extractResult.expenses;
  } catch (error) {
    logger.error({ err: error }, 'Failed to extract expenses from emails');
    return [];
  }
}
