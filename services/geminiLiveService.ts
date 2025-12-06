import { Type } from '@google/genai';
import type { LiveServerMessage } from '@google/genai';
import { createPcmBlob } from '../utils/audioUtils';
import type { MeetingTask } from '../types/meetingAssistant';
import { isGeminiAIDisabled, requireGeminiClient } from './Gemini';

const getGeminiClient = () => {
  if (isGeminiAIDisabled) {
    throw new Error('AI機能は現在無効です。Gemini Live会議アシスタントを利用するにはAIを有効化してください。');
  }
  return requireGeminiClient();
};

export async function startMeetingSession(
  onMessage: (message: LiveServerMessage) => void,
  onError: (error: Error | ErrorEvent) => void
): Promise<{ session: any; stream: MediaStream; context: AudioContext; processor: ScriptProcessorNode; source: MediaStreamAudioSourceNode }> {
  const ai = getGeminiClient();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);
  const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: () => {
        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
          const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
          const pcmBlob = createPcmBlob(inputData);
          sessionPromise.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
          });
        };
        source.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);
      },
      onmessage: onMessage,
      onerror: onError,
      onclose: () => {
        console.log('Gemini Liveセッションが終了しました。');
      },
    },
    config: {
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  });

  const session = await sessionPromise;
  return { session, stream, context: audioContext, processor: scriptProcessor, source };
}

export async function generateMinutesAndTasks(transcript: string): Promise<{ meetingMinutes: string; tasks: MeetingTask[] }> {
  const prompt = `
        以下の会議の文字起こしに基づいて、2つのタスクを実行してください：
        1. 会議の簡潔な要約を議事録として生成してください。
        2. 言及されたすべてのアクションアイテムまたはタスクを特定してください。各タスクについて、その説明、担当者（言及されている場合。なければ「未割り当て」とマーク）、ステータスを「未着手」に設定して抽出してください。

        文字起こし：
        ---
        ${transcript}
        ---

        結果はJSON形式で返してください。
    `;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            meetingMinutes: {
              type: Type.STRING,
              description: '会議の簡潔な要約。',
            },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: 'タスクの一意の識別子（例：タイムスタンプやランダムな文字列）。',
                  },
                  description: {
                    type: Type.STRING,
                    description: 'アクションアイテムの説明。',
                  },
                  assignedTo: {
                    type: Type.STRING,
                    description: 'タスクが割り当てられた人物またはチーム。',
                  },
                  status: {
                    type: Type.STRING,
                    description: 'タスクの初期ステータス。「未着手」である必要があります。',
                  },
                },
                required: ['id', 'description', 'assignedTo', 'status'],
              },
            },
          },
          required: ['meetingMinutes', 'tasks'],
        },
      },
    });

    if (!response.text) {
      throw new Error('Gemini APIから空の応答を受け取りました。');
    }

    const parsed = JSON.parse(response.text);

    const tasksWithIds = parsed.tasks.map((task: Partial<MeetingTask>, index: number) => ({
      id: task.id || `task-${Date.now()}-${index}`,
      description: task.description || '詳細が取得できませんでした。',
      assignedTo: task.assignedTo || '未割り当て',
      status: task.status || '未着手',
    }));

    return {
      meetingMinutes: parsed.meetingMinutes,
      tasks: tasksWithIds,
    };
  } catch (error) {
    console.error('議事録生成処理中にエラーが発生しました。', error);
    throw new Error('会議の文字起こしの処理に失敗しました。もう一度お試しください。');
  }
}
