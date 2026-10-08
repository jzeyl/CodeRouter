import { isLiveData } from '@/lib/data-source'
import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Bookmark, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { savedId, useSavedJourneys, type SavedJourney } from './saved'
import { journeyRepository } from './repository'
import { localDate, nextDay, searchParams } from './search'
import { clockTime, fareLabel, dateLabel } from './format'
import './results.css'
import './phase-three.css'

function SavedItem({ item, remove }: { item: SavedJourney; remove: () => void }) {
  const expired = item.criteria.date < localDate()
  const query = useQuery({
    queryKey: ['saved-journey', savedId(item)],
    queryFn: ({ signal }) => journeyRepository.search(item.criteria, signal),
    enabled: !expired,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  })
  const journey = query.data?.find((x) => x.id === item.trip)
  return (
    <article className="saved-card">
      <div className="eyebrow">
        {item.provider} · {isLiveData ? 'Saved journey' : 'Sample journey'}
      </div>
      <h2>
        {item.criteria.origin} <span aria-label="to">→</span> {item.criteria.destination}
      </h2>
      <p>{dateLabel(item.criteria.date)}</p>
      <p role="status">
        {expired
          ? 'This travel date has passed. Choose a new date to search again.'
          : query.isFetching
            ? 'Checking the latest journey data…'
            : query.isError
              ? 'Couldn’t refresh this journey. Try again before travelling.'
              : query.fetchStatus === 'paused'
                ? 'Reconnect to refresh this journey.'
                : journey
                  ? `${clockTime(journey.departureAt, journey.timeZone)} Eastern · ${fareLabel(journey)}${journey.estimatedFare ? ' CAD' : ''} · Refreshed just now`
                  : 'This journey is no longer in the current results.'}
      </p>
      <div className="action-buttons">
        {expired ? (
          <Button asChild variant="secondary">
            <Link to={`/?${searchParams({ ...item.criteria, date: nextDay() })}#plan`}>
              Choose a new date
            </Link>
          </Button>
        ) : query.isError ? (
          <Button onClick={() => query.refetch()}>Retry refresh</Button>
        ) : (
          <Button asChild variant="secondary">
            <Link to={`/search?${savedId(item)}`}>
              {journey ? 'Open journey' : 'View current search'}
            </Link>
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={remove}
          aria-label={`Remove ${item.provider} saved journey`}
        >
          <Trash2 size={15} aria-hidden="true" />
          Remove
        </Button>
      </div>
    </article>
  )
}
export function SavedPage() {
  const { items, toggle } = useSavedJourneys()
  const [message, setMessage] = useState('')
  return (
    <main id="main-content" className="saved-page page-width">
      <div className="eyebrow">A little less searching next time</div>
      <h1>
        Your saved <em>journeys.</em>
      </h1>
      <p className="saved-intro">
        Kept on this browser, without an account. We check the current data whenever you come back;
        saving a journey doesn’t reserve a seat.
      </p>
      <p role="status">{message}</p>
      {items.length ? (
        <div className="saved-grid">
          {items.map((item) => (
            <SavedItem
              key={savedId(item)}
              item={item}
              remove={() => {
                try {
                  toggle(item)
                  setMessage('Journey removed.')
                } catch (error) {
                  setMessage((error as Error).message)
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="result-message">
          <Bookmark size={32} aria-hidden="true" />
          <h2>Keep a good journey close.</h2>
          <p>Open a journey and select “Save journey” to find it here.</p>
          <Button asChild>
            <Link to="/#plan">Find a journey</Link>
          </Button>
        </div>
      )}
    </main>
  )
}
