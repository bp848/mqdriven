import type { Blob } from '@google/genai';

export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function createPcmBlob(data: Float32Array): Blob {
  const length = data.length;
  const int16Array = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    int16Array[i] = Math.max(-1, Math.min(1, data[i])) * 32767;
  }
  return {
    data: encode(new Uint8Array(int16Array.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
