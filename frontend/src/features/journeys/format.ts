import type { Journey } from './types'

export const modeLabels = { coach: 'Coach', rail: 'Rail', shuttle: 'Shuttle' }
export function duration(minutes: number) {
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`
}
export function clockTime(timestamp: string, timeZone = 'America/Toronto') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(timestamp))
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}
export function fareLabel(journey: Journey) {
  return journey.estimatedFare
    ? new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(journey.estimatedFare.amount)
    : 'Fare unavailable'
}
export function isStale(journey: Journey, now: number) {
  return now - Date.parse(journey.updatedAt) > 24 * 3_600_000
}
export function safeProviderUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}
