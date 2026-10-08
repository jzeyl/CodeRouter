import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  LogOut,
  Plus,
  ShieldCheck,
  RefreshCw,
  FileText,
  CircleCheck,
} from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { getAdminClient } from '@/lib/supabase'
import { isLiveData } from '@/lib/data-source'
import { type JourneyRow } from '@/features/journeys/live-repository'
import { loadAdminIdentity, listAdminJourneys } from './repository'
import { JourneyEditor } from './editor'
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
          <div className="eyebrow">MoveON · Service desk</div>
          <h1>
            A clear view of <em>every journey.</em>
          </h1>
          <p>Keep service information accurate, current and ready for travellers.</p>
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
          <div className="eyebrow">For authorised administrators</div>
          <h2>Welcome back.</h2>
          <p>
            Sign in with your approved MoveON account. Travellers can use the app without an
            account.
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
          <p className="admin-hint">
            Need an account or password reset? Contact your project administrator.
          </p>
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
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('all')
  const [editor, setEditor] = useState<JourneyRow | 'new' | null>(null)
  const [message, setMessage] = useState('')
  const query = useQuery({
    queryKey: ['admin', 'journeys', page, status],
    queryFn: ({ signal }) => listAdminJourneys(page, status, signal),
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
            <h2 id="inventory-title">Journeys</h2>
          </div>
          <Button
            onClick={() => {
              setEditor('new')
              setMessage('')
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Create journey
          </Button>
        </div>
        <div className="admin-list-tools">
          <label>
            Show
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(0)
              }}
            >
              <option value="all">All journeys</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
            </select>
          </label>
          <Button
            variant="ghost"
            size="sm"
            disabled={query.isFetching}
            onClick={() => query.refetch()}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Refresh list
          </Button>
        </div>
        <p role="status" className="admin-hint">
          {message ||
            (query.isFetching
              ? 'Refreshing journeys…'
              : `${query.data?.count ?? 0} journeys in this view`)}
        </p>
        {query.isError ? (
          <div className="admin-error" role="alert">
            <p>{query.error.message}</p>
            <Button variant="secondary" onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        ) : query.isPending ? (
          <p role="status">
            Loading service inventory…{query.fetchStatus === 'paused' && ' Reconnect to continue.'}
          </p>
        ) : !query.data.rows.length ? (
          <div className="admin-empty">
            <FileText size={30} aria-hidden="true" />
            <h3>A place for your next service.</h3>
            <p>
              {status === 'all'
                ? 'Create your first journey as a draft, then verify it before publishing.'
                : 'No journeys match this view.'}
            </p>
          </div>
        ) : (
          <ul className="admin-journeys">
            {query.data.rows.map((row) => (
              <li key={row.id}>
                <div>
                  <span className={`admin-badge ${row.published ? 'published' : ''}`}>
                    {row.published ? 'Published' : 'Draft'}
                  </span>
                  <h3>
                    {row.origin} → {row.destination}
                  </h3>
                  <p>
                    {row.provider_name} ·{' '}
                    {new Date(row.departure_at).toLocaleString('en-CA', {
                      timeZone: row.time_zone,
                    })}{' '}
                    Eastern
                  </p>
                  <p className="admin-hint">
                    {row.manual_override
                      ? 'Manual override · protected from imports'
                      : row.source_kind === 'import'
                        ? 'Imported service'
                        : 'Manually managed'}{' '}
                    ·{' '}
                    {row.verified_at
                      ? `Verified ${new Date(row.verified_at).toLocaleDateString('en-CA')}`
                      : 'Not verified'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditor(row)
                    setMessage('')
                  }}
                  aria-label={`Edit ${row.provider_name} journey`}
                >
                  Edit journey
                </Button>
              </li>
            ))}
          </ul>
        )}
        {(query.data?.count ?? 0) > 20 && (
          <div className="admin-pagination">
            <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span>Page {page + 1}</span>
            <Button
              variant="secondary"
              disabled={(page + 1) * 20 >= (query.data?.count ?? 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </section>
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
      >
        <DialogContent
          className="admin-editor-dialog"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {editor && (
            <JourneyEditor
              key={editor === 'new' ? 'new' : editor.id}
              journey={editor === 'new' ? undefined : editor}
              onCancel={() => setEditor(null)}
              onSaved={() => {
                setEditor(null)
                setMessage('Journey saved.')
                void client.invalidateQueries({ queryKey: ['admin', 'journeys'] })
                void client.invalidateQueries({ queryKey: ['journeys'] })
                void client.invalidateQueries({ queryKey: ['cities'] })
                void client.invalidateQueries({ queryKey: ['saved-journey'] })
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
