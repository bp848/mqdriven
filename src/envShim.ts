// Get API key from environment
const getApiKey = (): string => {
  // Check window.__ENV first (for production builds with runtime injection)
  if (typeof window !== 'undefined' && (window as any).__ENV?.VITE_GEMINI_API_KEY) {
    console.log('✓ API Key loaded from window.__ENV.VITE_GEMINI_API_KEY');
    return (window as any).__ENV.VITE_GEMINI_API_KEY;
  }
  
  // Check Vite environment variables (available in development)
  if (typeof import.meta.env !== 'undefined') {
    if (import.meta.env.VITE_GEMINI_API_KEY) {
      console.log('✓ API Key loaded from import.meta.env.VITE_GEMINI_API_KEY');
      return import.meta.env.VITE_GEMINI_API_KEY as string;
    }
    
    if (import.meta.env.VITE_API_KEY) {
      console.log('✓ API Key loaded from import.meta.env.VITE_API_KEY');
      return import.meta.env.VITE_API_KEY as string;
    }
  }
  
  // Check for direct GEMINI_API_KEY (for production environments like Vercel/Netlify)
  if (typeof window !== 'undefined' && (window as any).process?.env?.GEMINI_API_KEY) {
    console.log('✓ API Key loaded from process.env.GEMINI_API_KEY');
    return (window as any).process.env.GEMINI_API_KEY;
  }
  
  console.warn('✗ No API Key found in any environment variable');
  return '';
};

export const GEMINI_API_KEY = getApiKey();

// Check if AI is disabled
export const IS_AI_DISABLED = (() => {
  // Check window object first
  if (typeof window !== 'undefined' && typeof (window as any).IS_AI_DISABLED !== 'undefined') {
    return !!(window as any).IS_AI_DISABLED;
  }
  
  // Check environment variables (only if import.meta.env is available)
  if (typeof import.meta.env !== 'undefined') {
    if (import.meta.env.VITE_AI_OFF === '1' || import.meta.env.VITE_AI_OFF === 'true') return true;
    if (import.meta.env.VITE_IS_AI_DISABLED === 'true') return true;
    if (import.meta.env.NEXT_PUBLIC_AI_OFF === '1') return true;
  }
  
  return false;
})();

console.log('=== AI Configuration ===');
console.log('API Key:', GEMINI_API_KEY ? `✓ SET (${GEMINI_API_KEY.length} chars)` : '✗ NOT SET');
console.log('AI Disabled:', IS_AI_DISABLED);
console.log('=======================');

// Development warning
if (!GEMINI_API_KEY && !IS_AI_DISABLED) {
  console.error('❌ API Key not found. Please set one of the following environment variables:');
  console.error('- VITE_GEMINI_API_KEY');
  console.error('- VITE_API_KEY');
  console.error('Or set NEXT_PUBLIC_AI_OFF=1 to disable AI features.');
}