export interface OCRResult {
  merchant_name?: string;
  merchant_address?: string;
  merchant_phone?: string;
  total_amount?: number;
  subtotal?: number;
  tax_amount?: number;
  tip_amount?: number;
  transaction_date?: string;
  transaction_time?: string;
  items?: Array<{ name: string; price: number; quantity?: number }>;
  payment_method?: string;
  card_last_four?: string;
  approval_code?: string;
  transaction_id?: string;
}

export interface FraudFlag {
  gate: number;
  rule: string;
  severity: string;
  score: number;
  title: string;
  detail: string;
}

export interface Receipt {
  id: string;
  status: string;
  risk_level: string;
  fraud_score: number;
  created_at: string;
  updated_at?: string;
  file_url?: string;
  merchant_name?: string;
  merchant_address?: string;
  merchant_phone?: string;
  total_amount?: number;
  subtotal?: number;
  tax_amount?: number;
  tip_amount?: number;
  transaction_date?: string;
  transaction_time?: string;
  items?: Array<{ name: string; price: number; quantity?: number }>;
  payment_method?: string;
  card_last_four?: string;
  approval_code?: string;
  transaction_id?: string;
  ocr_result?: OCRResult;
  fraud_flags?: FraudFlag[];
  gates?: Record<string, number>;
  reviewer_note?: string;
  submitted_by?: string;
  organization_id?: string;
  [key: string]: any;
}

export interface ReceiptListItem {
  id: string;
  status: string;
  risk_level: string;
  fraud_score: number;
  merchant_name?: string;
  total_amount?: number;
  transaction_date?: string;
  created_at: string;
  [key: string]: any;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organization_id: string;
}

export interface Organization {
  id: string;
  name: string;
  plan: string;
  stripe_customer_id?: string;
}

export interface DashboardStats {
  total_receipts: number;
  flagged_receipts: number;
  approved_receipts: number;
  rejected_receipts: number;
  total_amount?: number;
  fraud_prevented?: number;
}

export interface AnalyticsData {
  date: string;
  total: number;
  flagged: number;
  approved: number;
}