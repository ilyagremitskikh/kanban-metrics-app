import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function mean(arr: number[]): number | null {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
}

export function percentile(arr: number[], p: number): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function fmtWeekLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toMonday(d: Date): Date {
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  mon.setHours(0, 0, 0, 0);
  return mon;
}
