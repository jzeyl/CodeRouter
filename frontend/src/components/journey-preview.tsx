import { ArrowUpRight, BusFront, Leaf } from 'lucide-react'

export function JourneyPreview() {
  return (
    <div
      className="journey-art"
      aria-label="Illustrative journey from Toronto to Ottawa, not a live service"
    >
      <svg className="contour-art" viewBox="0 0 520 470" fill="none" aria-hidden="true">
        <path d="M430 -25C510 54 539 131 477 189S267 191 231 266 315 403 202 484" />
        <path d="M404 -28C484 51 513 128 451 186S241 188 205 263 289 400 176 481" />
        <path d="M378 -31C458 48 487 125 425 183S215 185 179 260 263 397 150 478" />
        <path d="M352 -34C432 45 461 122 399 180S189 182 153 257 237 394 124 475" />
        <path d="M326 -37C406 42 435 119 373 177S163 179 127 254 211 391 98 472" />
        <path d="M300 -40C380 39 409 116 347 174S137 176 101 251 185 388 72 469" />
        <path d="M274 -43C354 36 383 113 321 171S111 173 75 248 159 385 46 466" />
      </svg>
      <div className="art-caption">
        <span className="caption-rule" /> A little closer.
      </div>
      <article className="preview-ticket">
        <div className="ticket-top">
          <span className="transport-tag">
            <BusFront size={15} aria-hidden="true" /> By coach
          </span>
          <span className="sample-tag">Sample journey</span>
        </div>
        <div className="ticket-destination">
          <span>From the familiar</span>
          <div>
            to somewhere new.
            <ArrowUpRight size={27} strokeWidth={1.3} aria-hidden="true" />
          </div>
        </div>
        <div className="ticket-timeline">
          <div className="timeline-city">
            <span className="timeline-dot" />
            <div>
              <strong>Toronto</strong>
              <span>The journey begins</span>
            </div>
          </div>
          <div className="timeline-connector">
            <span>Across Ontario</span>
          </div>
          <div className="timeline-city">
            <span className="timeline-dot arrival" />
            <div>
              <strong>Ottawa</strong>
              <span>A change of scenery</span>
            </div>
          </div>
        </div>
        <div className="ticket-bottom">
          <Leaf size={15} aria-hidden="true" />
          <span>More connections. More possibilities.</span>
        </div>
      </article>
      <div className="art-footnote">
        <span className="art-star" aria-hidden="true">
          ✳
        </span>{' '}
        Wherever you’re going,
        <br />
        there’s a way forward.
      </div>
    </div>
  )
}
