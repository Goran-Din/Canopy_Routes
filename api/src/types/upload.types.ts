// api/src/types/upload.types.ts
// Type definitions for CSV upload pipeline
// Last modified: 2026-03-05

export interface RawCsvRow {
  client_name: string;
  service_address: string;
  city: string;
  state: string;
  zip: string;
  acres: string;
  client_type?: string;
  acreage_confirmed?: string;
  service_frequency?: string;
  client_status?: string;
  annual_revenue?: string;
  snow_service?: string;
  snow_contract_type?: string;
  prior_route?: string;
  prior_day?: string;
  prior_crew?: string;
  time_constraints?: string;
  access_notes?: string;
  billing_accounts?: string;
  external_id?: string;
  notes?: string;
}

export interface ValidatedRow {
  clientName: string;
  serviceAddress: string;
  city: string;
  state: string;
  zip: string;
  acres: number;
  clientType: 'residential' | 'commercial';
  acreageConfirmed: boolean;
  serviceFrequency: 'weekly' | 'biweekly' | 'monthly' | 'as_needed';
  clientStatus: 'confirmed' | 'pending' | 'new' | 'at_risk' | 'inactive';
  annualRevenue: number | null;
  snowService: boolean;
  snowContractType: 'monthly_fixed' | 'per_run' | 'none';
  priorRoute: string | null;
  priorDay: string | null;
  priorCrew: string | null;
  timeConstraints: string | null;
  accessNotes: string | null;
  billingAccounts: number;
  externalId: string | null;
  propertyNotes: string | null;
  rowNumber: number;
  warnings: string[];
}

export interface ValidationResult {
  valid: ValidatedRow[];
  errors: Array<{ rowNumber: number; clientName: string; serviceAddress: string; errorMessage: string }>;
  warnings: Array<{ rowNumber: number; field: string; warningMessage: string }>;
}

export interface UploadJobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  progress: number;
  total: number;
  imported: number;
  failed: number;
  errorRows: Array<{ rowNumber: number; clientName: string; serviceAddress: string; errorMessage: string }>;
  completedAt: string | null;
}
