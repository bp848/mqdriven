import { GoogleGenAI, Type } from "@google/genai";
import { Customer } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractBusinessCardData = async (base64Image: string): Promise<Partial<Customer>> => {
  try {
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
            text: "Extract the following business card information into JSON format. If a field is missing, leave it as an empty string. Attempt to fix common OCR errors.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullName: { type: Type.STRING, description: "Full name of the person" },
            companyName: { type: Type.STRING, description: "Company organization name" },
            jobTitle: { type: Type.STRING, description: "Job title or position" },
            email: { type: Type.STRING, description: "Email address" },
            phoneNumber: { type: Type.STRING, description: "Phone number" },
            address: { type: Type.STRING, description: "Physical address" },
            website: { type: Type.STRING, description: "Website URL" },
          },
          required: ["fullName", "companyName"],
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