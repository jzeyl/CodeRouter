import { lazy, Suspense } from 'react'
import { isLiveData } from '@/lib/data-source'
import {
  ArrowRight,
  ArrowUpRight,
  BusFront,
  MapPinned,
  MoveUpRight,
  Route,
  TrainFront,
  Users,
  ExternalLink,
} from 'lucide-react'
import { Routes, Route as PageRoute, Link } from 'react-router'
import { ThemePicker } from '@/components/theme-picker'
import { JourneyPreview } from '@/components/journey-preview'
import { SearchForm } from '@/features/journeys/search-form'
import { SavedPage } from '@/features/journeys/saved-page'
import { PrintPage } from '@/features/journeys/print-page'
import { ResultsPage } from '@/features/journeys/results-page'
import { Button } from '@/components/ui/button'

const AdminPage = lazy(() => import('@/features/admin/admin-page'))
const currentYear = new Date().getFullYear()
const features = [
  {
    number: '01',
    icon: MapPinned,
    title: 'Start with a place.',
    text: 'A familiar city. A new corner of Ontario. Tell us where you’d like to go and when.',
  },
  {
    number: '02',
    icon: Route,
    title: 'Find your kind of journey.',
    text: 'Compare the routes, stops, and travel times that make sense for your day.',
  },
  {
    number: '03',
    icon: ExternalLink,
    title: 'Take the next step.',
    text: 'Head straight to the transit provider to confirm your trip and book your ticket.',
  },
]
function Home() {
  return (
    <main id="main-content">
      <section className="hero page-width" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" /> Ontario, a little closer
          </div>
          <h1 id="hero-title">
            A better way
            <br />
            to <em>get there.</em>
          </h1>
          <p className="hero-description">
            Big cities. Small-town connections.
            <br />
            Discover a simpler way to travel across Ontario.
          </p>
          <div className="travel-modes" aria-label="Planned transport coverage">
            <span>
              <BusFront size={16} aria-hidden="true" /> Coaches
            </span>
            <span>
              <TrainFront size={16} aria-hidden="true" /> Trains
            </span>
            <span>
              <Users size={16} aria-hidden="true" /> Regional shuttles
            </span>
          </div>
        </div>
        <JourneyPreview />
      </section>
      <div className="page-width">
        <SearchForm />
      </div>
      <section className="how-section page-width" id="how-it-works" aria-labelledby="how-title">
        <div className="section-intro">
          <div>
            <div className="eyebrow">Less searching. More going.</div>
            <h2 id="how-title">
              Your next trip,
              <br />
              <em>a little simpler.</em>
            </h2>
          </div>
          <p>
            Ontario has more ways to get around than you might think. We’re bringing them together,
            one connection at a time.
          </p>
        </div>
        <div className="feature-grid">
          {features.map(({ number, icon: Icon, title, text }) => (
            <article className="feature" key={number}>
              <div className="feature-top">
                <span>{number}</span>
                <Icon size={25} strokeWidth={1.4} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="ontario-section page-width" aria-labelledby="ontario-title">
        <div className="ontario-panel">
          <div className="ontario-copy">
            <div className="eyebrow">Room to roam</div>
            <h2 id="ontario-title">
              For the places
              <br />
              in between.
            </h2>
            <p>
              Beyond the usual stops, there’s a whole province to discover. MoveON is made for the
              connections that bring more of Ontario within reach.
            </p>
            <a href="#plan" className="text-link">
              Where will you go? <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </div>
          <div className="connection-art" aria-hidden="true">
            <span className="connection-label first">The everyday</span>
            <div className="connection-track">
              <span className="connection-node start" />
              <span className="connection-dash" />
              <span className="connection-node middle" />
              <span className="connection-dash" />
              <span className="connection-node end" />
            </div>
            <span className="connection-label last">The unexpected</span>
            <div className="connection-legend">
              <span>
                <i className="coach-swatch" /> Coach
              </span>
              <span>
                <i className="rail-swatch" /> Rail
              </span>
              <span>
                <i className="shuttle-swatch" /> Shuttle
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
function NotFound() {
  return (
    <main id="main-content" className="not-found page-width">
      <div className="eyebrow">A small detour</div>
      <h1>This stop isn’t on our route.</h1>
      <p>Let’s get you back to planning your next journey.</p>
      <Button asChild>
        <Link to="/">
          Back to MoveON <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </Button>
    </main>
  )
}
export default function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header page-width">
        <Link className="brand" to="/" aria-label="MoveON home">
          <span className="brand-symbol">
            <MoveUpRight size={22} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span>
            Move<span className="brand-on">ON</span>
          </span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="/#plan">Plan a trip</a>
          <Link to="/saved">Saved journeys</Link>
        </nav>
        <ThemePicker />
      </header>
      <Routes>
        <PageRoute path="/" element={<Home />} />
        <PageRoute path="/search" element={<ResultsPage />} />
        <PageRoute
          path="/admin"
          element={
            <Suspense
              fallback={
                <main id="main-content" className="page-width" role="status">
                  Loading service desk…
                </main>
              }
            >
              <AdminPage />
            </Suspense>
          }
        />
        <PageRoute path="/saved" element={<SavedPage />} />
        <PageRoute path="/print" element={<PrintPage />} />
        <PageRoute path="*" element={<NotFound />} />
      </Routes>
      <footer className="site-footer page-width">
        <div className="footer-top">
          <Link className="brand footer-brand" to="/">
            MoveON
            <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
          <p>
            A little less searching.
            <br />A little more Ontario.
          </p>
          <Link to="/admin" className="back-top">
            Service desk
          </Link>
          <a className="back-top" href="#top">
            Back to top <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
        <div className="footer-bottom">
          <span>© {currentYear} MoveON · Made for Ontario.</span>
          <span className="preview-notice">
            <span className="small-dot" />{' '}
            {isLiveData
              ? 'Confirm current details with your provider'
              : 'Design preview · No live schedules or fares'}
          </span>
        </div>
      </footer>
    </>
  )
}
