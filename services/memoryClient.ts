const DEFAULT_MEMORY_BASE_URL = (() => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MEMORY_SERVER_URL) {
    return import.meta.env.VITE_MEMORY_SERVER_URL as string;
  }
  if (typeof process !== 'undefined' && process.env?.MEMORY_SERVER_URL) {
    return process.env.MEMORY_SERVER_URL;
  }
  return 'http://localhost:7331';
})();

type MemoryResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  fallback?: boolean;
};

const requestWithTimeout = async (input: RequestInfo, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchMemory = async <T>(
  path: string,
  options: RequestInit = {},
  baseUrl: string = DEFAULT_MEMORY_BASE_URL,
  timeoutMs = 4000,
): Promise<MemoryResult<T>> => {
  const url = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const res = await requestWithTimeout(url, options, timeoutMs);
    if (!res.ok) {
      return { ok: false, error: `memory server error: ${res.status}`, fallback: true };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: (error as Error).message, fallback: true };
  }
};

export const getMemoryHealth = async () => {
  return fetchMemory<{ ok: boolean }>('/health', { method: 'GET' });
};

export const upsertMemoryEntity = async (payload: Record<string, unknown>) => {
  return fetchMemory('/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
};

export const searchMemory = async (query: string) => {
  return fetchMemory('/memory/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
};
