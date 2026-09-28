import { useState } from 'react';
import { archive, HORIZON, isPostHorizon, nameOf } from '../data/archive';
import type { EventCategory, HistoricalEvent } from '../model/types';
import { useSession, useStore } from '../state/store';
import { Medallion, Seal, SourceLine } from './bits';

// Validated categorical order (adjacent lanes stay distinguishable under CVD).
const LANES: { id: EventCategory; label: string; color: string }[] = [
  { id: 'theory', label: 'Theory', color: 'var(--c-theory)' },
  { id: 'experiment', label: 'Experiment', color: 'var(--c-experiment)' },
  { id: 'technology', label: 'Technology', color: 'var(--c-technology)' },
  { id: 'conference', label: 'Conferences', color: 'var(--c-conference)' },
  { id: 'person', label: 'Lives', color: 'var(--c-person)' },
  { id: 'interpretation', label: 'Interpretation', color: 'var(--c-interpretation)' },
];

const W = 1700;
const LEFT = 130;
const LANE_H = 58;
const TOP = 50;

function decimalYear(date: string): number {
  const [y, m = '6'] = date.split('-');
  return Number(y) + (Number(m) - 0.5) / 12;
}
/** Piecewise scale: the crowded years before 1935 get most of the width. */
function x(year: number): number {
  const span = W - LEFT - 40;
  if (year <= 1935) return LEFT + ((year - 1899) / (1935 - 1899)) * span * 0.64;
  return LEFT + span * 0.64 + ((year - 1935) / (2025 - 1935)) * span * 0.36;
}

export function Timeline() {
  const session = useSession();
  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);
  const openEnvelope = useStore((s) => s.openEnvelope);
  const [hover, setHover] = useState<{ e: HistoricalEvent; x: number; y: number } | null>(null);
  const selected = ui.timelineEvent ? archive.byId.event.get(ui.timelineEvent) : archive.byId.event.get('solvay-1927');
  const H = TOP + LANES.length * LANE_H + 30;
  const hx = x(decimalYear(HORIZON));

  // stagger events that fall close together in the same lane
  const placed = new Map<string, { cx: number; cy: number }>();
  for (const lane of LANES) {
    let lastX = -99;
    let flip = 0;
    archive.events
      .filter((e) => e.category === lane.id)
      .forEach((e) => {
        const cx = x(decimalYear(e.date));
        flip = cx - lastX < 14 ? (flip + 1) % 3 : 0;
        lastX = cx;
        const li = LANES.indexOf(lane);
        placed.set(e.id, { cx, cy: TOP + li * LANE_H + LANE_H / 2 + (flip === 1 ? -12 : flip === 2 ? 12 : 0) });
      });
  }

  const ticks = [1900, 1905, 1910, 1915, 1920, 1925, 1930, 1935, 1950, 1965, 1980, 1995, 2010, 2025];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="mono muted">Time machine · 1900 – present</div>
          <h1>The landscape, before and after</h1>
          <p>
            Everything left of the brass line is known in the room. Everything to its right is sealed from the participants — you can read it, and you can carry it into the room as an envelope from the future.
          </p>
        </div>
      </div>
      <div className="panel tl-scroll" style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
        <svg className="tl-svg" width={W} height={H} role="img" aria-label="Timeline of quantum physics, 1900 to the present">
          <rect x={hx} y={TOP - 14} width={W - hx} height={LANES.length * LANE_H + 14} fill="rgba(0,0,0,0.35)" />
          <text x={hx + 10} y={TOP - 20} fontFamily="var(--f-mono)" fontSize={10} letterSpacing="0.12em" fill="var(--chalk-3)">
            SEALED FROM THE ROOM →
          </text>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={TOP - 8} y2={H - 26} stroke="var(--line)" />
              <text x={x(t)} y={H - 10} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={10} fill="var(--chalk-3)">
                {t}
              </text>
            </g>
          ))}
          {LANES.map((l, i) => (
            <g key={l.id}>
              <line x1={LEFT - 8} x2={W - 20} y1={TOP + i * LANE_H + LANE_H / 2} y2={TOP + i * LANE_H + LANE_H / 2} stroke="var(--line)" strokeDasharray="1 5" />
              <circle cx={16} cy={TOP + i * LANE_H + LANE_H / 2} r={4} fill={l.color} />
              <text x={26} y={TOP + i * LANE_H + LANE_H / 2 + 4} fontFamily="var(--f-mono)" fontSize={10.5} letterSpacing="0.08em" fill="var(--chalk-2)">
                {l.label.toUpperCase()}
              </text>
            </g>
          ))}
          <line x1={hx} x2={hx} y1={TOP - 30} y2={H - 26} stroke="var(--brass)" strokeWidth={2} />
          <text x={hx - 8} y={TOP - 20} textAnchor="end" fontFamily="var(--f-mono)" fontSize={10} letterSpacing="0.12em" fill="var(--brass-2)">
            YOU ARE HERE · OCTOBER 1927
          </text>
          {archive.events.map((e) => {
            const p = placed.get(e.id)!;
            const lane = LANES.find((l) => l.id === e.category)!;
            const post = isPostHorizon(e.date);
            const opened = e.envelopeId && session.openedEnvelopes.includes(e.envelopeId);
            const on = selected?.id === e.id;
            return (
              <g
                key={e.id}
                className="tl-dot"
                onClick={() => setUi({ timelineEvent: e.id })}
                onMouseEnter={() => setHover({ e, x: p.cx, y: p.cy })}
                tabIndex={0}
                role="button"
                aria-label={`${e.date}: ${e.title}`}
                onKeyDown={(ev) => ev.key === 'Enter' && setUi({ timelineEvent: e.id })}
              >
                <circle className="hit" cx={p.cx} cy={p.cy} r={12} fill="transparent" />
                {on && <circle cx={p.cx} cy={p.cy} r={11} fill="none" stroke="var(--brass-2)" strokeWidth={1.5} />}
                <circle
                  cx={p.cx}
                  cy={p.cy}
                  r={post ? 6 : 6.5}
                  fill={post && !opened ? 'var(--ink-1)' : lane.color}
                  stroke={lane.color}
                  strokeWidth={2}
                />
                {post && e.envelopeId && !opened && <rect x={p.cx - 2.5} y={p.cy - 2.5} width={5} height={5} fill="var(--wax)" transform={`rotate(45 ${p.cx} ${p.cy})`} />}
              </g>
            );
          })}
        </svg>
        {hover && (
          <div
            style={{
              position: 'absolute', left: Math.min(hover.x + 14, W - 280), top: hover.y + 14, pointerEvents: 'none',
              background: 'var(--ink-3)', border: '1px solid var(--line-2)', borderRadius: 3, padding: '7px 10px', fontSize: 13, maxWidth: 260, zIndex: 3,
            }}
          >
            <div className="mono muted">{hover.e.date} · {hover.e.category}</div>
            <div>{hover.e.title}</div>
          </div>
        )}
      </div>

      {selected && (
        <div className="panel panel-pad" style={{ marginTop: 16 }}>
          <div className="mono muted">
            {selected.date} · {selected.category} · {isPostHorizon(selected.date) ? 'after the horizon' : 'known in the room'}
          </div>
          <h2 className="display" style={{ fontSize: 30, margin: '4px 0 8px' }}>{selected.title}</h2>
          <div className="split" style={{ gridTemplateColumns: '1fr 340px' }}>
            <div>
              <p>{selected.summary}</p>
              <div className="block">
                <h3>How it changes the landscape</h3>
                <p>{selected.landscape}</p>
                {selected.knownNote && <p className="caution">{selected.knownNote}</p>}
              </div>
              <div className="block">
                <h3>Sources</h3>
                {selected.sourceIds.map((s) => <SourceLine key={s} id={s} />)}
              </div>
            </div>
            <div>
              {isPostHorizon(selected.date) ? (
                selected.envelopeId ? (
                  session.openedEnvelopes.includes(selected.envelopeId) ? (
                    <p className="dim">This has been introduced to the room. See each participant's ledger for how they received it.</p>
                  ) : (
                    <>
                      <p className="dim">No one in the room knows this. You may introduce it.</p>
                      <button className="btn primary" onClick={() => openEnvelope(selected.envelopeId!)}>
                        <Seal letter={archive.byId.envelope.get(selected.envelopeId)!.year.slice(2, 4)} /> Carry this envelope into the room
                      </button>
                    </>
                  )
                ) : (
                  <p className="dim">Sealed from the room. No envelope is archived for this event yet.</p>
                )
              ) : (
                <p className="dim">Part of what the room knows in October 1927.</p>
              )}
              {selected.affects.length > 0 && (
                <div className="block">
                  <h3>Participants most affected</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selected.affects.map((id) => (
                      <button key={id} className="chip" onClick={() => setUi({ dossier: id, dossierTab: 'horizon' })}>
                        <Medallion id={id} size={20} /> {nameOf(id)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="panel panel-pad" style={{ marginTop: 16 }}>
        <div className="mono muted" style={{ marginBottom: 8 }}>Chronicle · table view</div>
        <table className="matrix">
          <thead>
            <tr><th>Date</th><th>Event</th><th>Kind</th><th>Room</th></tr>
          </thead>
          <tbody>
            {archive.events.map((e) => (
              <tr key={e.id} onClick={() => setUi({ timelineEvent: e.id })} style={{ cursor: 'pointer' }}>
                <td className="mono">{e.date}</td>
                <td>{e.title}</td>
                <td className="muted">{e.category}</td>
                <td className="muted">{isPostHorizon(e.date) ? (e.envelopeId && session.openedEnvelopes.includes(e.envelopeId) ? 'introduced' : 'sealed') : 'known'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
