export const GEMINI_API_KEY =
  (window as any).GEMINI_API_KEY ??
  (import.meta as any).env?.VITE_GEMINI_API_KEY ??
  (import.meta as any).env?.GEMINI_API_KEY ??
  (import.meta as any).env?.VITE_API_KEY ??
  "";

export const IS_AI_DISABLED = (
  (window as any).IS_AI_DISABLED ??
  (
    (import.meta as any).env?.VITE_AI_OFF === '1' ||
    (import.meta as any).env?.VITE_AI_OFF === 'true' ||
    (import.meta as any).env?.VITE_IS_AI_DISABLED === 'true' ||
    (import.meta as any).env?.NEXT_PUBLIC_AI_OFF === '1'
  )
);