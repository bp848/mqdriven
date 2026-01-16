// Simple CORS middleware for Deno
export const cors = (request: Request): Record<string, string> => {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey, x-requested-with",
    "Access-Control-Max-Age": "86400",
  };
};
