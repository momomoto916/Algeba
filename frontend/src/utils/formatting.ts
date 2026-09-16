import { TOKEN_DECIMALS, DISPLAY_DECIMALS } from '../config/constants';

export function formatBigInt(value: bigint | undefined | null, decimals: number = TOKEN_DECIMALS, precision: number = DISPLAY_DECIMALS): string {
  if (!value) return '0';

  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const remainder = value % divisor;

  if (remainder === 0n) {
    return whole.toLocaleString();
  }

  const remainderStr = remainder.toString().padStart(decimals, '0');
  const truncated = remainderStr.slice(0, precision);
  return `${whole.toLocaleString()}.${truncated}`;
}

// Format with no floating point - returns integer only
export function formatBigIntNoFloat(value: bigint | undefined | null, decimals: number = TOKEN_DECIMALS): string {
  if (!value) return '0';

  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  return whole.toLocaleString();
}

// Format with 4 decimals for small values (< 1)
export function formatWithDecimals(value: bigint | undefined | null, decimals: number = TOKEN_DECIMALS, minDecimals: number = 4): string {
  if (!value) return '0';

  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const remainder = value % divisor;

  // If value is 0, return 0
  if (whole === 0n && remainder === 0n) return '0';

  // If whole number is >= 1, show without decimals
  if (whole > 0n) {
    return whole.toLocaleString();
  }

  // If less than 1, show with 4 decimals
  const remainderStr = remainder.toString().padStart(decimals, '0');
  const truncated = remainderStr.slice(0, minDecimals);
  return `0.${truncated}`;
}

// Truncates (never rounds up) so e.g. 209,999,950 shows as "209.99M", not a
// misleading "210.00M" that implies a cap has been reached when it hasn't.
export function formatCompact(value: bigint | undefined | null): string {
  if (!value) return '0';

  const formatted = formatBigInt(value);
  const num = parseFloat(formatted.replace(/,/g, ''));

  if (num >= 1_000_000) {
    return (Math.floor(num / 10_000) / 100).toFixed(2) + 'M';
  } else if (num >= 1_000) {
    return (Math.floor(num / 10) / 100).toFixed(2) + 'K';
  }
  return formatted;
}

export function formatAddress(address: string | undefined): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatPercentage(current: bigint, total: bigint): string {
  if (total === 0n) return '0%';
  const percentage = Number(current * 100n / total);
  return percentage.toFixed(2) + '%';
}

export function formatTime(seconds: bigint | number): string {
  const secs = typeof seconds === 'bigint' ? Number(seconds) : seconds;
  
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}
