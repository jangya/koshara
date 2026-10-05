export function parseAmountMinor(value: string): number | null {
  // Some PDF fonts extract a standalone rupee glyph as "C". Only treat it as
  // currency when it is a separate token immediately before a number.
  const normalized = value.trim().replace(/^([+-]?\s*)C(?=\s*\d)/i, '$1');
  const cleaned = normalized.replace(/^(?:INR|RS\.?)/i, '').replace(/[₹$€£\s]/g, '').replace(/^(CR|DR)/i, '').replace(/(CR|DR)$/i, '');
  const negative = /^-/.test(cleaned) || /^\(.*\)$/.test(cleaned);
  const digits = cleaned.replace(/^[+-]/, '').replace(/^\(/, '').replace(/\)$/, '');
  if (!/^(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?$/.test(digits)) return null;
  const amount = Number(digits.replaceAll(',', ''));
  return Number.isFinite(amount) ? Math.round(amount * 100) * (negative ? -1 : 1) : null;
}
