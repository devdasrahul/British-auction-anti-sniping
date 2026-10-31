import { format } from 'date-fns';

export function parseSafeDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  let str = String(val).trim();
  if (!str.includes('T') && str.includes(' ')) {
    str = str.replace(' ', 'T');
  }
  if (!str.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(str)) {
    str += 'Z';
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function safeFormat(val, fmt = 'dd MMM yyyy, HH:mm') {
  const d = parseSafeDate(val);
  if (!d) return '—';
  try {
    return format(d, fmt);
  } catch {
    return '—';
  }
}

export function formatCurrency(val) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);
}

