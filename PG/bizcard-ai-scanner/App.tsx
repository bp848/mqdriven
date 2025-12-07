import React, { useState } from 'react';
import { extractBusinessCardData } from './services/geminiService';
import { Header } from './components/Header';
import { DatabaseView } from './components/DatabaseView';
import { ScanForm } from './components/ScanForm';
import { Customer, ViewState } from './types';
import { UploadCloud, Loader2, Zap } from 'lucide-react';

// Sample data to populate the "Database" initially
const SAMPLE_DATA: Customer[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    fullName: "Alice Johnson",
    companyName: "Tech Innovations Inc.",
    jobTitle: "Product Manager",
    email: "alice.j@techinnovations.com",
    phoneNumber: "+1 (555) 123-4567",
    address: "123 Innovation Dr, San Francisco, CA",
    website: "www.techinnovations.com",
    scanDate: "2023-10-25T10:00:00Z"
  },
  {
    id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    fullName: "Bob Smith",
    companyName: "Global Solutions Ltd.",
    jobTitle: "CTO",
    email: "bsmith@globalsolutions.com",
    phoneNumber: "+44 20 7946 0958",
    address: "456 Enterprise Way, London, UK",
    website: "www.globalsolutions.co.uk",
    scanDate: "2023-10-26T14:30:00Z"
  }
];

export default function App() {
  const [view, setView] = useState<ViewState>('upload');
  const [customers, setCustomers] = useState<Customer[]>(SAMPLE_DATA);
  const [processing, setProcessing] = useState(false);
  
  // Staging state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<Partial<Customer>>({});

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    
    // 1. Convert to Base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      setCapturedImage(base64String);

      try {
        // 2. Call Gemini
        const data = await extractBusinessCardData(base64Data);
        setExtractedData(data);
        setView('form');
      } catch (err) {
        alert("Failed to extract text. Please try a clearer image.");
        console.error(err);
      } finally {
        setProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCustomer = (newCustomer: Customer) => {
    setCustomers(prev => [newCustomer, ...prev]);
    setView('database');
    setCapturedImage(null);
    setExtractedData({});
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header currentView={view} setView={setView} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {processing && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <div className="relative">
                <div className="absolute inset-0 bg-indigo-200 rounded-full animate-ping opacity-75"></div>
                <div className="relative bg-white p-4 rounded-full shadow-xl">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                </div>
            </div>
            <h3 className="mt-6 text-xl font-semibold text-gray-800">Processing with Gemini 2.5...</h3>
            <p className="text-gray-500 mt-2">Extracting text entities and formatting JSON</p>
          </div>
        )}

        {view === 'upload' && !processing && (
          <div className="max-w-2xl mx-auto mt-12 animate-in zoom-in-95 duration-500">
             <div className="text-center mb-10">
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl mb-4">
                  Turn Business Cards into <br/>
                  <span className="text-indigo-600">Actionable Data</span>
                </h1>
                <p className="text-lg text-gray-600 max-w-lg mx-auto">
                  Upload a photo of a business card. Our AI will extract the details and prepare them for your CRM database instantly.
                </p>
             </div>

            <label className="group relative flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-gray-300 rounded-3xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition-all duration-300 bg-white shadow-sm">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <UploadCloud className="w-10 h-10 text-indigo-600" />
                </div>
                <p className="mb-2 text-xl font-semibold text-gray-700 group-hover:text-indigo-700">Click to upload</p>
                <p className="text-sm text-gray-500">or drag and drop PNG, JPG (MAX. 5MB)</p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={handleFileUpload}
              />
              <div className="absolute bottom-6 flex gap-4 text-xs text-gray-400 font-medium">
                <span className="flex items-center gap-1"><Zap className="w-3 h-3"/> Fast Extraction</span>
                <span className="flex items-center gap-1"><Zap className="w-3 h-3"/> 99% Accuracy</span>
              </div>
            </label>
          </div>
        )}

        {view === 'form' && (
          <ScanForm 
            initialData={extractedData} 
            imageData={capturedImage}
            onSave={handleSaveCustomer}
            onCancel={() => setView('upload')}
          />
        )}

        {view === 'database' && (
          <DatabaseView customers={customers} />
        )}

      </main>
    </div>
  );
}