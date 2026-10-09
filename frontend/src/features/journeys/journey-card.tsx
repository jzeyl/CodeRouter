import { ArrowRight, BusFront, TrainFront, Users, Clock3, CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clockTime, duration, fareLabel, isStale, modeLabels } from './format'
import type { Journey } from './types'

const modeIcons = { coach: BusFront, rail: TrainFront, shuttle: Users }

export function JourneyCard({
  journey,
  badge,
  now,
  onDetails,
  onMap,
}: {
  journey: Journey
  badge?: string
  now: number
  onMap?: () => void
  onDetails: (button: HTMLButtonElement) => void
}) {
  const Icon = modeIcons[journey.mode]
  const stale = isStale(journey, now)
  return (
    <article className="journey-card" aria-label={`${journey.providerName} journey`}>
      <div className="journey-card-top">
        <div className={`provider-symbol ${journey.mode}`}>
          <Icon size={20} aria-hidden="true" />
        </div>
        <div className="provider-name">
          <h3>{journey.providerName}</h3>
          <span>
            {modeLabels[journey.mode]} ·{' '}
            {journey.isSample ? 'Sample operator' : 'Published service'}
          </span>
        </div>
        {badge && <span className="journey-badge">{badge}</span>}
      </div>
      <div className="journey-card-main">
        <div className="journey-end">
          <strong>{clockTime(journey.departureAt, journey.timeZone)}</strong>
          <span>{journey.origin}</span>
        </div>
        <div className="journey-duration">
          <span>
            <Clock3 size={13} aria-hidden="true" />
            {duration(journey.durationMinutes)}
          </span>
          <div className="route-rule">
            <i />
            <i />
          </div>
          <span>Direct · no transfers</span>
        </div>
        <div className="journey-end">
          <strong>{clockTime(journey.arrivalAt, journey.timeZone)}</strong>
          <span>{journey.destination}</span>
        </div>
        <div className={`journey-fare ${!journey.estimatedFare ? 'unknown-fare' : ''}`}>
          <strong>{fareLabel(journey)}</strong>
          <span>{journey.estimatedFare ? 'est. CAD / person' : 'Check with provider'}</span>
        </div>
      </div>
      <div className="journey-card-bottom">
        <span className={stale ? 'freshness stale' : 'freshness'}>
          {stale ? <CircleAlert size={14} aria-hidden="true" /> : <span className="small-dot" />}
          {stale
            ? journey.isSample
              ? 'Older sample data · verify schedule'
              : 'Schedule over 24h old · verify with provider'
            : journey.isSample
              ? 'Sample schedule · updated within 24h'
              : 'Schedule verified within 24h'}
        </span>
        {onMap && (
          <button
            className="card-map-link"
            onClick={onMap}
            aria-label={`Show ${journey.providerName} on map`}
          >
            Show on map
          </button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={(event) => onDetails(event.currentTarget)}
          aria-label={`View ${journey.providerName} journey`}
        >
          View journey <ArrowRight size={15} aria-hidden="true" />
        </Button>
      </div>
    </article>
  )
}
