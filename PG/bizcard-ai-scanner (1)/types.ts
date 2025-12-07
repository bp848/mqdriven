export interface Customer {
  id: string; // uuid
  customer_code?: string; // text
  customer_name: string; // text (Company Name)
  customer_name_kana?: string; // text
  post_no?: string; // text (Zip)
  address_1?: string; // text
  address_2?: string; // text
  phone_number?: string; // text
  fax?: string; // text
  email?: string; // Virtual field for UI, maps to customer_contact_info or note in DB logic if needed, but keeping compliant with schema text
  customer_contact_info?: string; // text (Using this for Email/Contact in this demo)
  website_url?: string; // text
  representative_name?: string; // text (Person Name)
  representative?: string; // text
  zip_code?: string; // text
  note?: string; // text (Job Title usually goes here if no specific column)
  created_at?: string; // text
  updated_at?: string;
}

export type ViewState = 'upload' | 'form' | 'database';

export interface ScanResult {
  extractedData: Partial<Customer>;
  originalImage: string;
}