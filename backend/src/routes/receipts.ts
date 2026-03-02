import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import {
  filterReceiptEmails,
  extractExpensesFromEmails,
  type Email,
} from '../services/llmService.js';
import db from '../db/knex.js';
import logger from '../logger.js';

const router = Router();

// Schema for email data in scan-emails endpoint
const emailSchema = z.object({
  id: z.string(),
  from: z.string(),
  subject: z.string(),
  date: z.string(),
  body: z.string(),
});

const scanEmailsSchema = z.object({
  emails: z.array(emailSchema).min(1).max(100),
});

// Helper function to match category name to database category
async function matchCategory(categoryName: string): Promise<{ id: number; name: string }> {
  const categories = await db('categories').select('id', 'name');
  const normalizedName = categoryName.toLowerCase();

  // Try exact match first
  const exactMatch = categories.find((c) => c.name.toLowerCase() === normalizedName);
  if (exactMatch) {
    return { id: exactMatch.id, name: exactMatch.name };
  }

  // Try partial match
  const partialMatch = categories.find(
    (c) => c.name.toLowerCase().includes(normalizedName) || normalizedName.includes(c.name.toLowerCase())
  );
  if (partialMatch) {
    return { id: partialMatch.id, name: partialMatch.name };
  }

  // Default to "Other" category
  const otherCategory = categories.find((c) => c.name.toLowerCase() === 'other');
  if (otherCategory) {
    return { id: otherCategory.id, name: otherCategory.name };
  }

  // Fallback to first category if "Other" doesn't exist
  return { id: categories[0].id, name: categories[0].name };
}

// POST /api/receipts/scan-emails - Scan uploaded email data for receipts
router.post('/scan-emails', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { emails } = scanEmailsSchema.parse(req.body);

    logger.info({ emailCount: emails.length }, 'Starting email scan');

    // Step 1: Filter emails to find receipt-containing ones
    const filterResult = await filterReceiptEmails(emails as Email[]);

    if (filterResult.receiptEmailIds.length === 0) {
      res.json({ expenses: [], message: 'No receipt emails found' });
      return;
    }

    // Step 2: Extract expense data from receipt emails
    const receiptEmails = emails.filter((e) => filterResult.receiptEmailIds.includes(e.id));
    const extractedExpenses = await extractExpensesFromEmails(receiptEmails as Email[]);

    // Step 3: Match categories and prepare draft expenses
    const draftExpenses = await Promise.all(
      extractedExpenses.map(async (expense) => {
        const category = await matchCategory(expense.category);
        return {
          emailId: expense.emailId,
          merchant: expense.merchant,
          amount: expense.amount,
          date: expense.date,
          description: expense.description,
          categoryId: category.id,
          categoryName: category.name,
        };
      })
    );

    logger.info(
      {
        totalEmails: emails.length,
        receiptEmails: receiptEmails.length,
        extractedExpenses: draftExpenses.length,
      },
      'Email scan completed'
    );

    res.json({ expenses: draftExpenses });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid email data', details: error.errors });
      return;
    }
    logger.error({ err: error }, 'Error scanning emails');
    res.status(500).json({ error: 'Failed to scan emails' });
  }
});

export default router;
