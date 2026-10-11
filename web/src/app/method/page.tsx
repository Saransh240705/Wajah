'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '../../lib/context';

export default function MethodPage() {
  const { dataset } = useApp();

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-16">
      {/* Back link */}
      <div>
        <Link
          href={`/board?dataset=${dataset}`}
          className="inline-flex items-center gap-1 font-mono text-xs font-bold text-ink underline hover:opacity-80"
        >
          <span>&lt;</span>
          <span>Board</span>
        </Link>
      </div>

      {/* Title */}
      <div>
        <div className="text-xs font-mono font-bold tracking-wider text-ink-3 uppercase">
          Method
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink mt-2 leading-tight">
          How Wajah names a likely cause, and how it checks whether the action worked.
        </h1>
        <p className="font-sans text-base text-ink-2 mt-3 leading-relaxed">
          Plain rules on public sensor readings. Every answer shows the clues behind it, and says when it does not know.
        </p>
      </div>

      {/* 1. How a spike is detected */}
      <section className="space-y-3 border-t-2 border-ink pt-6">
        <h2 className="font-serif text-2xl font-extrabold text-ink">
          1 How a spike is detected
        </h2>
        <p className="font-sans text-sm sm:text-base text-ink-2 leading-relaxed">
          Each area&apos;s reading is compared with its own usual level (median over the previous 7 days) for that hour of the day. When PM2.5 stays well above that level (at least 90 µg/m³ and 1.5× baseline) for two consecutive hours, Wajah opens an incident. The incident ends when the reading comes back close to the usual level.
        </p>
      </section>

      {/* 2. The five causes and their clues */}
      <section className="space-y-4 border-t-2 border-ink pt-6">
        <h2 className="font-serif text-2xl font-extrabold text-ink">
          2 The five causes and their clues
        </h2>
        <p className="font-sans text-sm text-ink-2">
          Wajah scores each cause deterministically from live sensor readings and names the highest as &ldquo;likely&rdquo;.
        </p>

        <div className="space-y-3 font-sans text-sm">
          <div className="p-3 border border-rule bg-sheet">
            <div className="font-serif font-bold text-base text-ink">♨ Local burning</div>
            <div className="text-ink-2 mt-1">
              Carbon monoxide (CO) rises with the particles. The wind is calm. Only one or two areas spike.
            </div>
          </div>

          <div className="p-3 border border-rule bg-sheet">
            <div className="font-serif font-bold text-base text-ink">∴ Dust</div>
            <div className="text-ink-2 mt-1">
              Coarse particles (PM10) dominate. Wind speed is strong enough (≥ 4 m/s) to lift dust. Few areas spike.
            </div>
          </div>

          <div className="p-3 border border-rule bg-sheet">
            <div className="font-serif font-bold text-base text-ink">🚗 Traffic</div>
            <div className="text-ink-2 mt-1">
              Nitrogen dioxide (NO2) rises sharply. The spike coincides with morning or evening rush hours.
            </div>
          </div>

          <div className="p-3 border border-rule bg-sheet">
            <div className="font-serif font-bold text-base text-ink">≈ Smoke from farm fires</div>
            <div className="text-ink-2 mt-1">
              Most areas rise together. Satellites detect active fires upwind (Punjab/Haryana), and winds blow towards Delhi.
            </div>
          </div>

          <div className="p-3 border border-rule bg-sheet">
            <div className="font-serif font-bold text-base text-ink">☁ Trapped air</div>
            <div className="text-ink-2 mt-1">
              Most areas rise together, usually on calm winter nights with very low boundary layer height.
            </div>
          </div>

          <div className="p-3 border border-dashed border-ink bg-paper">
            <div className="font-serif font-bold text-base text-ink">? Cause unclear</div>
            <div className="text-ink-2 mt-1">
              When no cause scores clearly above the rest (score &lt; 50 or difference &lt; 20), Wajah says so and shows the two leading candidates. It does not guess.
            </div>
          </div>
        </div>
      </section>

      {/* 3. How an action is judged */}
      <section className="space-y-4 border-t-2 border-ink pt-6">
        <h2 className="font-serif text-2xl font-extrabold text-ink">
          3 How an action is judged
        </h2>
        <p className="font-sans text-sm sm:text-base text-ink-2 leading-relaxed">
          Three hours after a job is marked done, Wajah compares the sensor reading with the reading when the job ended. Then it subtracts the drop that spikes at that hotspot usually show on their own when nobody acts. What remains is the true net change.
        </p>

        {/* Diagram illustration */}
        <div className="p-4 border-2 border-ink bg-sheet space-y-3 font-mono text-xs">
          <div className="flex justify-between items-center text-ink-3">
            <span>Before: 430</span>
            <span>After: 290 (−33%)</span>
          </div>
          <div className="border-t border-ink relative py-2">
            <div className="text-center font-bold text-ink">
              Net change: −23%
            </div>
            <div className="text-center text-[11px] text-ink-3">
              Hotspot drop (−33%) less usual fade (−10%)
            </div>
          </div>
        </div>

        <div className="space-y-2 text-xs font-mono">
          <div className="p-2.5 bg-ink text-white font-bold flex items-center justify-between">
            <span>✓ Worked</span>
            <span>A net drop of 15% or more.</span>
          </div>
          <div className="p-2.5 bg-ink text-white font-bold flex items-center justify-between">
            <span>✕ No effect</span>
            <span>Less than a 15% drop.</span>
          </div>
          <div className="p-2.5 border border-dashed border-ink bg-paper font-bold flex items-center justify-between">
            <span>? Inconclusive</span>
            <span>Rain, high wind shift, or whole city shifted at once.</span>
          </div>
        </div>
      </section>

      {/* 4. The Placebo Test */}
      <section className="space-y-3 border-t-2 border-ink pt-6">
        <h2 className="font-serif text-2xl font-extrabold text-ink">
          4 The placebo test
        </h2>
        <p className="font-sans text-sm text-ink-2 leading-relaxed">
          To test how often this measurement method fools itself, we logged 24 fake work orders on real past spikes where nothing was actually done.
        </p>
        <div className="p-3 border-2 border-ink bg-sheet font-mono text-sm font-bold text-ink">
          2 of 24 fake actions were wrongly marked as worked.
        </div>
        <p className="font-sans text-xs text-ink-2 leading-relaxed">
          With nothing done at all, the method still claims success about 1 in 12 times due to turbulent weather noise. That is why Wajah always shows counts (such as &ldquo;3 of 4 times&rdquo;) rather than a single percentage in isolation.
        </p>
      </section>

      {/* Honest Limits Box */}
      <div className="border-2 border-ink bg-sheet p-6 space-y-3">
        <h3 className="font-serif text-xl font-bold text-ink">
          What this cannot tell you
        </h3>
        <ul className="space-y-2 font-sans text-xs sm:text-sm text-ink-2">
          <li className="flex items-start gap-2">
            <span className="font-bold text-ink">✕</span>
            <span><strong>Clues are not proof.</strong> A likely cause is the best fit to current readings, not a finding of fact.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-ink">✕</span>
            <span><strong>One result is weak evidence.</strong> Trust a pattern over multiple interventions, not a single reading.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-ink">✕</span>
            <span><strong>Stations can be 1 km away.</strong> Sprinkling may help a street the station cannot see.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-ink">✕</span>
            <span><strong>Work orders in this demo are simulated.</strong> They carry a DEMO tag. No real trucks were dispatched.</span>
          </li>
        </ul>
      </div>

      {/* 5. Data sources */}
      <section className="space-y-3 border-t-2 border-ink pt-6">
        <h2 className="font-serif text-2xl font-extrabold text-ink">
          5 Data sources
        </h2>
        <div className="border border-rule divide-y divide-rule font-sans text-xs bg-sheet">
          <div className="p-3 flex justify-between">
            <span className="font-bold text-ink">Air Quality</span>
            <span className="text-ink-2">CPCB public stations &amp; OpenAQ v3 hourly feed</span>
          </div>
          <div className="p-3 flex justify-between">
            <span className="font-bold text-ink">Weather &amp; Boundary Layer</span>
            <span className="text-ink-2">Open-Meteo hourly weather model</span>
          </div>
          <div className="p-3 flex justify-between">
            <span className="font-bold text-ink">Farm Fire Detections</span>
            <span className="text-ink-2">NASA FIRMS satellite area detections (SNPP NRT)</span>
          </div>
          <div className="p-3 flex justify-between">
            <span className="font-bold text-ink">Map Base</span>
            <span className="text-ink-2">&copy; OpenStreetMap contributors</span>
          </div>
        </div>
      </section>
    </div>
  );
}
