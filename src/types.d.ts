// Type declarations for modules without types
declare module '../src/envShim' {
  export const GEMINI_API_KEY: string;
  export const IS_AI_DISABLED: boolean;
}

declare module '*.ts' {
  const content: any;
  export default content;
}

declare module '*.js' {
  const content: any;
  export default content;
}

// For Vite environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    VITE_GEMINI_API_KEY?: string;
    VITE_AI_OFF?: string;
    NEXT_PUBLIC_AI_OFF?: string;
    VITE_IS_AI_DISABLED?: string;
  }
}

// For browser globals
interface Window {
  __ENV?: {
    VITE_GEMINI_API_KEY?: string;
    VITE_AI_OFF?: string;
    NEXT_PUBLIC_AI_OFF?: string;
    VITE_IS_AI_DISABLED?: string;
  };
  GEMINI_API_KEY?: string;
  IS_AI_DISABLED?: boolean;
}

// For Vite client types
/// <reference types="vite/client" />

// Type for response with possible text property
interface ResponseWithText extends Response {
  text(): Promise<string>;
}

type UUID = string;

type AISuggestions = {
  title: string;
  description: string;
  suggestedItems: Array<{
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
    description?: string;
  }>;
  notes?: string;
};

type CompanyAnalysis = {
  summary: string;
  industry: string;
  size: string;
  potential: string;
  recommendations: string[];
};

type AIJournalSuggestion = {
  account: string;
  amount: number;
  description: string;
  taxRate?: number;
  taxType?: 'inclusive' | 'exclusive';
};

type GeneratedEmailContent = {
  subject: string;
  body: string;
};

type CompanyInvestigation = {
  companyName: string;
  industry: string;
  businessType: string;
  companySize: string;
  location: string;
  website?: string;
  summary: string;
  services: string[];
  potentialCollaboration: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  };
};
