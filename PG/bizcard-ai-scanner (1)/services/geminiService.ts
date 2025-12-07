import { GoogleGenAI, Type } from "@google/genai";
import { Customer } from "../types";
import { resolveEnvValue } from "./env";

const apiKey =
  resolveEnvValue("VITE_GEMINI_API_KEY") ??
  resolveEnvValue("NEXT_PUBLIC_GEMINI_API_KEY") ??
  resolveEnvValue("GEMINI_API_KEY") ??
  resolveEnvValue("API_KEY");

if (!apiKey) {
  console.warn("Gemini API key is not configured. Set VITE_GEMINI_API_KEY or NEXT_PUBLIC_GEMINI_API_KEY.");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const extractBusinessCardData = async (base64Image: string): Promise<Partial<Customer>> => {
  try {
    if (!ai) {
      throw new Error("Gemini API is not configured.");
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: `Extract business card information and map it to the following database schema structure (JSON).
            
            Mapping Rules:
            - customer_name: Company Name
            - representative_name: Person's Full Name
            - customer_name_kana: Company Name in Katakana (guess if not present)
            - note: Job Title
            - customer_contact_info: Email Address
            - phone_number: Phone Number
            - zip_code: Postal Code
            - address_1: Full Address
            - website_url: Website URL
            
            Return empty strings for missing fields.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customer_name: { type: Type.STRING, description: "Company organization name" },
            representative_name: { type: Type.STRING, description: "Full name of the person" },
            customer_name_kana: { type: Type.STRING, description: "Katakana reading of company" },
            note: { type: Type.STRING, description: "Job title and other notes" },
            customer_contact_info: { type: Type.STRING, description: "Email address" },
            phone_number: { type: Type.STRING, description: "Phone number" },
            zip_code: { type: Type.STRING, description: "Postal code" },
            address_1: { type: Type.STRING, description: "Physical address" },
            website_url: { type: Type.STRING, description: "Website URL" },
          },
          required: ["customer_name", "representative_name"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini");

    return JSON.parse(text) as Partial<Customer>;
  } catch (error) {
    console.error("OCR Extraction Error:", error);
    throw error;
  }
};
