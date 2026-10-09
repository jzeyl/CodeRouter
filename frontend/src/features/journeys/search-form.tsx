import { useState, type FormEvent } from 'react'
import { ArrowRight, ArrowRightLeft, CalendarDays, ChevronDown, Clock3, MapPin } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { isLiveData } from '@/lib/data-source'
import { useCities } from './use-cities'
import { localDate, readSearch, searchParams } from './search'
import type { JourneySearch } from './types'

export function SearchForm({ compact = false }: { compact?: boolean }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const cityQuery = useCities()
  const availableCities = cityQuery.data ?? []

  const [criteria, setCriteria] = useState<JourneySearch>(() => readSearch(params))
  const [error, setError] = useState('')
  const cityOptions = [...new Set([...availableCities, criteria.origin, criteria.destination])]
  const update = (key: keyof JourneySearch, value: string) => {
    setCriteria((previous) => ({ ...previous, [key]: value }))
    setError('')
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      isLiveData &&
      (!availableCities.includes(criteria.origin) ||
        !availableCities.includes(criteria.destination))
    ) {
      setError('Choose cities with available services.')
      return
    }
    if (criteria.origin === criteria.destination) {
      setError('Choose two different cities for your journey.')
      return
    }
    if (criteria.date < localDate()) {
      setError('Choose today or a future travel date.')
      return
    }
    setError('')
    navigate(`/search?${searchParams(criteria)}`)
  }
  return (
    <section
      className={`search-section ${compact ? 'compact-search' : ''}`}
      id="plan"
      aria-labelledby="search-heading"
    >
      <div className="search-heading">
        <h2 id="search-heading">Where are we heading?</h2>
        <span>One way. More possibilities.</span>
      </div>
      <form onSubmit={submit} className="search-form">
        <div className="city-fields">
          <label className="search-field">
            <span className="field-label">
              <MapPin size={14} aria-hidden="true" /> From
            </span>
            <span className="select-wrap">
              <select
                aria-label="Starting city"
                value={criteria.origin}
                onChange={(event) => update('origin', event.target.value)}
              >
                {cityOptions.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </span>
          </label>
          <button
            type="button"
            className="swap-button"
            aria-label="Swap starting city and destination"
            onClick={() => {
              setCriteria((previous) => ({
                ...previous,
                origin: previous.destination,
                destination: previous.origin,
              }))
              setError('')
            }}
          >
            <ArrowRightLeft size={17} aria-hidden="true" />
          </button>
          <label className="search-field">
            <span className="field-label">
              <MapPin size={14} aria-hidden="true" /> To
            </span>
            <span className="select-wrap">
              <select
                aria-label="Destination city"
                value={criteria.destination}
                onChange={(event) => update('destination', event.target.value)}
              >
                {cityOptions.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </span>
          </label>
        </div>
        <label className="search-field date-field">
          <span className="field-label">
            <CalendarDays size={14} aria-hidden="true" /> Travel date
          </span>
          <input
            aria-label="Travel date"
            type="date"
            min={localDate()}
            required
            value={criteria.date}
            onChange={(event) => update('date', event.target.value)}
          />
        </label>
        <label className="search-field time-field">
          <span className="field-label">
            <Clock3 size={14} aria-hidden="true" /> Leave after
          </span>
          <input
            aria-label="Leave after"
            type="time"
            required
            value={criteria.time}
            onChange={(event) => update('time', event.target.value)}
          />
        </label>
        <Button
          type="submit"
          disabled={
            isLiveData && (cityQuery.isPending || cityQuery.isError || !availableCities.length)
          }
          className="search-submit"
          aria-describedby={error ? 'search-error' : undefined}
        >
          {compact ? 'Update search' : 'Find a trip'} <ArrowRight size={18} aria-hidden="true" />
        </Button>
        {error && (
          <p className="form-error" id="search-error" role="alert">
            {error}
          </p>
        )}
      </form>
      {isLiveData && (
        <p role="status" className="search-note">
          {cityQuery.isPending
            ? 'Loading available cities…'
            : cityQuery.isError
              ? 'Available cities couldn’t load. Please try again.'
              : !availableCities.length
                ? 'No published services yet. Check back soon.'
                : 'Cities reflect currently published services.'}
          {cityQuery.isError && (
            <button type="button" className="card-map-link" onClick={() => cityQuery.refetch()}>
              Retry cities
            </button>
          )}
        </p>
      )}
      <p className="search-note">
        <span className="small-dot" /> No account needed. A little less between you and your next
        trip.
      </p>
    </section>
  )
}
