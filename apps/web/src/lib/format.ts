export function formatMinorCurrency(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function formatMinorCurrencySummary(amountMinor: number, currency: string) {
  const hasPaise = amountMinor % 100 !== 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function formatMinorCurrencyCompact(amountMinor: number, currency: string) {
  const amount = amountMinor / 100;
  const absoluteAmount = Math.abs(amount);
  const currencySymbol = new Intl.NumberFormat('en-IN', {style: 'currency', currency})
    .formatToParts(0)
    .find(({type}) => type === 'currency')?.value ?? currency;
  const compact = absoluteAmount >= 1_00_00_000
    ? {value: absoluteAmount / 1_00_00_000, suffix: 'Cr'}
    : absoluteAmount >= 1_00_000
      ? {value: absoluteAmount / 1_00_000, suffix: 'L'}
      : absoluteAmount >= 1_000
        ? {value: absoluteAmount / 1_000, suffix: 'K'}
        : null;

  if (!compact) return formatMinorCurrencySummary(amountMinor, currency);
  const value = new Intl.NumberFormat('en-IN', {maximumFractionDigits: 1}).format(compact.value);
  return `${amount < 0 ? '-' : ''}${currencySymbol}${value}${compact.suffix}`;
}

export function formatTransactionDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}
