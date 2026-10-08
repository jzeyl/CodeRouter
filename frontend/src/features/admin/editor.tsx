import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { mapJourney, type JourneyRow } from '@/features/journeys/live-repository'
import { safeProviderUrl } from '@/features/journeys/format'
import type { JourneyStop } from '@/features/journeys/types'
import { saveAdminJourney } from './repository'

type StopDraft = {
  name: string
  city: string
  note: string
  arrival: string
  departure: string
  latitude: string
  longitude: string
}
const blankStop = (): StopDraft => ({
  name: '',
  city: '',
  note: '',
  arrival: '',
  departure: '',
  latitude: '',
  longitude: '',
})
const toDraft = (stop: JourneyStop): StopDraft => ({
  name: stop.name,
  city: stop.city,
  note: stop.locationNote,
  arrival: stop.arrivalTime ?? '',
  departure: stop.departureTime ?? '',
  latitude: stop.latitude?.toString() ?? '',
  longitude: stop.longitude?.toString() ?? '',
})
export function JourneyEditor({
  journey,
  onSaved,
  onCancel,
}: {
  journey?: JourneyRow
  onSaved: () => void
  onCancel: () => void
}) {
  const [provider, setProvider] = useState(journey?.provider_name ?? '')
  const [mode, setMode] = useState(journey?.mode ?? 'coach')
  const [fare, setFare] = useState(journey?.fare_cad?.toString() ?? '')
  const [url, setUrl] = useState(journey?.provider_url ?? '')
  const [published, setPublished] = useState(journey?.published ?? false)
  const [verified, setVerified] = useState(false)
  const [stops, setStops] = useState<StopDraft[]>(
    journey?.stops.map(toDraft) ?? [blankStop(), blankStop()],
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const updateStop = (index: number, key: keyof StopDraft, value: string) =>
    setStops((current) => current.map((s, i) => (i === index ? { ...s, [key]: value } : s)))
  const save = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      if (published && !verified)
        throw new Error('Confirm that you verified this service before publishing.')
      if (url && !safeProviderUrl(url))
        throw new Error('Use a valid HTTPS provider website without embedded credentials.')
      if (published && !url) throw new Error('Add the official provider website before publishing.')
      const actualStops = stops.map((s): JourneyStop => ({
        name: s.name.trim(),
        city: s.city.trim(),
        locationNote: s.note.trim(),
        ...(s.arrival ? { arrivalTime: s.arrival.trim() } : {}),
        ...(s.departure ? { departureTime: s.departure.trim() } : {}),
        ...(s.latitude !== '' || s.longitude !== ''
          ? {
              latitude: s.latitude === '' ? NaN : Number(s.latitude),
              longitude: s.longitude === '' ? NaN : Number(s.longitude),
            }
          : {}),
      }))
      const departure = actualStops[0].departureTime
      const arrival = actualStops.at(-1)!.arrivalTime
      if (!departure || !arrival)
        throw new Error(
          'Enter a departure time at the first stop and an arrival time at the last stop.',
        )
      const now = new Date().toISOString()
      const geographyUnchanged =
        journey &&
        JSON.stringify(actualStops.map((s) => [s.city, s.latitude, s.longitude])) ===
          JSON.stringify(journey.stops.map((s) => [s.city, s.latitude, s.longitude]))
      const payload = {
        provider_name: provider.trim(),
        mode,
        origin: actualStops[0].city,
        destination: actualStops.at(-1)!.city,
        departure_at: departure,
        arrival_at: arrival,
        time_zone: 'America/Toronto',
        fare_cad: fare === '' ? null : Number(fare),
        stops: actualStops,
        provider_url: url.trim() || null,
        published,
        verified_at: verified ? now : (journey?.verified_at ?? null),
        route_geometry: geographyUnchanged ? journey.route_geometry : null,
      }
      // Validate drafts too, without claiming that draft data was verified.
      mapJourney({
        ...payload,
        id: journey?.id ?? 'new',
        verified_at: payload.verified_at ?? now,
        updated_at: now,
        source_kind: journey?.source_kind ?? 'manual',
        manual_override: false,
      })
      setBusy(true)
      await saveAdminJourney(payload, journey)
      onSaved()
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="eyebrow">Service desk · Direct journeys</div>
      <DialogTitle className="dialog-title">
        {journey ? 'Edit journey' : 'Create a journey'}
      </DialogTitle>
      <DialogDescription className="dialog-description">
        Start with a complete draft. Publish only after checking the service with its provider. All
        displayed times are Eastern.
      </DialogDescription>
      <form className="admin-editor" onSubmit={save}>
        <fieldset disabled={busy}>
          <div className="admin-fields">
            <label>
              Provider name
              <input
                required
                maxLength={150}
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              />
            </label>
            <label>
              Transport
              <select value={mode} onChange={(e) => setMode(e.target.value as JourneyRow['mode'])}>
                <option value="coach">Coach</option>
                <option value="rail">Rail</option>
                <option value="shuttle">Shuttle</option>
              </select>
            </label>
            <label>
              Fare in CAD
              <input
                type="number"
                min="0"
                max="10000"
                step="0.01"
                value={fare}
                onChange={(e) => setFare(e.target.value)}
                placeholder="Leave blank if unavailable"
              />
            </label>
            <label>
              Official provider website
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
          </div>
          <h3>Stops, in travel order</h3>
          <p className="admin-hint">
            Use a full date and time with its UTC offset, for example 2026-10-08T09:15:00-04:00. The
            offset keeps overnight journeys and clock changes unambiguous. Coordinates are optional;
            leave both blank when unknown.
          </p>
          {stops.map((stop, index) => (
            <fieldset className="admin-stop" key={index}>
              <legend>
                {index === 0
                  ? 'Departure'
                  : index === stops.length - 1
                    ? 'Arrival'
                    : `Intermediate stop ${index}`}
              </legend>
              <div className="admin-fields">
                <label>
                  Stop name
                  <input
                    required
                    maxLength={150}
                    value={stop.name}
                    onChange={(e) => updateStop(index, 'name', e.target.value)}
                  />
                </label>
                <label>
                  City
                  <input
                    required
                    maxLength={100}
                    value={stop.city}
                    onChange={(e) => updateStop(index, 'city', e.target.value)}
                  />
                </label>
                {index > 0 && (
                  <label>
                    Arrival time with offset
                    <input
                      required
                      value={stop.arrival}
                      onChange={(e) => updateStop(index, 'arrival', e.target.value)}
                      placeholder="2026-10-08T14:00:00-04:00"
                    />
                  </label>
                )}
                {index < stops.length - 1 && (
                  <label>
                    Departure time with offset
                    <input
                      required
                      value={stop.departure}
                      onChange={(e) => updateStop(index, 'departure', e.target.value)}
                      placeholder="2026-10-08T09:15:00-04:00"
                    />
                  </label>
                )}
                <label>
                  Latitude
                  <input
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    value={stop.latitude}
                    onChange={(e) => updateStop(index, 'latitude', e.target.value)}
                  />
                </label>
                <label>
                  Longitude
                  <input
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    value={stop.longitude}
                    onChange={(e) => updateStop(index, 'longitude', e.target.value)}
                  />
                </label>
                <label className="wide-field">
                  Boarding / arrival instructions
                  <input
                    maxLength={500}
                    value={stop.note}
                    onChange={(e) => updateStop(index, 'note', e.target.value)}
                  />
                </label>
              </div>
              {index > 0 && index < stops.length - 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStops((s) => s.filter((_, i) => i !== index))}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Remove intermediate stop {index}
                </Button>
              )}
            </fieldset>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={stops.length >= 30}
            onClick={() => setStops((s) => [...s.slice(0, -1), blankStop(), s.at(-1)!])}
          >
            <Plus size={15} aria-hidden="true" />
            Add intermediate stop
          </Button>
          <div className="admin-publication">
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              Publish in traveller search
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
              />
              I checked the times, stops, fare and website with the provider.
            </label>
            <p className="admin-hint">
              Saving as a draft removes this journey from public search. Imported records edited
              here will be marked as manual overrides.
            </p>
          </div>
        </fieldset>
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        <div className="action-buttons">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : published ? 'Save and publish' : 'Save draft'}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </>
  )
}
