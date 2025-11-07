// Vercel deployment: Next.js middleware not compatible with Vite
// Auth callback handling moved to client-side routing

// This file is kept for compatibility but middleware is disabled
export function middleware() {
  // No-op for Vercel compatibility
  return;
}

export const config = {
  matcher: [],
};
