
export interface FormData {
  purpose: string;
  referenceInfo: string;
  targetIndustry: string;
  customerName: string;
  salesRepName: string;
  pageCount: number;
  graphCount: number;
  imageCount: number;
  deepResearch: boolean;
}

export interface GraphDataPoint {
  name: string;
  value: number;
}

export interface Slide {
  title: string;
  content: string[];
  graph?: {
    type: 'bar' | 'line' | 'pie';
    dataDescription: string;
    data: GraphDataPoint[];
  };
  image?: {
    description: string;
  };
  imageUrl?: string;
  evidence?: string;
  speakerNotes: string;
}

export interface Presentation {
  title: string;
  slides: Slide[];
}

export interface Source {
  title: string;
  uri: string;
}

export interface GenerationResult {
    presentation: Presentation;
    sources: Source[] | null;
}
