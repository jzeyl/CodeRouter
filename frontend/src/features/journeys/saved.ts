import { useSyncExternalStore } from 'react'
import { isValidCity, localDate, searchParams } from './search'
import type { JourneySearch } from './types'

export type SavedJourney = { criteria: JourneySearch; trip: string; provider: string }
const key = 'moveon:saved:v1'
const event = 'moveon:saved-change'
const snapshot = () => {
  try {
    return localStorage.getItem(key) ?? '[]'
  } catch {
    return '[]'
  }
}
const subscribe = (listener: () => void) => {
  window.addEventListener('storage', listener)
  window.addEventListener(event, listener)
  return () => {
    window.removeEventListener('storage', listener)
    window.removeEventListener(event, listener)
  }
}
export const savedId = (item: SavedJourney) =>
  `${searchParams(item.criteria)}&trip=${encodeURIComponent(item.trip)}`
function parse(raw: string): SavedJourney[] {
  try {
    const data = JSON.parse(raw)
    return Array.isArray(data)
      ? data
          .filter(
            (x) =>
              x &&
              typeof x.trip === 'string' &&
              typeof x.provider === 'string' &&
              x.criteria &&
              isValidCity(x.criteria.origin) &&
              isValidCity(x.criteria.destination) &&
              /^\d{4}-\d{2}-\d{2}$/.test(x.criteria.date) &&
              localDate(new Date(`${x.criteria.date}T12:00:00`)) === x.criteria.date &&
              /^([01]\d|2[0-3]):[0-5]\d$/.test(x.criteria.time),
          )
          .slice(0, 100)
      : []
  } catch {
    return []
  }
}
export function useSavedJourneys() {
  const raw = useSyncExternalStore(subscribe, snapshot)
  const items = parse(raw)
  const toggle = (item: SavedJourney) => {
    const current = parse(snapshot())
    const exists = current.some((x) => savedId(x) === savedId(item))
    if (!exists && current.length >= 100)
      throw new Error('Your saved list is full. Remove a journey to make room.')
    try {
      localStorage.setItem(
        key,
        JSON.stringify(
          exists ? current.filter((x) => savedId(x) !== savedId(item)) : [...current, item],
        ),
      )
    } catch {
      throw new Error('This browser couldn’t save the change. Check that local storage is allowed.')
    }
    window.dispatchEvent(new Event(event))
  }
  return { items, toggle }
}
