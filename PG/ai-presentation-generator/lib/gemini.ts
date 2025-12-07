
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { FormData, GenerationResult, Presentation, Source } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY, vertexai: true });

const presentationSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'The main title of the presentation.' },
    slides: {
      type: Type.ARRAY,
      description: 'An array of slide objects.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'The title of the slide.' },
          content: {
            type: Type.ARRAY,
            description: 'An array of strings, where each string is a paragraph or a bullet point. Use markdown for formatting (e.g., `- ` for bullet points).',
            items: { type: Type.STRING }
          },
          graph: {
            type: Type.OBJECT,
            nullable: true,
            description: 'Optional. A description and data for a graph to be included on this slide.',
            properties: {
              type: { type: Type.STRING, enum: ['bar', 'line', 'pie'], description: 'Suggested graph type.' },
              dataDescription: { type: Type.STRING, description: 'A description of the data the graph should visualize.' },
              data: {
                type: Type.ARRAY,
                description: 'An array of sample data points for the chart. Use 3-5 data points.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: 'The label for the data point (e.g., a year, a category).' },
                        value: { type: Type.NUMBER, description: 'The numerical value for the data point.' }
                    },
                    required: ['name', 'value']
                }
              }
            },
            required: ['type', 'dataDescription', 'data']
          },
          image: {
            type: Type.OBJECT,
            nullable: true,
            description: 'Optional. A description of a photograph or illustration to be generated for this slide.',
            properties: {
                description: {
                    type: Type.STRING,
                    description: 'A detailed, descriptive prompt for an image generation AI.'
                }
            }
          },
          evidence: {
            type: Type.STRING,
            nullable: true,
            description: 'If Deep Research is used, provide a key statistic or finding from the research that supports this slide\'s content. Include the source number, like "(Source 1)".'
          },
          speakerNotes: { type: Type.STRING, description: 'Concise notes for the presenter for this slide.' }
        },
        required: ['title', 'content', 'speakerNotes']
      }
    },
  },
  required: ['title', 'slides']
};


const buildPrompt = (formData: FormData): string => {
  let prompt = `
You are an expert business consultant creating a professional presentation. Generate the content for the presentation based on the following specifications.
Your entire response MUST be a single, valid JSON object that adheres to the schema I provide. Do not include any other text, explanations, or markdown formatting around the JSON.

**Presentation Specifications:**
- **Primary Goal/Purpose:** ${formData.purpose}
- **Target Audience/Industry:** ${formData.targetIndustry || 'Not specified'}
- **Client/Customer Name:** ${formData.customerName || 'Not specified'}
- **Presenter/Sales Rep:** ${formData.salesRepName || 'Not specified'}
- **Total Number of Slides:** Approximately ${formData.pageCount}
- **Number of Graphs/Charts to Include:** ${formData.graphCount}
- **Number of Images to Include:** ${formData.imageCount}
- **Reference Information & Keywords:**
  ${formData.referenceInfo}

**Instructions:**
1.  Create a compelling presentation title and structure the content into logical slides.
2.  The number of slides should be close to the requested count.
3.  Distribute the ${formData.graphCount} graphs and ${formData.imageCount} images across the most relevant slides.
    - For each graph, specify a suitable type ('bar', 'line', or 'pie'), describe the data, and provide an array of 3-5 sample data points in the format \`{ "name": "label", "value": 123 }\`.
    - For each image, provide a detailed, descriptive prompt suitable for an image generation AI.
4.  The content for each slide should be an array of strings, with each string being a paragraph or a bullet point. Use markdown for bullet points (e.g., "- Point 1").
5.  Provide concise speaker notes for each slide.
`;

  if (formData.deepResearch) {
    prompt += `
**Deep Research Instructions:**
- You MUST use Google Search to find the latest information, statistics, and trends relevant to the topic.
- For slides that contain information derived from your research, you MUST populate the 'evidence' field with a key statistic or finding. This text should reference the source number, which will correspond to the source list (e.g., "Market growth is projected at 15% annually (Source 1).").
- All claims based on search results must be backed up by the sources found. The final API response will contain the source URLs.
`;
  }

  return prompt;
};

export const generatePresentation = async (
    formData: FormData,
    onAction: (action: string) => void
): Promise<GenerationResult> => {
  onAction('Initializing presentation generation...');
  const prompt = buildPrompt(formData);
  onAction('Prompt constructed for AI.');
  
  const config: any = {
    temperature: 0.7,
    topP: 0.95,
    topK: 64,
  };

  const requestPayload: any = {
    model: 'gemini-2.5-flash',
    contents: { role: 'user', parts: [{ text: prompt }] },
    config: config,
  };

  if (formData.deepResearch) {
    requestPayload.config.tools = [{ googleSearch: {} }];
  } else {
    requestPayload.config.responseMimeType = 'application/json';
    requestPayload.config.responseSchema = presentationSchema;
  }

  try {
    onAction('Requesting presentation structure from Gemini...');
    const response: GenerateContentResponse = await ai.models.generateContent(requestPayload);
    onAction('Presentation structure received.');
    
    const responseText = response.text;
    let presentation: Presentation;

    try {
        const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        presentation = JSON.parse(cleanedText);
        onAction('JSON structure parsed successfully.');
    } catch (e) {
        console.error("Failed to parse JSON response:", responseText);
        throw new Error("The AI returned an invalid format. Please try again.");
    }

    const imagePrompts = presentation.slides
        .map((slide, index) => ({
            prompt: slide.image?.description,
            index: index,
        }))
        .filter((p): p is { prompt: string; index: number } => !!p.prompt);

    if (imagePrompts.length > 0) {
        onAction(`Found ${imagePrompts.length} image(s) to generate.`);
        const imageGenerationPromises = imagePrompts.map(async (p, i) => {
            onAction(`[${i + 1}/${imagePrompts.length}] Generating image: "${p.prompt}"`);
            try {
                const imageResponse = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: p.prompt,
                    config: {
                        numberOfImages: 1,
                        outputMimeType: 'image/jpeg',
                        aspectRatio: '16:9',
                    },
                });
                const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
                onAction(`[${i + 1}/${imagePrompts.length}] Image generated successfully.`);
                return {
                    index: p.index,
                    imageUrl: `data:image/jpeg;base64,${base64ImageBytes}`,
                };
            } catch (error) {
                console.error(`Failed to generate image for slide ${p.index}:`, error);
                onAction(`[${i + 1}/${imagePrompts.length}] Failed to generate image. Skipping.`);
                return null;
            }
        });

        const generatedImages = (await Promise.all(imageGenerationPromises)).filter(Boolean);

        generatedImages.forEach(imgResult => {
            if (imgResult) {
                presentation.slides[imgResult.index].imageUrl = imgResult.imageUrl;
            }
        });
        onAction('All images have been processed.');
    } else {
        onAction('No images requested for this presentation.');
    }

    let sources: Source[] | null = null;
    if (formData.deepResearch && response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        sources = response.candidates[0].groundingMetadata.groundingChunks
            .filter(chunk => chunk.web)
            .map((chunk, index) => ({
                title: `(Source ${index + 1}) ${chunk.web?.title || 'Untitled Source'}`,
                uri: chunk.web?.uri || '#',
            }));
        onAction('Research sources extracted.');
    }
    
    onAction('Presentation generation complete!');
    return { presentation, sources };

  } catch (error) {
    console.error("Error generating presentation:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate presentation: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the presentation.");
  }
};
