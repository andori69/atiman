import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function timeAgo(date: string | Date): string {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffDay > 0) return `${diffDay}d ago`
  if (diffHour > 0) return `${diffHour}h ago`
  if (diffMin > 0) return `${diffMin}m ago`
  return 'just now'
}

/**
 * Compact currency formatter for stat cards / tight spaces.
 * ₱8,500 stays as ₱8,500 | ₱18,500 → ₱18.5K | ₱1,250,000 → ₱1.3M
 */
export function fmtMoney(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) {
    const v = (amount / 1_000_000).toFixed(1).replace(/\.0$/, '')
    return `₱${v}M`
  }
  if (abs >= 10_000) {
    const v = (amount / 1_000).toFixed(1).replace(/\.0$/, '')
    return `₱${v}K`
  }
  return formatCurrency(amount)
}

export function generateLandlordCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const code = Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
  return `ATIMAN-${code}`
}
