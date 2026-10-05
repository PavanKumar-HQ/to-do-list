// Financial precision utility: Integer minor units (paise/cents) to avoid floating point math errors

export function toMinorUnits(decimalAmount: number | string): number {
  if (typeof decimalAmount === 'string') {
    const clean = decimalAmount.replace(/[^0-9.-]/g, '');
    decimalAmount = parseFloat(clean);
  }
  if (!isFinite(decimalAmount) || isNaN(decimalAmount)) {
    return 0;
  }
  return Math.round(decimalAmount * 100);
}

export function fromMinorUnits(minorUnits: number): number {
  if (!isFinite(minorUnits) || isNaN(minorUnits)) {
    return 0;
  }
  return (minorUnits || 0) / 100;
}

export function formatMoney(minorUnits: number | undefined, symbol: string = '₹'): string {
  if (minorUnits === undefined || isNaN(minorUnits) || !isFinite(minorUnits)) {
    return `${symbol}0`;
  }
  const units = Math.round(minorUnits);
  const isNegative = units < 0;
  const absoluteUnits = Math.abs(units);
  const major = Math.floor(absoluteUnits / 100);
  const minor = absoluteUnits % 100;

  // Format with thousands separator
  const formattedMajor = major.toLocaleString('en-IN');
  const formattedMinor = minor > 0 ? `.${minor.toString().padStart(2, '0')}` : '';

  return `${isNegative ? '-' : ''}${symbol}${formattedMajor}${formattedMinor}`;
}

export const COMMON_CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (₹)' },
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'AED', symbol: 'AED', label: 'UAE Dirham (AED)' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar (CA$)' },
  { code: 'AUD', symbol: 'AU$', label: 'Australian Dollar (AU$)' },
  { code: 'SGD', symbol: 'SG$', label: 'Singapore Dollar (SG$)' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen (¥)' }
];
