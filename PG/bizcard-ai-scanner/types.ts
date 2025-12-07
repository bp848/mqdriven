export interface Customer {
  id: string;
  fullName: string;
  companyName: string;
  jobTitle: string;
  email: string;
  phoneNumber: string;
  address: string;
  website: string;
  scanDate: string;
}

export type ViewState = 'upload' | 'form' | 'database';

export interface ScanResult {
  extractedData: Partial<Customer>;
  originalImage: string;
}