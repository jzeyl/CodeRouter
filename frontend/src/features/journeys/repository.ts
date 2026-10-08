import { isLiveData } from '@/lib/data-source'
import type { Journey, JourneyRepository, JourneySearch, JourneyStop } from './types'

type Template = {
  id: string
  provider: string
  mode: Journey['mode']
  departure: string
  durationFactor: number
  fare: number | null
  ageHours: number
}
const corridors = [
  { cities: ['Toronto', 'Ottawa'], minutes: 285, via: 'Kingston' },
  { cities: ['Toronto', 'Kingston'], minutes: 165, via: null },
  { cities: ['Toronto', 'London'], minutes: 150, via: 'Hamilton' },
  { cities: ['Toronto', 'Niagara Falls'], minutes: 120, via: 'Hamilton' },
  { cities: ['Toronto', 'Barrie'], minutes: 95, via: null },
  { cities: ['Sudbury', 'North Bay'], minutes: 100, via: null },
]

function timestamp(date: string, time: string) {
  const offset = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Toronto',
    timeZoneName: 'longOffset',
  })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((part) => part.type === 'timeZoneName')!
    .value.replace('GMT', '')
  return new Date(`${date}T${time}:00${offset}`).toISOString()
}
const atMinute = (start: string, minutes: number) =>
  new Date(Date.parse(start) + minutes * 60_000).toISOString()

function materialize(
  template: Template,
  criteria: JourneySearch,
  minutes: number,
  via: string | null,
  now: number,
): Journey {
  const durationMinutes = Math.round((minutes * template.durationFactor) / 5) * 5
  const departureAt = timestamp(criteria.date, template.departure)
  const arrivalAt = atMinute(departureAt, durationMinutes)
  const stops: JourneyStop[] = [
    {
      name: `${criteria.origin} departure stop`,
      city: criteria.origin,
      departureTime: departureAt,
      locationNote: 'Illustrative stop. Confirm the exact boarding location with the provider.',
    },
  ]
  if (via)
    stops.push({
      name: `${via} stop`,
      city: via,
      arrivalTime: atMinute(departureAt, Math.round(durationMinutes * 0.55)),
      departureTime: atMinute(departureAt, Math.round(durationMinutes * 0.55) + 5),
      locationNote: 'Intermediate stop. Stay on the same service; no transfer required.',
    })
  stops.push({
    name: `${criteria.destination} arrival stop`,
    city: criteria.destination,
    arrivalTime: arrivalAt,
    locationNote: 'Illustrative stop. Confirm the exact arrival location with the provider.',
  })
  return {
    id: template.id,
    providerName: template.provider,
    mode: template.mode,
    origin: criteria.origin,
    destination: criteria.destination,
    departureAt,
    arrivalAt,
    durationMinutes,
    transfers: 0,
    estimatedFare:
      template.fare === null
        ? null
        : { amount: Math.round((template.fare * minutes) / 285), currency: 'CAD' },
    stops,
    providerUrl: null,
    isSample: true,
    timeZone: 'America/Toronto',
    updatedAt: new Date(now - template.ageHours * 3_600_000).toISOString(),
  }
}

/** Only this adapter knows about fixture data. Replace the adapter when live data is ready. */
export const sampleRepository: JourneyRepository = {
  async search(criteria, signal) {
    const response = await fetch('/data/sample-journeys.json', { signal, cache: 'no-store' })
    if (!response.ok) throw new Error('Journey data could not be loaded.')
    const templates: Template[] = await response.json()
    if (
      !Array.isArray(templates) ||
      templates.some(
        (item) =>
          !item ||
          typeof item.id !== 'string' ||
          typeof item.provider !== 'string' ||
          !['coach', 'rail', 'shuttle'].includes(item.mode) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.departure) ||
          !Number.isFinite(item.durationFactor) ||
          item.durationFactor <= 0 ||
          !Number.isFinite(item.ageHours) ||
          item.ageHours < 0 ||
          (item.fare !== null && (!Number.isFinite(item.fare) || item.fare < 0)),
      )
    )
      throw new Error('Journey data has an unexpected format.')
    const corridor = corridors.find(
      (item) =>
        item.cities.includes(criteria.origin) &&
        item.cities.includes(criteria.destination) &&
        criteria.origin !== criteria.destination,
    )
    if (!corridor) return []
    const now = Date.now()
    return templates
      .filter((item) => item.departure >= criteria.time)
      .map((item) =>
        materialize(
          item,
          criteria,
          corridor.minutes,
          item.mode === 'rail' && corridor.via === 'Hamilton' ? null : corridor.via,
          now,
        ),
      )
  },
}

export const journeyRepository: JourneyRepository = {
  async search(criteria, signal) {
    return isLiveData
      ? (await import('./live-repository')).liveRepository.search(criteria, signal)
      : sampleRepository.search(criteria, signal)
  },
}
