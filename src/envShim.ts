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
    NEXT_PUBLIC_AI_OFF: env.NEXT_PUBLIC_AI_OFF,
    // Add direct access to process.env for debugging
    processEnv: typeof process !== 'undefined' ? {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '***' : 'Not set',
      VITE_GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY ? '***' : 'Not set',
      VITE_API_KEY: process.env.VITE_API_KEY ? '***' : 'Not set'
    } : 'process.env not available'
  });
} catch (error) {
  console.error('Error logging environment variables:', error);
}

// Try different ways to get the API key
const getApiKey = () => {
  // For Vercel production, we need to check both runtime env and build-time env
  
  // 1. Check for Vite environment variables (works in both dev and prod)
  const viteEnv = (import.meta as any).env || {};
  
  // 2. Check for Vercel environment variables (available at runtime)
  const vercelEnv = (window as any).process?.env || {};
  
  // 3. Check in this order:
  //    - Vite prefixed variables (VITE_*)
  //    - Direct variables
  //    - Vercel runtime variables
  return (
    viteEnv.VITE_GEMINI_API_KEY ||
    viteEnv.GEMINI_API_KEY ||
    vercelEnv.VITE_GEMINI_API_KEY ||
    vercelEnv.GEMINI_API_KEY ||
    ''
  );
};

export const GEMINI_API_KEY = getApiKey();
console.log('Resolved GEMINI_API_KEY:', GEMINI_API_KEY ? '***' : 'Not set');

// Check if AI is disabled
export const IS_AI_DISABLED = (() => {
  // 1. Check window object first
  if (typeof (window as any).IS_AI_DISABLED !== 'undefined') {
    return !!(window as any).IS_AI_DISABLED;
  }
  
  // 2. Check environment variables
  const env = (import.meta as any).env || {};
  if (env.VITE_AI_OFF === '1' || env.VITE_AI_OFF === 'true') return true;
  if (env.VITE_IS_AI_DISABLED === 'true') return true;
  if (env.NEXT_PUBLIC_AI_OFF === '1') return true;
  
  // 3. Check process.env
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_AI_OFF === '1' || process.env.VITE_AI_OFF === 'true') return true;
    if (process.env.VITE_IS_AI_DISABLED === 'true') return true;
    if (process.env.NEXT_PUBLIC_AI_OFF === '1') return true;
  }
  
  return false;
})();

console.log('IS_AI_DISABLED:', IS_AI_DISABLED);

// If we're in development mode and no API key is set, show a warning
if (process.env.NODE_ENV === 'development' && !GEMINI_API_KEY && !IS_AI_DISABLED) {
  console.warn('WARNING: No Gemini API key found. AI features will not work.');
  console.warn('Please set one of the following environment variables:');
  console.warn('- VITE_GEMINI_API_KEY');
  console.warn('- GEMINI_API_KEY');
  console.warn('- VITE_API_KEY');
  console.warn('Or set NEXT_PUBLIC_AI_OFF=1 to disable AI features.');
}