import { useMemo } from 'react';
import { archive, nameOf } from '../data/archive';
import { buildArgumentMap, type ColumnId, type MapEdge } from '../engine/argumentMap';
import { formatStance } from '../engine/weights';
import { useSession, useStore } from '../state/store';
import { Confidence, Medallion, ProvenanceBadge, SourceLine } from './bits';

const COL_X: Record<ColumnId, number> = { deny: 170, qualify: 500, affirm: 830 };
const COL_COLOR: Record<ColumnId, string> = { deny: 'var(--deny)', qualify: 'var(--qualify)', affirm: 'var(--affirm)' };
const NODE_W = 290;
const NODE_H = 74;
const GAP = 22;
const TOP = 170;

const EDGE_STYLE: Record<MapEdge['kind'], { stroke: string; dash?: string; label: string }> = {
  attacks: { stroke: 'var(--deny)', label: 'attacks' },
  supports: { stroke: 'var(--affirm)', label: 'supports' },
  qualifies: { stroke: 'var(--qualify)', dash: '6 4', label: 'qualifies' },
  questions: { stroke: 'var(--chalk-2)', dash: '2 4', label: 'questions' },
};

export function ArgumentMapView() {
  const session = useSession();
  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);
  const hidden = useStore((s) => s.hidden);
  const threads = session.threads.filter((t) => t.kind !== 'question' || t.utteranceIds.some((id) => session.utterances[id]?.kind === 'speech'));
  const thread = threads.find((t) => t.id === ui.mapThreadId) ?? threads[threads.length - 1];

  const map = useMemo(() => {
    if (!thread) return undefined;
    const visible = { ...thread, utteranceIds: thread.utteranceIds.filter((id) => !hidden[id]) };
    return buildArgumentMap(archive, session, visible);
  }, [thread, session, hidden]);

  if (!thread || !map) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>Argument Map</h1>
        </div>
        <p className="dim">No discussion yet. Put a question to the room and the map will draw itself as the seminar unfolds.</p>
      </div>
    );
  }

  const pos = new Map<string, { x: number; y: number }>();
  const counts: Record<ColumnId, number> = { deny: 0, qualify: 0, affirm: 0 };
  for (const n of map.nodes.slice().sort((a, b) => a.order - b.order)) {
    pos.set(n.id, { x: COL_X[n.column], y: TOP + counts[n.column] * (NODE_H + GAP) });
    counts[n.column]++;
  }
  const height = TOP + Math.max(1, ...Object.values(counts)) * (NODE_H + GAP) + 40;
  const selected = map.nodes.find((n) => n.id === ui.mapNode);
  const attackers = selected ? map.edges.filter((e) => e.to === selected.id).map((e) => ({ e, n: map.nodes.find((x) => x.id === e.from)! })) : [];
  const prop = thread.propositionId ? archive.byId.proposition.get(thread.propositionId) : undefined;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="mono muted">Argument map · derived live from the minutes</div>
          <h1>{map.root}</h1>
          <p>Every node is an archived claim that has actually been voiced in this discussion. Lines show who answered whom. Select a node to see its reasoning, evidence, objections and sources.</p>
        </div>
      </div>
      <div className="filters">
        <select value={thread.id} onChange={(e) => setUi({ mapThreadId: e.target.value, mapNode: undefined })} aria-label="Discussion">
          {threads.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        {Object.entries(EDGE_STYLE).map(([k, s]) => (
          <span key={k} className="pbadge" style={{ color: 'var(--chalk-2)' }}>
            <svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke={s.stroke} strokeWidth="2" strokeDasharray={s.dash} /></svg>
            {s.label}
          </span>
        ))}
      </div>
      <div className="split">
        <div className="panel" style={{ overflowX: 'auto' }}>
          <svg className="map-svg" viewBox={`0 0 1000 ${height}`} style={{ minWidth: 760 }} role="img" aria-label={`Argument map: ${map.root}`}>
            <defs>
              {Object.entries(EDGE_STYLE).map(([k, s]) => (
                <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={s.stroke} />
                </marker>
              ))}
            </defs>
            <rect x={300} y={20} width={400} height={56} rx={3} fill="var(--ink-2)" stroke="var(--brass)" />
            <text x={500} y={54} textAnchor="middle" fontFamily="var(--f-display)" fontSize={21} fill="var(--chalk)">
              {map.root.length > 44 ? map.root.slice(0, 42) + '…' : map.root}
            </text>
            {map.columns.map((c) => (
              <g key={c.id}>
                <path d={`M 500 76 C 500 100, ${COL_X[c.id]} 100, ${COL_X[c.id]} 118`} stroke="var(--line-2)" fill="none" />
                <text x={COL_X[c.id]} y={138} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={10.5} letterSpacing="0.08em" fill={COL_COLOR[c.id]}>
                  {c.label.toUpperCase().slice(0, 44)}
                </text>
                <line x1={COL_X[c.id] - 40} x2={COL_X[c.id] + 40} y1={148} y2={148} stroke={COL_COLOR[c.id]} strokeWidth={2} />
              </g>
            ))}
            {map.edges.map((e) => {
              const a = pos.get(e.from)!;
              const b = pos.get(e.to)!;
              const s = EDGE_STYLE[e.kind];
              let d: string;
              if (a.x === b.x) {
                const x = a.x - NODE_W / 2;
                d = `M ${x} ${a.y + NODE_H / 2} C ${x - 40} ${a.y + NODE_H / 2}, ${x - 40} ${b.y + NODE_H / 2}, ${x} ${b.y + NODE_H / 2}`;
              } else {
                const dir = a.x < b.x ? 1 : -1;
                const x1 = a.x + (dir * NODE_W) / 2;
                const x2 = b.x - (dir * NODE_W) / 2;
                d = `M ${x1} ${a.y + NODE_H / 2} C ${(x1 + x2) / 2} ${a.y + NODE_H / 2}, ${(x1 + x2) / 2} ${b.y + NODE_H / 2}, ${x2} ${b.y + NODE_H / 2}`;
              }
              return (
                <path key={`${e.from}-${e.to}`} d={d} stroke={s.stroke} strokeWidth={1.6} strokeDasharray={s.dash} fill="none" markerEnd={`url(#arrow-${e.kind})`} opacity={selected && selected.id !== e.from && selected.id !== e.to ? 0.25 : 0.9}>
                  <title>{`${nameOf(map.nodes.find((n) => n.id === e.from)!.participant)} ${s.label} ${nameOf(map.nodes.find((n) => n.id === e.to)!.participant)}`}</title>
                </path>
              );
            })}
            {map.nodes.map((n) => {
              const p = pos.get(n.id)!;
              const on = selected?.id === n.id;
              return (
                <g key={n.id} className={`map-node fresh ${on ? 'on' : ''}`} onClick={() => setUi({ mapNode: n.id })} tabIndex={0} role="button" aria-label={`${nameOf(n.participant)}: ${n.claim.label}`}>
                  <title>{n.claim.summary}</title>
                  <rect x={p.x - NODE_W / 2} y={p.y} width={NODE_W} height={NODE_H} rx={3} fill="var(--ink-2)" stroke="var(--line-2)" />
                  <rect x={p.x - NODE_W / 2} y={p.y} width={3} height={NODE_H} fill={COL_COLOR[n.column]} />
                  <g transform={`translate(${p.x - NODE_W / 2 + 12} ${p.y + 17})`}>
                    <Medallion id={n.participant} size={40} />
                  </g>
                  <text x={p.x - NODE_W / 2 + 62} y={p.y + 26} fontFamily="var(--f-mono)" fontSize={10} letterSpacing="0.08em" fill="var(--chalk-3)">
                    {nameOf(n.participant).toUpperCase()} {n.stance !== undefined ? ` · ${formatStance(n.stance)}` : n.status ? ` · ${n.status.toUpperCase()}` : ''}
                  </text>
                  <text x={p.x - NODE_W / 2 + 62} y={p.y + 48} fontFamily="var(--f-display)" fontSize={17} fill="var(--chalk)">
                    {n.claim.label.length > 26 ? n.claim.label.slice(0, 25) + '…' : n.claim.label}
                  </text>
                  <line
                    x1={p.x - NODE_W / 2 + 62}
                    x2={p.x - NODE_W / 2 + 102}
                    y1={p.y + 60}
                    y2={p.y + 60}
                    stroke={n.claim.provenance === 'quotation' ? 'var(--p-quotation)' : n.claim.provenance === 'documented' ? 'var(--p-documented)' : n.claim.provenance === 'inference' ? 'var(--p-inference)' : 'var(--p-speculative)'}
                    strokeWidth={2}
                    strokeDasharray={n.claim.provenance === 'inference' ? '4 3' : n.claim.provenance === 'speculative' ? '1.5 3' : undefined}
                  />
                </g>
              );
            })}
          </svg>
        </div>
        <div className="panel panel-pad sticky">
          {!selected && (
            <>
              <div className="mono muted">Reading the map</div>
              <p className="dim">
                Columns place each claim by its archived stance on the question{prop ? ` (${prop.affirmLabel.toLowerCase()} on the right, ${prop.denyLabel.toLowerCase()} on the left)` : ''}. The small rule under each label shows its provenance.
              </p>
              {prop && (
                <>
                  <div className="block">
                    <h3>Context in 1927</h3>
                    <p className="dim">{prop.context}</p>
                    <h3>What happened later (visible to you only)</h3>
                    <p className="dim">{prop.later}</p>
                  </div>
                </>
              )}
              <table className="matrix" aria-label="Map as a table">
                <thead>
                  <tr><th>Speaker</th><th>Claim</th><th>Position</th></tr>
                </thead>
                <tbody>
                  {map.nodes.map((n) => (
                    <tr key={n.id} onClick={() => setUi({ mapNode: n.id })} style={{ cursor: 'pointer' }}>
                      <td>{nameOf(n.participant)}</td>
                      <td>{n.claim.label}</td>
                      <td style={{ color: COL_COLOR[n.column] }}>{map.columns.find((c) => c.id === n.column)?.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {selected && (
            <>
              <button className="btn small ghost" onClick={() => setUi({ mapNode: undefined })}>← All claims</button>
              <h2 className="display" style={{ fontSize: 26, margin: '10px 0 4px' }}>{selected.claim.label}</h2>
              <div className="dim">{archive.byId.participant.get(selected.participant)?.name}</div>
              <div style={{ display: 'flex', gap: 10, margin: '8px 0' }}>
                <ProvenanceBadge p={selected.claim.provenance} />
                <Confidence c={selected.claim.confidence} />
              </div>
              <p>{selected.claim.summary}</p>
              <div className="block">
                <h3>Reasoning</h3>
                <p className="dim">{selected.claim.reasoning}</p>
                {selected.claim.evidence && (
                  <>
                    <h3>Evidence available at the time</h3>
                    <ul className="dim" style={{ paddingLeft: 18, margin: 0 }}>{selected.claim.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
                  </>
                )}
                <h3>Objections</h3>
                {attackers.length === 0 && !selected.claim.objections && <p className="muted">None raised yet in this discussion.</p>}
                {attackers.map(({ e, n }) => (
                  <p key={n.id} className="dim">
                    <b>{nameOf(n.participant)}</b> {EDGE_STYLE[e.kind].label}: {n.claim.label}.
                  </p>
                ))}
                {selected.claim.objections?.map((o) => <p key={o} className="dim">{o}</p>)}
                <h3>Sources</h3>
                {selected.claim.sourceIds.map((s) => <SourceLine key={s} id={s} />)}
                {selected.claim.later && (
                  <>
                    <h3>Later developments</h3>
                    <p className="caution">{selected.claim.later}</p>
                  </>
                )}
              </div>
              <button className="btn small" onClick={() => setUi({ evidence: selected.utteranceIds[0] })}>Open full evidence</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
