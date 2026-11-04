import { useEffect, useId, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, LogOut, ShieldCheck, RefreshCw, FileText, CircleCheck } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { getAdminClient } from '@/lib/supabase'
import { isLiveData } from '@/lib/data-source'
import { loadLiveCities } from '@/features/journeys/live-repository'
import {
  gtfsTimePattern,
  listAdminTrips,
  loadAdminIdentity,
  updateStopTime,
  type TripStop,
} from './repository'
import './admin.css'

export default function AdminPage() {
  const queryClient = useQueryClient()
  const identity = useQuery({
    queryKey: ['admin', 'identity'],
    queryFn: loadAdminIdentity,
    retry: false,
    staleTime: 0,
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    try {
      const {
        data: { subscription },
      } = getAdminClient().auth.onAuthStateChange((event) => {
        if (event === 'INITIAL_SESSION') return
        // Defer Supabase calls outside the auth callback lock.
        window.setTimeout(() => {
          void queryClient.cancelQueries({ queryKey: ['admin'] })
          queryClient.removeQueries({ queryKey: ['admin', 'journeys'] })
          queryClient.setQueryData(['admin', 'identity'], null)
          void queryClient.invalidateQueries({ queryKey: ['admin', 'identity'] })
        }, 0)
      })
      return () => subscription.unsubscribe()
    } catch {
      /* Configuration errors are surfaced by the identity query. */
    }
  }, [queryClient])
  const signIn = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const { error } = await getAdminClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error)
        throw new Error(
          'Sign-in failed. Check your email and password, or contact the project owner.',
        )
      setPassword('')
      await identity.refetch()
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const signOut = async () => {
    setBusy(true)
    setMessage('')
    try {
      const { error } = await getAdminClient().auth.signOut()
      if (error) throw new Error('Sign-out couldn’t complete. Please retry.')
      queryClient.removeQueries({ queryKey: ['admin', 'journeys'] })
      queryClient.setQueryData(['admin', 'identity'], null)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <main id="main-content" className="admin-page page-width">
      <Link to="/" className="results-back">
        <ArrowLeft size={15} aria-hidden="true" />
        Back to MoveON
      </Link>
      <div className="admin-intro">
        <div>
          <h1>MoveON Admin Portal</h1>
        </div>
        <ShieldCheck size={42} strokeWidth={1.2} aria-hidden="true" />
      </div>
      {message && (
        <p className="admin-error" role="alert">
          {message}
        </p>
      )}
      {identity.isPending ? (
        <p role="status">Checking administrator access…</p>
      ) : identity.isError ? (
        <section className="admin-login">
          <h2>Connection needs attention</h2>
          <p role="alert">{identity.error.message}</p>
          <div className="action-buttons">
            <Button onClick={() => identity.refetch()}>Retry connection</Button>
            <Button variant="ghost" onClick={signOut} disabled={busy}>
              Sign out
            </Button>
          </div>
        </section>
      ) : !identity.data ? (
        <section className="admin-login">
          <h2>Welcome</h2>
          <p>
            Sign in with your administrator credentials
          </p>
          <form onSubmit={signIn}>
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </section>
      ) : !identity.data.allowed ? (
        <section className="admin-login">
          <h2>Administrator access required</h2>
          <p>
            This account is signed in but hasn’t been approved to manage MoveON services. Contact
            the project owner.
          </p>
          <Button variant="secondary" disabled={busy} onClick={signOut}>
            Sign out
          </Button>
        </section>
      ) : (
        <>
          <div className="admin-session">
            <span>{identity.data.email}</span>
            <Button variant="ghost" size="sm" disabled={busy} onClick={signOut}>
              <LogOut size={15} aria-hidden="true" />
              Sign out
            </Button>
          </div>
          <AdminWorkspace key={identity.data.id} />
        </>
      )}
    </main>
  )
}
function AdminWorkspace() {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const cities = useQuery({
    queryKey: ['admin', 'cities'],
    queryFn: ({ signal }) => loadLiveCities(signal),
    staleTime: 60_000,
  })
  const known = (city: string) => !!cities.data?.includes(city)
  const ready = known(origin) && known(destination) && origin !== destination
  const trips = useQuery({
    queryKey: ['admin', 'trips', origin, destination],
    queryFn: ({ signal }) => listAdminTrips(origin, destination, signal),
    enabled: ready,
    retry: 1,
    staleTime: 0,
  })
  return (
    <>
      <div className="admin-status-grid">
        <article>
          <CircleCheck size={20} aria-hidden="true" />
          <h2>Traveller search</h2>
          <p>{isLiveData ? 'Live database mode' : 'Sample preview mode'}</p>
        </article>
        <article>
          <RefreshCw size={20} aria-hidden="true" />
          <h2>Daily imports</h2>
          <p>Not configured · feed undecided</p>
        </article>
        <article>
          <FileText size={20} aria-hidden="true" />
          <h2>External backups</h2>
          <p>Not configured · destination undecided</p>
        </article>
      </div>
      <section className="admin-inventory" aria-labelledby="inventory-title">
        <div className="admin-toolbar">
          <div>
            <div className="eyebrow">Service inventory</div>
            <h2 id="inventory-title">Trips</h2>
          </div>
          {ready && (
            <Button
              variant="ghost"
              size="sm"
              disabled={trips.isFetching}
              onClick={() => trips.refetch()}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Refresh list
            </Button>
          )}
        </div>
        {cities.isError && (
          <div className="admin-error" role="alert">
            <p>{cities.error.message}</p>
            <Button variant="secondary" onClick={() => cities.refetch()}>
              Try again
            </Button>
          </div>
        )}
        <div className="admin-fields">
          <CitySelect label="Starting city" value={origin} onChange={setOrigin} cities={cities.data} />
          <CitySelect
            label="Destination city"
            value={destination}
            onChange={setDestination}
            cities={cities.data}
          />
        </div>
        {!ready ? (
          <p className="admin-hint">
            Type or pick two different cities from the list to see the trips between them.
          </p>
        ) : trips.isError ? (
          <div className="admin-error" role="alert">
            <p>{trips.error.message}</p>
            <Button variant="secondary" onClick={() => trips.refetch()}>
              Try again
            </Button>
          </div>
        ) : trips.isPending ? (
          <p role="status">Loading trips…</p>
        ) : !trips.data.length ? (
          <div className="admin-empty">
            <FileText size={30} aria-hidden="true" />
            <h3>No trips found.</h3>
            <p>No trip stops in both {origin} and {destination}.</p>
          </div>
        ) : (
          <>
            <p role="status" className="admin-hint">
              {trips.data.length} trips stop in both cities
            </p>
            <ul className="admin-trips">
              {trips.data.map((trip) => {
                const first = trip.stops[0]
                const last = trip.stops[trip.stops.length - 1]
                return (
                  <li key={trip.key}>
                    <details>
                      <summary>
                        <strong>
                          {first?.city_name ?? first?.stop_name} → {last?.city_name ?? last?.stop_name}
                        </strong>{' '}
                        · {trip.providerName} · trip {trip.tripId} · departs{' '}
                        {first?.departure_time ?? '—'} · {trip.stops.length} stops
                      </summary>
                      <ul>
                        {trip.stops.map((stop) => (
                          <li key={stop.ID}>
                            <details>
                              <summary>
                                {stop.stop_sequence}. {stop.stop_name}
                                {stop.city_name && ` · ${stop.city_name}`} · arrives{' '}
                                {stop.arrival_time ?? '—'} · departs {stop.departure_time ?? '—'}
                              </summary>
                              <StopTimeForm stop={stop} />
                            </details>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>
    </>
  )
}
function CitySelect(props: {
  label: string
  value: string
  onChange: (city: string) => void
  cities?: string[]
}) {
  const listId = useId()
  return (
    <label>
      {props.label}
      <input
        list={listId}
        autoComplete="off"
        placeholder={props.cities ? 'Start typing a city' : 'Loading cities…'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
      <datalist id={listId}>
        {props.cities?.map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>
    </label>
  )
}
function StopTimeForm({ stop }: { stop: TripStop }) {
  const queryClient = useQueryClient()
  const [arrival, setArrival] = useState(stop.arrival_time ?? '')
  const [departure, setDeparture] = useState(stop.departure_time ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await updateStopTime(stop.ID, arrival.trim(), departure.trim())
      setMessage('Saved.')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'trips'] })
      void queryClient.invalidateQueries({ queryKey: ['journeys'] })
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="admin-stop-form" onSubmit={save}>
      <label>
        Arrival time
        <input
          required
          pattern={gtfsTimePattern}
          title="HH:MM:SS, for example 08:05:00"
          value={arrival}
          onChange={(e) => setArrival(e.target.value)}
        />
      </label>
      <label>
        Departure time
        <input
          required
          pattern={gtfsTimePattern}
          title="HH:MM:SS, for example 08:05:00"
          value={departure}
          onChange={(e) => setDeparture(e.target.value)}
        />
      </label>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? 'Saving…' : 'Save times'}
      </Button>
      {message && (
        <p role="status" className="admin-hint">
          {message}
        </p>
      )}
    </form>
  )
}
