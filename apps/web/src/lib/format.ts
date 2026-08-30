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

export function formatTransactionDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}
