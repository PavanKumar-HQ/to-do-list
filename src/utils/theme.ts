import type { AccentColor } from '../types';

export interface AccentOption {
  id: AccentColor;
  name: string;
  hex: string;
  hover: string;
  light: string;
}

export const ACCENT_PALETTE: AccentOption[] = [
  { id: 'teal', name: 'Teal', hex: '#14b8a6', hover: '#0d9488', light: 'rgba(20, 184, 166, 0.16)' },
  { id: 'blue', name: 'Sky Blue', hex: '#0ea5e9', hover: '#0284c7', light: 'rgba(14, 165, 233, 0.16)' },
  { id: 'indigo', name: 'Indigo', hex: '#6366f1', hover: '#4f46e5', light: 'rgba(99, 102, 241, 0.16)' },
  { id: 'purple', name: 'Purple', hex: '#a855f7', hover: '#9333ea', light: 'rgba(168, 85, 247, 0.16)' },
  { id: 'rose', name: 'Rose', hex: '#f43f5e', hover: '#e11d48', light: 'rgba(244, 63, 94, 0.16)' },
  { id: 'green', name: 'Emerald', hex: '#10b981', hover: '#059669', light: 'rgba(16, 185, 129, 0.16)' },
  { id: 'orange', name: 'Orange', hex: '#f97316', hover: '#ea580c', light: 'rgba(249, 115, 22, 0.16)' }
];

export function resolveAccent(colorOrId?: string): AccentOption {
  if (!colorOrId) return ACCENT_PALETTE[0];
  const query = colorOrId.toLowerCase().trim();

  // Try matching by id (e.g. 'indigo', 'blue')
  const byId = ACCENT_PALETTE.find((a) => a.id.toLowerCase() === query);
  if (byId) return byId;

  // Try matching by hex (e.g. '#6366f1')
  const byHex = ACCENT_PALETTE.find((a) => a.hex.toLowerCase() === query);
  if (byHex) return byHex;

  // Common aliases
  if (query === 'sky') return ACCENT_PALETTE[1];
  if (query === 'emerald') return ACCENT_PALETTE[5];

  // If a raw custom hex was provided, construct a valid option
  if (query.startsWith('#') && (query.length === 4 || query.length === 7)) {
    return {
      id: 'indigo',
      name: 'Custom',
      hex: query,
      hover: query,
      light: `${query}26`
    };
  }

  return ACCENT_PALETTE[0];
}

export function applyAccentToDocument(colorOrId?: string): void {
  if (typeof document === 'undefined') return;
  const accent = resolveAccent(colorOrId);

  // Set attribute on <html> for CSS selectors
  document.documentElement.setAttribute('data-accent', accent.id);

  // Directly set CSS custom properties on document root so ALL components instantly react
  document.documentElement.style.setProperty('--accent', accent.hex);
  document.documentElement.style.setProperty('--accent-hover', accent.hover);
  document.documentElement.style.setProperty('--accent-light', accent.light);
}
