/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_AI_OFF?: string;
  readonly VITE_IS_AI_DISABLED?: string;
  readonly NEXT_PUBLIC_AI_OFF?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
