// Debug log for environment variables
try {
  const env = (import.meta as any).env || {};
  console.log('Environment Debug:', {
    windowGEMINI_API_KEY: (window as any).GEMINI_API_KEY ? '***' : 'Not set',
    VITE_GEMINI_API_KEY: env.VITE_GEMINI_API_KEY ? '***' : 'Not set',
    GEMINI_API_KEY: env.GEMINI_API_KEY ? '***' : 'Not set',
    VITE_API_KEY: env.VITE_API_KEY ? '***' : 'Not set',
    VITE_AI_OFF: env.VITE_AI_OFF,
    VITE_IS_AI_DISABLED: env.VITE_IS_AI_DISABLED,
    NEXT_PUBLIC_AI_OFF: env.NEXT_PUBLIC_AI_OFF
  });
} catch (error) {
  console.error('Error logging environment variables:', error);
}

export const GEMINI_API_KEY =
  (window as any).GEMINI_API_KEY ??
  (import.meta as any).env?.VITE_GEMINI_API_KEY ??
  (import.meta as any).env?.GEMINI_API_KEY ??
  (import.meta as any).env?.VITE_API_KEY ??
  "";

console.log('Resolved GEMINI_API_KEY:', GEMINI_API_KEY ? '***' : 'Not set');

export const IS_AI_DISABLED = (
  (window as any).IS_AI_DISABLED ??
  (
    (import.meta as any).env?.VITE_AI_OFF === '1' ||
    (import.meta as any).env?.VITE_AI_OFF === 'true' ||
    (import.meta as any).env?.VITE_IS_AI_DISABLED === 'true' ||
    (import.meta as any).env?.NEXT_PUBLIC_AI_OFF === '1'
  )
);

console.log('IS_AI_DISABLED:', IS_AI_DISABLED);