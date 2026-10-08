import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { readSearch } from './search'
import { journeyRepository } from './repository'
import { JourneyDetails } from './journey-details'
import './results.css'
import './phase-three.css'

export function PrintPage() {
  const [params] = useSearchParams()
  const criteria = readSearch(params)
  const expired = !!params.get('date') && params.get('date') !== criteria.date
  const query = useQuery({
    queryKey: ['print-journey', criteria],
    queryFn: ({ signal }) => journeyRepository.search(criteria, signal),
    enabled: !expired,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  })
  const journey = query.data?.find((x) => x.id === params.get('trip'))
  return (
    <main id="main-content" className="print-page page-width">
      <div className="print-toolbar no-print">
        <Link to={`/search?${params}`}>← Back to journeys</Link>
        <Button
          disabled={!journey || query.isFetching || query.isError || expired}
          onClick={() => window.print()}
        >
          Print / save PDF
        </Button>
      </div>
      <p className="eyebrow">MoveON · Travel itinerary</p>
      {expired ? (
        <h1>This itinerary’s travel date has passed or is invalid.</h1>
      ) : query.isPending || query.isFetching ? (
        <p role="status">
          Loading current itinerary…{query.fetchStatus === 'paused' && ' Reconnect to continue.'}
        </p>
      ) : query.isError ? (
        <div role="alert">
          <h1>We couldn’t refresh this itinerary.</h1>
          <Button className="no-print" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : journey ? (
        <>
          <JourneyDetails journey={journey} now={query.dataUpdatedAt} presentation="print" />
          <p className="print-source">
            {journey.isSample ? 'Sample data checked' : 'Itinerary retrieved'}{' '}
            {new Date(query.dataUpdatedAt).toLocaleString('en-CA', { timeZone: 'America/Toronto' })}{' '}
            Eastern. This is not a ticket or reservation.
          </p>
        </>
      ) : (
        <h1>This journey is unavailable. Return to the search for current options.</h1>
      )}
    </main>
  )
}
