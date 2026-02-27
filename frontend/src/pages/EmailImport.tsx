import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Mail,
  FileSpreadsheet,
  Sparkles,
  Check,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useScanEmails } from '../hooks/useReceiptAnalysis';
import { useCreateExpense } from '../hooks/useExpenses';
import { useCategories } from '../hooks/useCategories';
import type { EmailData, DraftExpense, CreateExpenseData } from '../types';

type WizardStep = 'upload' | 'scanning' | 'review' | 'complete';

export function EmailImport() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [draftExpenses, setDraftExpenses] = useState<DraftExpense[]>([]);
  const [currentExpenseIndex, setCurrentExpenseIndex] = useState(0);
  const [editingExpense, setEditingExpense] = useState<DraftExpense | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  const scanEmailsMutation = useScanEmails();
  const createExpenseMutation = useCreateExpense();
  const { data: categories } = useCategories();

  // Parse entire CSV content handling multiline quoted fields
  const parseCsv = (content: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (inQuotes) {
        if (char === '"') {
          // Check for escaped quote (double quote)
          if (content[i + 1] === '"') {
            currentField += '"';
            i++; // Skip the next quote
          } else {
            // End of quoted field
            inQuotes = false;
          }
        } else {
          // Include any character (including newlines) inside quotes
          currentField += char;
        }
      } else {
        if (char === '"') {
          // Start of quoted field
          inQuotes = true;
        } else if (char === ',') {
          // End of field
          currentRow.push(currentField.trim());
          currentField = '';
        } else if (char === '\n' || char === '\r') {
          // Handle CRLF
          if (char === '\r' && content[i + 1] === '\n') {
            i++; // Skip the \n in CRLF
          }
          // End of row
          currentRow.push(currentField.trim());
          if (currentRow.some((field) => field !== '')) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }

    // Don't forget the last field/row
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((field) => field !== '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const rows = parseCsv(content);

        if (rows.length < 2) {
          setParseError('CSV file must have a header row and at least one data row');
          setEmails([]);
          return;
        }

        // Parse header row
        const headers = rows[0].map((h) => h.toLowerCase());

        // Expected headers: id, from, to, subject, date, body, threadId
        const requiredHeaders = ['id', 'from', 'subject', 'date', 'body'];
        const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
        if (missingHeaders.length > 0) {
          setParseError(`CSV is missing required columns: ${missingHeaders.join(', ')}`);
          setEmails([]);
          return;
        }

        // Get column indices
        const idIndex = headers.indexOf('id');
        const fromIndex = headers.indexOf('from');
        const subjectIndex = headers.indexOf('subject');
        const dateIndex = headers.indexOf('date');
        const bodyIndex = headers.indexOf('body');

        // Parse data rows
        const parsedEmails: EmailData[] = [];
        for (let i = 1; i < rows.length; i++) {
          const values = rows[i];

          // Skip rows with insufficient columns
          if (values.length < headers.length) continue;

          const email: EmailData = {
            id: values[idIndex] || `row-${i}`,
            from: values[fromIndex] || '',
            subject: values[subjectIndex] || '',
            date: values[dateIndex] || '',
            body: values[bodyIndex] || '',
          };

          // Validate required fields (body can be empty for some emails)
          if (!email.from || !email.subject || !email.date) {
            setParseError(`Row ${i + 1} is missing required data (from, subject, date)`);
            setEmails([]);
            return;
          }

          parsedEmails.push(email);
        }

        if (parsedEmails.length === 0) {
          setParseError('No valid email rows found in CSV');
          setEmails([]);
          return;
        }

        setEmails(parsedEmails);
      } catch {
        setParseError('Failed to parse CSV file');
        setEmails([]);
      }
    };
    reader.readAsText(file);
  };

  const handleStartScan = async () => {
    if (emails.length === 0) return;

    setCurrentStep('scanning');

    try {
      const result = await scanEmailsMutation.mutateAsync(emails);
      setDraftExpenses(result.expenses);
      setCurrentStep('review');
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to scan emails');
      setCurrentStep('upload');
    }
  };

  const handleImportExpense = async (expense: DraftExpense) => {
    const expenseData: CreateExpenseData = {
      categoryId: expense.categoryId,
      amount: expense.amount,
      description: expense.description,
      date: expense.date,
    };

    try {
      await createExpenseMutation.mutateAsync(expenseData);
      setImportedCount((prev) => prev + 1);
      moveToNextExpense();
    } catch (error) {
      console.error('Failed to import expense:', error);
    }
  };

  const handleSkipExpense = () => {
    setSkippedCount((prev) => prev + 1);
    moveToNextExpense();
  };

  const moveToNextExpense = () => {
    if (currentExpenseIndex < draftExpenses.length - 1) {
      setCurrentExpenseIndex((prev) => prev + 1);
      setEditingExpense(null);
    } else {
      setCurrentStep('complete');
    }
  };

  const handleEditExpense = (expense: DraftExpense) => {
    setEditingExpense({ ...expense });
  };

  const handleSaveEdit = () => {
    if (!editingExpense) return;

    setDraftExpenses((prev) =>
      prev.map((e, i) => (i === currentExpenseIndex ? editingExpense : e))
    );
    setEditingExpense(null);
  };

  const currentExpense = draftExpenses[currentExpenseIndex];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">AI Email Import</h1>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          {[
            { key: 'upload', label: 'Upload', icon: Upload },
            { key: 'scanning', label: 'Scanning', icon: Sparkles },
            { key: 'review', label: 'Review', icon: Pencil },
            { key: 'complete', label: 'Complete', icon: Check },
          ].map((step, index, arr) => {
            const stepIndex = arr.findIndex((s) => s.key === currentStep);
            const isComplete = index < stepIndex;
            const isCurrent = step.key === currentStep;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    isComplete || isCurrent
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    isComplete || isCurrent ? 'text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
                {index < arr.length - 1 && <div className="mx-4 h-0.5 w-16 bg-gray-200" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {currentStep === 'upload' && (
          <UploadStep
            fileInputRef={fileInputRef}
            fileName={fileName}
            emails={emails}
            parseError={parseError}
            onFileChange={handleFileChange}
            onStartScan={handleStartScan}
            isLoading={scanEmailsMutation.isPending}
          />
        )}

        {currentStep === 'scanning' && <ScanningStep />}

        {currentStep === 'review' && currentExpense && (
          <ReviewStep
            expense={editingExpense || currentExpense}
            isEditing={!!editingExpense}
            currentIndex={currentExpenseIndex}
            totalCount={draftExpenses.length}
            categories={categories || []}
            onEdit={() => handleEditExpense(currentExpense)}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={() => setEditingExpense(null)}
            onUpdateExpense={(updates) =>
              setEditingExpense((prev) => (prev ? { ...prev, ...updates } : null))
            }
            onImport={() => handleImportExpense(editingExpense || currentExpense)}
            onSkip={handleSkipExpense}
            isImporting={createExpenseMutation.isPending}
          />
        )}

        {currentStep === 'review' && !currentExpense && draftExpenses.length === 0 && (
          <div className="text-center py-12">
            <Mail className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No Receipts Found</h3>
            <p className="mt-2 text-sm text-gray-500">
              No receipt emails were found in the uploaded data.
            </p>
            <button
              onClick={() => {
                setCurrentStep('upload');
                setEmails([]);
                setFileName('');
              }}
              className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Try Again
            </button>
          </div>
        )}

        {currentStep === 'complete' && (
          <CompleteStep
            importedCount={importedCount}
            skippedCount={skippedCount}
            onViewExpenses={() => navigate('/expenses')}
            onStartOver={() => {
              setCurrentStep('upload');
              setEmails([]);
              setFileName('');
              setDraftExpenses([]);
              setCurrentExpenseIndex(0);
              setImportedCount(0);
              setSkippedCount(0);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Upload Step Component
interface UploadStepProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  fileName: string;
  emails: EmailData[];
  parseError: string | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartScan: () => void;
  isLoading: boolean;
}

function UploadStep({
  fileInputRef,
  fileName,
  emails,
  parseError,
  onFileChange,
  onStartScan,
  isLoading,
}: UploadStepProps) {
  return (
    <div className="text-center py-8">
      <FileSpreadsheet className="mx-auto h-16 w-16 text-indigo-400" />
      <h2 className="mt-4 text-xl font-medium text-gray-900">Upload Email Data</h2>
      <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
        Upload a CSV file containing email data. The AI will analyze the emails to identify
        receipts and extract expense information.
      </p>

      <div className="mt-6">
        <label className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
          <Upload className="w-5 h-5 mr-2" />
          Select CSV File
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            onChange={onFileChange}
            className="hidden"
          />
        </label>
      </div>

      {fileName && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            File: <span className="font-medium">{fileName}</span>
          </p>
          {emails.length > 0 && (
            <p className="text-sm text-green-600 mt-1">
              <Check className="w-4 h-4 inline mr-1" />
              {emails.length} emails loaded
            </p>
          )}
        </div>
      )}

      {parseError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700 flex items-center justify-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {parseError}
          </p>
        </div>
      )}

      {emails.length > 0 && (
        <div className="mt-6">
          <button
            onClick={onStartScan}
            disabled={isLoading}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {isLoading ? 'Scanning...' : 'Scan for Receipts'}
          </button>
        </div>
      )}

      {/* Example Format */}
      <div className="mt-8 text-left max-w-2xl mx-auto">
        <p className="text-sm font-medium text-gray-700 mb-2">Expected CSV format:</p>
        <pre className="bg-gray-50 p-4 rounded-md text-xs text-gray-600 overflow-x-auto whitespace-pre">
{`id,from,to,subject,date,body,threadId
email-1,receipts@store.com,user@email.com,Your Order,2024-01-15,"Thank you for your purchase...",thread-1`}
        </pre>
        <p className="mt-2 text-xs text-gray-500">
          Required columns: id, from, subject, date, body
        </p>
      </div>
    </div>
  );
}

// Scanning Step Component
function ScanningStep() {
  return (
    <div className="text-center py-12">
      <div className="relative mx-auto w-16 h-16">
        <Sparkles className="w-16 h-16 text-indigo-400 animate-pulse" />
      </div>
      <h2 className="mt-4 text-xl font-medium text-gray-900">Scanning Emails...</h2>
      <p className="mt-2 text-sm text-gray-500">
        AI is analyzing your emails to identify receipts and extract expense data.
      </p>
      <div className="mt-4">
        <div className="w-48 h-2 bg-gray-200 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-indigo-600 rounded-full animate-[loading_2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}

// Review Step Component
interface ReviewStepProps {
  expense: DraftExpense;
  isEditing: boolean;
  currentIndex: number;
  totalCount: number;
  categories: { id: number; name: string }[];
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onUpdateExpense: (updates: Partial<DraftExpense>) => void;
  onImport: () => void;
  onSkip: () => void;
  isImporting: boolean;
}

function ReviewStep({
  expense,
  isEditing,
  currentIndex,
  totalCount,
  categories,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onUpdateExpense,
  onImport,
  onSkip,
  isImporting,
}: ReviewStepProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">Review Expense</h2>
        <span className="text-sm text-gray-500">
          {currentIndex + 1} of {totalCount}
        </span>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        {isEditing ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Merchant</label>
              <input
                type="text"
                value={expense.merchant}
                onChange={(e) => onUpdateExpense({ merchant: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input
                type="number"
                step="0.01"
                value={expense.amount}
                onChange={(e) => onUpdateExpense({ amount: parseFloat(e.target.value) || 0 })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={expense.date}
                onChange={(e) => onUpdateExpense({ date: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={expense.description}
                onChange={(e) => onUpdateExpense({ description: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select
                value={expense.categoryId}
                onChange={(e) => {
                  const cat = categories.find((c) => c.id === parseInt(e.target.value));
                  onUpdateExpense({
                    categoryId: parseInt(e.target.value),
                    categoryName: cat?.name || expense.categoryName,
                  });
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Merchant</span>
              <span className="text-sm font-medium text-gray-900">{expense.merchant}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Amount</span>
              <span className="text-sm font-medium text-gray-900">${expense.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Date</span>
              <span className="text-sm font-medium text-gray-900">{expense.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Description</span>
              <span className="text-sm font-medium text-gray-900">{expense.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Category</span>
              <span className="text-sm font-medium text-gray-900">{expense.categoryName}</span>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <div>
          {isEditing ? (
            <div className="space-x-2">
              <button
                onClick={onSaveEdit}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                Save
              </button>
              <button
                onClick={onCancelEdit}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={onEdit}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </button>
          )}
        </div>

        <div className="space-x-2">
          <button
            onClick={onSkip}
            disabled={isEditing}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Skip
          </button>
          <button
            onClick={onImport}
            disabled={isEditing || isImporting}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isImporting ? (
              'Importing...'
            ) : (
              <>
                Import
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Complete Step Component
interface CompleteStepProps {
  importedCount: number;
  skippedCount: number;
  onViewExpenses: () => void;
  onStartOver: () => void;
}

function CompleteStep({ importedCount, skippedCount, onViewExpenses, onStartOver }: CompleteStepProps) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
        <Check className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="mt-4 text-xl font-medium text-gray-900">Import Complete!</h2>
      <p className="mt-2 text-sm text-gray-500">
        Successfully imported <span className="font-semibold">{importedCount}</span> expenses
        {skippedCount > 0 && (
          <span>
            {' '}
            (<span className="text-gray-400">{skippedCount} skipped</span>)
          </span>
        )}
      </p>

      <div className="mt-6 space-x-4">
        <button
          onClick={onViewExpenses}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          View Expenses
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>
        <button
          onClick={onStartOver}
          className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
        >
          Import More
        </button>
      </div>
    </div>
  );
}
