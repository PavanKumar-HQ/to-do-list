// Security and validation primitives: prototype pollution defense, URL sanitization, XSS defense, size bounds

export const LIMITS = {
  MAX_TITLE_LENGTH: 500,
  MAX_DESCRIPTION_LENGTH: 50000,
  MAX_NOTE_CONTENT_LENGTH: 500000,
  MAX_ATTACHMENT_SIZE_BYTES: 25 * 1024 * 1024, // 25 MB
  MAX_BACKUP_SIZE_BYTES: 100 * 1024 * 1024, // 100 MB
  MAX_BACKUP_RECORD_COUNT: 200000
};

// Prototype pollution protection during JSON parsing or object processing
export function sanitizeObject<T>(obj: T, depth = 0): T {
  if (depth > 20) {
    throw new Error('Object nesting exceeds safe depth limit.');
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1)) as unknown as T;
  }

  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Strictly block prototype pollution keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    cleanObj[key] = sanitizeObject(value, depth + 1);
  }

  return cleanObj as T;
}

// Safe parse JSON with prototype pollution defense
export function safeJsonParse<T = any>(jsonString: string): T {
  const parsed = JSON.parse(jsonString, (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return value;
  });
  return sanitizeObject(parsed);
}

// URL scheme validation to prevent javascript: or unsafe link execution
export function isSafeUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  // Strictly allow only safe schemes
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  );
}

export function sanitizeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return isSafeUrl(url) ? url.trim() : undefined;
}

// Strict plain text escaping
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Safe attachment MIME check
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/mpeg'
]);

export function isValidAttachmentMime(mimeType: string): boolean {
  if (!mimeType) return false;
  const cleanMime = mimeType.trim().toLowerCase();
  // Explicitly disallow active scriptable mime types like text/html, application/javascript, image/svg+xml (for direct raw inline rendering)
  if (cleanMime.includes('html') || cleanMime.includes('javascript') || cleanMime.includes('svg')) {
    return false;
  }
  return ALLOWED_MIME_TYPES.has(cleanMime);
}
