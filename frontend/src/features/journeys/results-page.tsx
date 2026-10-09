import { isLiveData } from '@/lib/data-source'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  SlidersHorizontal,
  Route,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { SearchForm } from './search-form'
import { readSearch, searchParams } from './search'
import { journeyRepository } from './repository'
import { dateLabel, modeLabels } from './format'
import { readFilters, filterJourneys } from './filter'
import { JourneyCard } from './journey-card'
import { JourneyDetails } from './journey-details'
import './results.css'
import './phase-three.css'
const JourneyMap = lazy(() => import('./journey-map'))

export function ResultsPage() {
  const [params, setParams] = useSearchParams()
  const criteria = readSearch(params)
  const filters = readFilters(params)
  const [editOpen, setEditOpen] = useState(false)
  const detailTrigger = useRef<HTMLButtonElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const criteriaKey = searchParams(criteria).toString()
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [criteriaKey])
  const query = useQuery({
    queryKey: ['journeys', criteria],
    queryFn: ({ signal }) => journeyRepository.search(criteria, signal),
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const journeys = query.data ?? []
  const visible = filterJourneys(journeys, filters)
  const mapSelected = visible.find((x) => x.id === params.get('mapTrip')) ?? visible[0]
  const now = query.dataUpdatedAt
  const invalidSharedDate =
    !!params.get('trip') && !!params.get('date') && params.get('date') !== criteria.date
  const selected =
    !invalidSharedDate && journeys.find((journey) => journey.id === params.get('trip'))
  const cheapest = Math.min(
    ...journeys.flatMap((journey) => (journey.estimatedFare ? [journey.estimatedFare.amount] : [])),
  )
  const fastest = Math.min(...journeys.map((journey) => journey.durationMinutes))
  const activeFilters =
    filters.mode !== 'all' || filters.budget !== 'any' || filters.maxDuration !== 'any'
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    next.set(key, value)
    if (key !== 'trip') next.delete('trip')
    setParams(next, { preventScrollReset: true })
  }
  const reset = () => {
    const next = new URLSearchParams(params)
    ;['mode', 'budget', 'duration'].forEach((key) => next.delete(key))
    setParams(next, { preventScrollReset: true })
  }
  const closeDetails = () => {
    const next = new URLSearchParams(params)
    next.delete('trip')
    setParams(next, { replace: true, preventScrollReset: true })
  }
  return (
    <main className="results-page page-width" id="main-content">
      <Link className="results-back" to={`/?${searchParams(criteria)}#plan`}>
        <ArrowLeft size={15} aria-hidden="true" />
        Back to planning
      </Link>
      <div className="results-intro">
        <div>
          <div className="eyebrow">A few ways to get there</div>
          <h1 ref={heading} tabIndex={-1}>
            {criteria.origin} <ArrowRight size={30} strokeWidth={1.3} aria-label="to" />{' '}
            <em>{criteria.destination}</em>
          </h1>
          <p>
            {dateLabel(criteria.date)} <span>·</span> Leave after {criteria.time} Eastern{' '}
            <span>·</span> One way
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setEditOpen(!editOpen)}
          aria-expanded={editOpen}
          aria-controls="edit-search"
        >
          {editOpen ? 'Hide search' : 'Edit search'}
          <SlidersHorizontal size={16} aria-hidden="true" />
        </Button>
      </div>
      {editOpen && (
        <div id="edit-search" className="edit-search-panel">
          <SearchForm key={searchParams(criteria).toString()} compact />
        </div>
      )}
      <div className="results-sample-note">
        <CircleAlert size={16} aria-hidden="true" />
        <p>
          {isLiveData ? (
            <>
              Published service information. Confirm times, fares and boarding details with the
              provider before travelling.
            </>
          ) : (
            <>
              <strong>A preview of the possibilities.</strong> These are fictional operators and
              example journeys, not live schedules or bookable fares.
            </>
          )}
        </p>
      </div>
      <div className="view-switch" aria-label="Results view">
        <Button
          variant={params.get('view') === 'map' ? 'ghost' : 'secondary'}
          aria-pressed={params.get('view') !== 'map'}
          onClick={() => setParam('view', 'list')}
        >
          List view
        </Button>
        <Button
          variant={params.get('view') === 'map' ? 'secondary' : 'ghost'}
          aria-pressed={params.get('view') === 'map'}
          onClick={() => setParam('view', 'map')}
        >
          Map & list
        </Button>
      </div>
      {params.get('view') === 'map' && visible.length > 0 && (
        <Suspense fallback={<p role="status">Loading map…</p>}>
          <JourneyMap
            journeys={visible}
            selectedId={mapSelected.id}
            onSelect={(id) => setParam('mapTrip', id)}
          />
        </Suspense>
      )}
      <div className="results-workspace">
        <aside className="journey-filters" aria-label="Filter journeys">
          <div className="filter-heading">
            <h2>Make it your trip</h2>
            <SlidersHorizontal size={16} aria-hidden="true" />
          </div>
          <label>
            Travel by
            <select
              value={filters.mode}
              onChange={(event) => setParam('mode', event.target.value)}
              aria-label="Transport type"
            >
              <option value="all">All transport</option>
              {Object.entries(modeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estimated budget
            <select
              value={filters.budget}
              onChange={(event) => setParam('budget', event.target.value)}
              aria-label="Maximum fare"
            >
              <option value="any">Any price</option>
              <option value="40">Up to $40 CAD</option>
              <option value="60">Up to $60 CAD</option>
              <option value="80">Up to $80 CAD</option>
            </select>
          </label>
          <label>
            Journey length
            <select
              value={filters.maxDuration}
              onChange={(event) => setParam('duration', event.target.value)}
              aria-label="Maximum duration"
            >
              <option value="any">Any duration</option>
              <option value="180">Up to 3 hours</option>
              <option value="300">Up to 5 hours</option>
              <option value="360">Up to 6 hours</option>
            </select>
          </label>
          {filters.budget !== 'any' && (
            <p className="filter-hint">
              Journeys without a fare estimate are hidden while a budget is selected.
            </p>
          )}
          {activeFilters && (
            <button className="reset-filters" onClick={reset}>
              <RotateCcw size={13} aria-hidden="true" />
              Reset filters
            </button>
          )}
          <div className="direct-note">
            <Route size={20} strokeWidth={1.4} aria-hidden="true" />
            <h3>
              One service.
              <br />A simpler journey.
            </h3>
            <p>
              All options are direct. Some services make stops along the way, with no transfers.
            </p>
          </div>
        </aside>
        <section className="results-list" aria-label="Journey results">
          <div className="results-toolbar">
            <p role="status" aria-live="polite">
              {query.isPending ? (
                'Finding your options…'
              ) : query.isError ? (
                'Search unavailable'
              ) : (
                <>
                  <strong>{visible.length}</strong>{' '}
                  {isLiveData
                    ? visible.length === 1
                      ? 'journey'
                      : 'journeys'
                    : visible.length === 1
                      ? 'sample journey'
                      : 'sample journeys'}
                  {activeFilters && ` of ${journeys.length}`}
                </>
              )}
            </p>
            <label>
              Sort by
              <select
                aria-label="Sort journeys"
                value={filters.sort}
                onChange={(event) => setParam('sort', event.target.value)}
              >
                <option value="departure">Departure time</option>
                <option value="price">Lowest price</option>
                <option value="duration">Shortest journey</option>
              </select>
            </label>
          </div>
          {query.isPending ? (
            <div
              className="loading-journeys"
              aria-label={isLiveData ? 'Loading journeys' : 'Loading sample journeys'}
              aria-busy="true"
            >
              {[0, 1, 2].map((index) => (
                <div className="journey-skeleton" key={index} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              ))}
              {query.fetchStatus === 'paused' && (
                <p className="muted-text">You appear to be offline. Reconnect to load journeys.</p>
              )}
            </div>
          ) : query.isError ? (
            <div className="result-message" role="alert">
              <CircleAlert size={30} strokeWidth={1.2} aria-hidden="true" />
              <h2>A small detour.</h2>
              <p>We couldn’t load the journeys. Your search is still here—please try again.</p>
              <Button onClick={() => query.refetch()} disabled={query.isFetching}>
                {query.isFetching ? 'Trying again…' : 'Try again'}
                <RotateCcw size={15} aria-hidden="true" />
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className="result-message">
              <Route size={32} strokeWidth={1.2} aria-hidden="true" />
              <h2>
                {journeys.length
                  ? 'A little more room to explore.'
                  : isLiveData
                    ? 'No published journeys for this search.'
                    : 'No sample journeys for this search.'}
              </h2>
              <p>
                {journeys.length
                  ? 'No journeys match these filters. Try a wider budget or a different travel type.'
                  : isLiveData
                    ? 'Try a different date, departure time or city pair. Published services may not cover every journey yet.'
                    : 'Try Toronto to Ottawa before 15:00 for a full preview. This sample collection doesn’t represent actual service availability.'}
              </p>
              {journeys.length ? (
                <Button onClick={reset}>
                  Clear filters
                  <ArrowRight size={15} aria-hidden="true" />
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  Edit your search
                  <ArrowRight size={15} aria-hidden="true" />
                </Button>
              )}
            </div>
          ) : (
            <ul className="journey-cards">
              {visible.map((journey) => (
                <li
                  key={journey.id}
                  className={
                    params.get('view') === 'map' && mapSelected?.id === journey.id
                      ? 'map-selected-card'
                      : undefined
                  }
                >
                  <JourneyCard
                    journey={journey}
                    now={now}
                    onMap={() => {
                      const next = new URLSearchParams(params)
                      next.set('view', 'map')
                      next.set('mapTrip', journey.id)
                      setParams(next, { preventScrollReset: true })
                      requestAnimationFrame(() =>
                        document
                          .querySelector('.view-switch')
                          ?.scrollIntoView({ block: 'start', behavior: 'instant' }),
                      )
                    }}
                    badge={
                      journey.durationMinutes === fastest
                        ? 'Shortest journey'
                        : journey.estimatedFare?.amount === cheapest
                          ? 'Lowest price'
                          : undefined
                    }
                    onDetails={(button) => {
                      detailTrigger.current = button
                      setParam('trip', journey.id)
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="results-footnote">
            All times Eastern. Prices are estimates in CAD per person. Confirm live details with the
            provider.
          </p>
        </section>
      </div>
      <Dialog
        open={!!params.get('trip') && !query.isPending && !query.isError}
        onOpenChange={(open) => {
          if (!open) closeDetails()
        }}
      >
        <DialogContent
          className="itinerary-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (detailTrigger.current?.isConnected) detailTrigger.current.focus()
            else heading.current?.focus()
          }}
        >
          {selected ? (
            <JourneyDetails journey={selected} now={now} criteria={criteria} />
          ) : (
            <>
              <DialogTitle className="dialog-title">
                {invalidSharedDate
                  ? 'This itinerary’s date is no longer available.'
                  : 'This journey isn’t in these results.'}
              </DialogTitle>
              <DialogDescription className="dialog-description">
                {invalidSharedDate
                  ? 'The shared date has passed or is invalid. Close this view and choose a new travel date; these results use a new date.'
                  : 'It may belong to another search. Close this view to explore the current options.'}
              </DialogDescription>
              <Button className="dialog-action" onClick={closeDetails}>
                Back to results
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
