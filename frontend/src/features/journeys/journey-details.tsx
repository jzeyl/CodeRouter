import { ExternalLink, CircleAlert, MapPin } from 'lucide-react'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { clockTime, duration, fareLabel, isStale, modeLabels, safeProviderUrl } from './format'
import { JourneyActions } from './journey-actions'
import type { Journey, JourneySearch } from './types'

export function JourneyDetails({
  journey,
  now,
  criteria,
  presentation = 'dialog',
}: {
  journey: Journey
  now: number
  criteria?: JourneySearch
  presentation?: 'dialog' | 'print'
}) {
  const SectionHeading = presentation === 'print' ? 'h2' : 'h3'
  const StopHeading = presentation === 'print' ? 'h3' : 'h4'
  const Title = presentation === 'print' ? 'h1' : DialogTitle
  const Description = presentation === 'print' ? 'p' : DialogDescription
  const providerUrl = !journey.isSample ? safeProviderUrl(journey.providerUrl) : null
  return (
    <>
      <div className="eyebrow">Your journey, in detail</div>
      <Title className="dialog-title itinerary-title">
        {journey.origin} to {journey.destination}
      </Title>
      <Description className="dialog-description">
        {journey.providerName} · {modeLabels[journey.mode]} · Direct service
        <br />
        {new Intl.DateTimeFormat('en-CA', {
          timeZone: journey.timeZone,
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }).format(new Date(journey.departureAt))}
      </Description>
      {criteria && <JourneyActions key={journey.id} journey={journey} criteria={criteria} />}
      <div className="sample-disclaimer">
        <CircleAlert size={16} aria-hidden="true" />
        <p>
          {journey.isSample
            ? 'Illustrative journey. Operator, times, stops, and fares are sample data. This journey cannot be booked.'
            : 'Published service information. Confirm the latest details and book directly with the provider.'}
        </p>
      </div>
      <dl className="itinerary-facts">
        <div>
          <dt>Travel time</dt>
          <dd>{duration(journey.durationMinutes)}</dd>
        </div>
        <div>
          <dt>Changes</dt>
          <dd>No transfers</dd>
        </div>
        <div>
          <dt>Estimated fare</dt>
          <dd>
            {fareLabel(journey)}
            {journey.estimatedFare && <small> CAD / person</small>}
          </dd>
        </div>
      </dl>
      <div className="stops-heading">
        <SectionHeading>Along the way</SectionHeading>
        <span>All times Eastern</span>
      </div>
      <ol className="itinerary-stops">
        {journey.stops.map((stop, index) => (
          <li key={`${stop.name}-${index}`}>
            <div className="stop-time">
              {clockTime(stop.arrivalTime ?? stop.departureTime!, journey.timeZone)}
            </div>
            <div className="stop-line">
              <i className={index === journey.stops.length - 1 ? 'last-stop' : ''} />
            </div>
            <div className="stop-content">
              <div className="stop-kind">
                {index === 0
                  ? 'Departure'
                  : index === journey.stops.length - 1
                    ? 'Arrival'
                    : 'Intermediate stop'}
              </div>
              <StopHeading>{stop.name}</StopHeading>
              <p>
                <MapPin size={13} aria-hidden="true" />
                {stop.city}, Ontario
              </p>
              <p className="stop-note">{stop.locationNote}</p>
              {index > 0 && index < journey.stops.length - 1 && (
                <p className="stop-dwell">
                  Departs {clockTime(stop.departureTime!, journey.timeZone)} · Stay on board
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className={`data-freshness ${isStale(journey, now) ? 'outdated' : ''}`}>
        <CircleAlert size={15} aria-hidden="true" />
        <p>
          <strong>
            {isStale(journey, now) ? 'This schedule is over 24 hours old.' : 'Schedule information'}
          </strong>
          <br />
          Updated{' '}
          {new Intl.DateTimeFormat('en-CA', {
            timeZone: journey.timeZone,
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }).format(new Date(journey.updatedAt))}{' '}
          Eastern. Always confirm with the provider.
        </p>
      </div>
      <div className="provider-handoff">
        <SectionHeading>Continue with the provider</SectionHeading>
        <p>
          {providerUrl
            ? 'Confirm the current fare and boarding location on the provider’s website. Booking takes place outside MoveON.'
            : journey.isSample
              ? 'Booking links will be available for verified live services. Sample operators have no booking website.'
              : 'A verified booking website is unavailable for this service.'}
        </p>
        {providerUrl ? (
          <Button asChild>
            <a href={providerUrl} target="_blank" rel="noopener noreferrer">
              Provider website <ExternalLink size={16} aria-hidden="true" />
            </a>
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            {journey.isSample ? 'Booking unavailable for samples' : 'Provider link unavailable'}
          </Button>
        )}
      </div>
    </>
  )
}
