import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const geminiApiKey =
        env.VITE_GEMINI_API_KEY
        || env.GEMINI_API_KEY
        || env.API_KEY
        || env.VITE_API_KEY
        || '';
    const aiOffFlag = env.VITE_AI_OFF ?? env.NEXT_PUBLIC_AI_OFF ?? '0';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
        'process.env.NEXT_PUBLIC_AI_OFF': JSON.stringify(aiOffFlag),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              supabase: ['@supabase/supabase-js'],
              charts: ['recharts'],
              icons: ['lucide-react'],
            }
          }
        }
      },
      optimizeDeps: {
        include: ['react', 'react-dom', '@supabase/supabase-js', 'recharts', 'lucide-react']
      }
    };
});
