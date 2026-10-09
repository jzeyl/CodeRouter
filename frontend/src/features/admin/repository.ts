import { getAdminClient } from '@/lib/supabase'
import { journeyColumns, type JourneyRow } from '@/features/journeys/live-repository'

export type JourneyWrite = Pick<
  JourneyRow,
  | 'provider_name'
  | 'mode'
  | 'origin'
  | 'destination'
  | 'departure_at'
  | 'arrival_at'
  | 'time_zone'
  | 'fare_cad'
  | 'stops'
  | 'provider_url'
  | 'published'
  | 'route_geometry'
  | 'verified_at'
>
export async function loadAdminIdentity() {
  const client = getAdminClient()
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession()
  if (sessionError) throw new Error('Your session couldn’t be checked. Please try again.')
  if (!session) return null
  const {
    data: { user },
    error,
  } = await client.auth.getUser()
  if (error || !user)
    throw new Error('Your session could not be verified. Sign out and sign in again.')
  const membership = await client
    .from('moveon_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('enabled', true)
    .maybeSingle()
  if (membership.error)
    throw new Error(
      'Admin access could not be checked. The MoveON database setup or connection needs attention.',
    )
  return { id: user.id, email: user.email, allowed: !!membership.data }
}
export async function listAdminJourneys(page: number, status: string, signal?: AbortSignal) {
  let request = getAdminClient()
    .from('moveon_journeys')
    .select(journeyColumns, { count: 'exact' })
    .order('departure_at', { ascending: false })
    .order('id')
    .range(page * 20, page * 20 + 19)
  if (status !== 'all') request = request.eq('published', status === 'published')
  const { data, error, count } = await (signal ? request.abortSignal(signal) : request)
  if (error)
    throw new Error('Journeys couldn’t load. Check your connection and admin access, then retry.')
  return {
    rows: (data ?? []) as unknown as JourneyRow[],
    count: count ?? page * 20 + (data?.length ?? 0),
  }
}
export async function saveAdminJourney(payload: JourneyWrite, previous?: JourneyRow) {
  const table = getAdminClient().from('moveon_journeys')
  const request = previous
    ? table.update(payload).eq('id', previous.id).eq('updated_at', previous.updated_at)
    : table.insert(payload)
  const { data, error } = await request.select(journeyColumns).maybeSingle()
  if (error)
    throw new Error(
      'The journey wasn’t saved. Check your connection, admin access and required fields, then retry.',
    )
  if (!data)
    throw new Error(
      'This journey changed or your access was removed. Close the editor, refresh the list and reopen it before saving.',
    )
  return data as unknown as JourneyRow
}
