import type {Category} from '@/lib/koshara-types';

export interface ParsedExpense {
  amount: number | null;
  date: string | null;
  categoryId: string | null;
  description: string;
}

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Only explicit, unambiguous values are prefilled. The existing form collects the rest.
export function parseExpense(input: string, categories: Category[], now = new Date()): ParsedExpense {
  const text = input.toLocaleLowerCase();
  const amountMatch = text.match(/(?:₹|\brs\.?|\binr)\s*([\d,]+(?:\.\d{1,2})?)/i)
    ?? text.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr)\b/i);
  const amountValue = amountMatch ? Number(amountMatch[1]?.replaceAll(',', '')) : NaN;
  const amount = Number.isFinite(amountValue) && amountValue > 0 && amountValue < 1_000_000_000 ? amountValue : null;

  let date: string | null = null;
  if (/\byesterday\b/i.test(text)) date = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  else if (/\btoday\b/i.test(text)) date = localDate(now);
  else {
    const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (iso) {
      const parsed = new Date(`${iso[1]}T12:00:00`);
      if (!Number.isNaN(parsed.getTime()) && localDate(parsed) === iso[1]) date = iso[1];
    }
  }

  const category = [...categories]
    .filter(({id}) => id !== 'uncategorized' && id !== 'income')
    .sort((left, right) => right.name.length - left.name.length)
    .find(({name}) => {
      const words = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      return ` ${words(text)} `.includes(` ${words(name)} `);
    });

  const atPlace = input.match(/\b(?:at|from)\s+([\p{L}\p{N}][\p{L}\p{N} &'’-]*?)(?=\s+(?:yesterday|today|on\s+\d{4}-\d{2}-\d{2})\b|[.!?]|$)/iu);
  const description = atPlace?.[1]?.trim() || category?.name || '';
  return {amount, date, categoryId: category?.id ?? null, description};
}
