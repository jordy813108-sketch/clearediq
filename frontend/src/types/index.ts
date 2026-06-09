export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ReceiptStatus = 'pending' | 'processing' | 'reviewed' | 'approved' | 'rejected' | 'escalated';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'admin' | 'reviewer' | 'viewer';
  organization_id: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  receipts_limit: number;
  created_at: string;
}

export interface LineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
}

export interface OCRResult {
  id: string;
  provider?: string;
  confidence_score?: number;
  merchant_name?: string;
  merchant_address?: string;
  transaction_date?: string;
  transaction_time?: string;
  transaction_id?: string;
  subtotal?: number;
  tax_amount?: number;
  tax_rate?: number;
  tip_amount?: number;
  total_amount?: number;
  payment_method?: string;
  card_last_four?: string;
  line_items?: LineItem[];
  field_confidences?: Record<string, number>;
}

export interface FraudFlag {
  id: string;
  flag_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  evidence?: unknown;
  weight?: number;
}

export interface FraudScore {
  id: string;
  overall_score: number;
  risk_level: RiskLevel;
  math_validation_score?: number;
  tax_validation_score?: number;
  timestamp_score?: number;
  duplicate_score?: number;
  merchant_score?: number;
  image_forensics_score?: number;
  metadata_score?: number;
  score_breakdown?: Record<string, number>;
}

export interface Receipt {
  id: string;
  original_filename?: string;
  file_hash?: string;
  file_size_bytes?: number;
  mime_type?: string;
  storage_url?: string;
  status: ReceiptStatus;
  risk_level?: RiskLevel;
  risk_score?: number;
  created_at: string;
  processed_at?: string;
  submitted_by?: User;
  ocr_result?: OCRResult;
  fraud_score?: FraudScore;
  fraud_flags?: FraudFlag[];
  reviewer_notes?: string;
}

export interface ReceiptListItem {
  id: string;
  original_filename?: string;
  status: ReceiptStatus;
  risk_level?: RiskLevel;
  risk_score?: number;
  created_at: string;
  submitted_by?: User;
  merchant_name?: string;
  total_amount?: number;
}

export interface DashboardStats {
  total_receipts: number;
  high_risk_count: number;
  pending_review_count: number;
  auto_approved_count: number;
  flag_rate: number;
  avg_risk_score: number;
  receipts_this_week: number;
}

export interface AnalyticsPoint {
  date: string;
  total: number;
  flagged: number;
  approved: number;
}
