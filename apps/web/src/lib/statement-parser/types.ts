export interface PdfTextItem {
  text: string;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface PdfLine {
  page: number;
  y: number;
  items: PdfTextItem[];
  text: string;
}

export interface ParsedTransaction {
  date: string;
  description: string;
  amountMinor: number;
  kind: 'expense' | 'income';
  balanceMinor?: number;
  sourcePage: number;
  confidence: number;
  sourceItems?: PdfTextItem[];
  directionAmbiguous?: boolean;
  classification?: {
    isTransaction: boolean;
    category: 'FOOD' | 'GROCERIES' | 'SHOPPING' | 'TRANSPORT' | 'UTILITIES' | 'RENT' | 'EMI' | 'TRANSFER' | 'SALARY' | 'INVESTMENT' | 'HEALTHCARE' | 'ENTERTAINMENT' | 'FEES' | 'OTHER';
    categoryConfidence?: number;
    needsReview: boolean;
  };
}

export interface ReconciliationResult {
  status: 'passed' | 'warning' | 'failed' | 'unavailable';
  openingBalanceMinor?: number;
  closingBalanceMinor?: number;
  extractedDebitsMinor: number;
  extractedCreditsMinor: number;
  statedDebitsMinor?: number;
  statedCreditsMinor?: number;
  differenceMinor?: number;
  issues: string[];
  balanceConvention?: 'bank' | 'credit-card';
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  reconciliation: ReconciliationResult;
  unparsedRows: number;
  issues: string[];
  diagnostics: {
    status: 'no_text_layer' | 'no_transaction_table' | 'candidate_rows_rejected' | 'rows_found';
    candidateRows: number;
    rejectedRows: number;
    detection: 'labeled' | 'inferred' | 'none';
    rejectionReasons: {date: number; description: number; amount: number; direction: number};
  };
}
