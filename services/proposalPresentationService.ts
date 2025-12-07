import { Type, GenerateContentResponse } from '@google/genai';
import {
  ProposalFormData,
  ProposalGenerationResult,
  ProposalPresentation,
  ProposalSource,
} from '../types';
import { GEMINI_DEFAULT_MODEL, isGeminiAIDisabled, requireGeminiClient } from './Gemini';

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
            description: 'Paragraphs or bullet points for this slide. Bullet points should start with "- ".',
            items: { type: Type.STRING },
          },
          graph: {
            type: Type.OBJECT,
            nullable: true,
            description: 'Optional chart suggestion with sample data.',
            properties: {
              type: { type: Type.STRING, enum: ['bar', 'line', 'pie'], description: 'Suggested chart type.' },
              dataDescription: { type: Type.STRING, description: 'Description of the dataset visualized.' },
              data: {
                type: Type.ARRAY,
                description: 'Sample datapoints (3-5 entries).',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: 'Label for the datapoint (category, year, etc.)' },
                    value: { type: Type.NUMBER, description: 'Numeric value for the datapoint.' },
                  },
                  required: ['name', 'value'],
                },
              },
            },
            required: ['type', 'dataDescription', 'data'],
          },
          image: {
            type: Type.OBJECT,
            nullable: true,
            description: 'Optional prompt describing an image to generate for this slide.',
            properties: {
              description: { type: Type.STRING, description: 'Prompt for an image generation model.' },
            },
          },
          evidence: {
            type: Type.STRING,
            nullable: true,
            description:
              "Key statistic or finding derived from Deep Research. Include source number like '(Source 1)'.",
          },
          speakerNotes: { type: Type.STRING, description: 'Presenter notes for this slide.' },
        },
        required: ['title', 'content', 'speakerNotes'],
      },
    },
  },
  required: ['title', 'slides'],
};

const ensureAIReady = () => {
  if (isGeminiAIDisabled) {
    throw new Error('AI機能は現在無効です。');
  }
  return requireGeminiClient();
};

const buildPrompt = (formData: ProposalFormData): string => {
  let prompt = `
You are an expert business consultant creating a professional presentation deck in Japanese.
Generate presentation content that strictly follows the JSON schema provided later in this prompt. Output only valid JSON.

Specifications:
- Primary Goal/Purpose: ${formData.purpose}
- Target Audience/Industry: ${formData.targetIndustry || 'Not specified'}
- Client/Customer Name: ${formData.customerName || 'Not specified'}
- Presenter/Sales Rep: ${formData.salesRepName || 'Not specified'}
- Approximate Slide Count: ${formData.pageCount}
- Required Graph Count: ${formData.graphCount}
- Required Image Count: ${formData.imageCount}
- Reference Info & Keywords:
${formData.referenceInfo}

Instructions:
1. Create a compelling presentation title and structure with logical sections.
2. Keep the slide count close to the requested value.
3. Distribute the ${formData.graphCount} graph(s) and ${formData.imageCount} image(s) on the most relevant slides.
   - For each graph, specify the type (bar, line, pie), describe the data, and include 3-5 sample data points.
   - For each image, provide a detailed prompt for image generation.
4. Slide content should be an array of strings. Use '- ' for bullet points where appropriate.
5. Provide concise speaker notes for each slide.
`;

  if (formData.deepResearch) {
    prompt += `
Deep Research instructions:
- Use Google Search to gather the latest statistics and market intel.
- Populate the 'evidence' field with key statistics that include a source reference like "(Source 1)".
- The grounding metadata must allow us to map each evidence entry to the correct source list.
`;
  }

  return prompt;
};

const stripMarkdownFence = (text: string): string => {
  if (text.startsWith('```')) {
    return text.replace(/```json/gi, '').replace(/```/g, '').trim();
  }
  return text.trim();
};

export const generateProposal = async (
  formData: ProposalFormData,
  onAction: (message: string) => void,
): Promise<ProposalGenerationResult> => {
  const aiClient = ensureAIReady();
  onAction('提案書の生成を開始します...');

  const prompt = buildPrompt(formData);
  onAction('プロンプトを整備しました。Geminiへ送信します。');

  const config: Record<string, unknown> = {
    temperature: 0.7,
    topP: 0.95,
    topK: 64,
  };

  const requestPayload: {
    model: string;
    contents: { role: string; parts: { text: string }[] }[];
    config: Record<string, unknown>;
  } = {
    model: GEMINI_DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config,
  };

  if (formData.deepResearch) {
    config.tools = [{ googleSearch: {} }];
  } else {
    config.responseMimeType = 'application/json';
    config.responseSchema = presentationSchema;
  }

  let response: GenerateContentResponse;
  try {
    response = await aiClient.models.generateContent(requestPayload);
    onAction('スライド構成案を受信しました。');
  } catch (error) {
    console.error('Failed to request presentation structure:', error);
    throw new Error('提案書の構成取得に失敗しました。時間をおいて再度お試しください。');
  }

  const rawText = response.text ?? '';
  let presentation: ProposalPresentation;
  try {
    const cleanedText = stripMarkdownFence(rawText);
    presentation = JSON.parse(cleanedText) as ProposalPresentation;
    onAction('JSONレスポンスの解析に成功しました。');
  } catch (error) {
    console.error('Failed to parse presentation JSON:', rawText);
    throw new Error('AIからのレスポンス形式が不正です。別の条件で再度お試しください。');
  }

  const imagePrompts = presentation.slides
    .map((slide, index) => ({ index, prompt: slide.image?.description }))
    .filter((entry): entry is { index: number; prompt: string } => Boolean(entry.prompt));

  if (imagePrompts.length > 0) {
    onAction(`画像生成キュー: ${imagePrompts.length}件`);
    const imageResults = await Promise.all(
      imagePrompts.map(async ({ index, prompt }, order) => {
        onAction(`[${order + 1}/${imagePrompts.length}] 画像生成を開始: "${prompt}"`);
        try {
          const imageResponse = await aiClient.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
            config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '16:9' },
          });
          const base64 = imageResponse.generatedImages?.[0]?.image?.imageBytes;
          if (!base64) {
            throw new Error('画像データが空でした。');
          }
          onAction(`[${order + 1}/${imagePrompts.length}] 画像生成に成功しました。`);
          return { index, imageUrl: `data:image/jpeg;base64,${base64}` };
        } catch (error) {
          console.error(`Failed to generate image for slide ${index}:`, error);
          onAction(`[${order + 1}/${imagePrompts.length}] 画像生成に失敗しました。スキップします。`);
          return null;
        }
      }),
    );

    imageResults
      .filter((result): result is { index: number; imageUrl: string } => Boolean(result))
      .forEach(result => {
        presentation.slides[result.index].imageUrl = result.imageUrl;
      });
    onAction('画像生成工程が完了しました。');
  } else {
    onAction('画像生成は要求されませんでした。');
  }

  let sources: ProposalSource[] | null = null;
  if (formData.deepResearch) {
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const extractedSources = groundingChunks
      .filter(chunk => chunk.web)
      .map((chunk, index) => ({
        title: `(Source ${index + 1}) ${chunk.web?.title ?? 'Untitled Source'}`,
        uri: chunk.web?.uri ?? '#',
      }));
    sources = extractedSources.length > 0 ? extractedSources : null;
    if (sources) {
      onAction('調査ソースを抽出しました。');
    }
  }

  onAction('提案書の生成が完了しました。');
  return { presentation, sources };
};
