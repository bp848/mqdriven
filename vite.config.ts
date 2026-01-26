import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load environment variables
    const env = loadEnv(mode, '.', '');
    
    // Debug: Print loaded environment variables
    console.log('Vite loaded env vars:', {
        VITE_GEMINI_API_KEY: env.VITE_GEMINI_API_KEY ? '***SET***' : 'NOT SET',
        GEMINI_API_KEY: env.GEMINI_API_KEY ? '***SET***' : 'NOT SET',
        VITE_AI_OFF: env.VITE_AI_OFF
    });
    
    return {
      server: {
        port: 8080,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3000',
            changeOrigin: true,
            secure: false,
          }
        }
      },
      plugins: [react()],
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
              ai: ['@google/genai'],
              utils: ['uuid', 'jszip']
            }
          }
        },
        minify: 'esbuild',
        cssMinify: false, // Disable CSS minify completely
        chunkSizeWarningLimit: 1000
      },
      optimizeDeps: {
        include: ['react', 'react-dom', '@supabase/supabase-js', 'recharts', 'lucide-react', '@google/genai', 'uuid', 'jszip', 'google-auth-library']
      }
    };
});
