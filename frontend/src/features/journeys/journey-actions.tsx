import { useState } from 'react'
import { Bookmark, Link2, Mail, Printer } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { savedId, useSavedJourneys } from './saved'
import type { Journey, JourneySearch } from './types'

export function JourneyActions({
  journey,
  criteria,
}: {
  journey: Journey
  criteria: JourneySearch
}) {
  const { items, toggle } = useSavedJourneys()
  const reference = { criteria, trip: journey.id, provider: journey.providerName }
  const id = savedId(reference)
  const saved = items.some((x) => savedId(x) === id)
  const url = new URL(`/search?${id}`, window.location.origin).href
  const [message, setMessage] = useState('')
  const [fallback, setFallback] = useState(false)
  const subject = `MoveON: ${journey.origin} to ${journey.destination}`
  const body = `${subject}\n${criteria.date} · ${journey.providerName}\n${journey.isSample ? 'Sample itinerary — not a booking or live schedule.' : 'Published itinerary — confirm details with the provider. This is not a booking.'}\n${url}`
  return (
    <div className="journey-actions no-print">
      <div className="action-buttons">
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={saved}
          onClick={() => {
            try {
              toggle(reference)
              setMessage(saved ? 'Removed from saved journeys.' : 'Journey saved on this device.')
            } catch (error) {
              setMessage((error as Error).message)
            }
          }}
        >
          <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
          {saved ? 'Saved journey' : 'Save journey'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
              setMessage('Journey link copied.')
              setFallback(false)
            } catch {
              setFallback(true)
              setMessage('Select and copy the link below.')
            }
          }}
        >
          <Link2 size={15} aria-hidden="true" />
          Copy link
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a
            href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
          >
            <Mail size={15} aria-hidden="true" />
            Email
          </a>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/print?${id}`}>
            <Printer size={15} aria-hidden="true" />
            Print itinerary
          </Link>
        </Button>
      </div>
      {fallback && (
        <label className="share-fallback">
          Journey link
          <input readOnly value={url} onFocus={(e) => e.target.select()} />
        </label>
      )}
      <p role="status" className="action-status">
        {message || 'Saved on this browser. Email opens your email app.'}
      </p>
    </div>
  )
}
