export interface User {
  id: number;
  email: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
}

export interface Expense {
  id: number;
  userId: number;
  categoryId: number;
  amount: number;
  description: string;
  date: string;
  createdAt: string;
  categoryName: string;
  categoryIcon: string;
}

export interface CreateExpenseData {
  categoryId: number;
  amount: number;
  description: string;
  date: string;
}

export interface UpdateExpenseData {
  categoryId?: number;
  amount?: number;
  description?: string;
  date?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface MonthlyTotal {
  total: number;
  year: number;
  month: number;
}

// Import feature types
export type ImportSessionStatus = 'upload' | 'mapping' | 'preview' | 'completed' | 'cancelled';

export interface ImportSession {
  id: number;
  userId: number;
  status: ImportSessionStatus;
  fileName: string | null;
  fileSize: number | null;
  rawCsvData: string | null;
  columnMapping: string | null;
  parsedRows: string | null;
  validRowCount: number;
  invalidRowCount: number;
  skippedRowCount: number;
  importedExpenseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImportHistory {
  id: number;
  userId: number;
  sessionId: number;
  fileName: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  createdAt: string;
}

export interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
  category?: string;
}

export interface RowValidationError {
  field: string;
  message: string;
}

export interface ParsedRow {
  rowIndex: number;
  originalData: Record<string, string>;
  date: string | null;
  amount: number | null;
  description: string | null;
  category: string | null;
  categoryId: number | null;
  errors: RowValidationError[];
  skipped: boolean;
}

export interface CsvStructure {
  headers: string[];
  delimiter: string;
  rowCount: number;
  sampleRows: string[][];
  suggestedMapping: Partial<ColumnMapping>;
}

export interface UploadResult {
  session: ImportSession;
  structure: CsvStructure;
}

export interface MappingResult {
  session: ImportSession;
  parsedRows: ParsedRow[];
  validCount: number;
  invalidCount: number;
}

export interface ImportResult {
  importedCount: number;
  skippedCount: number;
  history: ImportHistory;
}

// Email scanning types
export interface EmailData {
  id: string;
  from: string;
  subject: string;
  date: string;
  body: string;
}

export interface DraftExpense {
  emailId: string;
  merchant: string;
  amount: number;
  date: string;
  description: string;
  categoryId: number;
  categoryName: string;
}

export interface ScanEmailsResult {
  expenses: DraftExpense[];
  message?: string;
}
