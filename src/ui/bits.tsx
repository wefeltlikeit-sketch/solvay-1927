import type { Confidence, Provenance } from '../model/types';
import { archive } from '../data/archive';
import { hashString } from '../engine/rng';
import { PROVENANCE_LABEL, PROVENANCE_SHORT } from '../engine/weights';

/** Engraved medallion standing in for a portrait: initials inside a guilloché ring seeded by name. */
export function Medallion({ id, size = 40, onClick, title }: { id: string; size?: number; onClick?: () => void; title?: string }) {
  const p = archive.byId.participant.get(id);
  const guest = p?.kind === 'guest';
  const h = hashString(id);
  const petals = 5 + (h % 5);
  const tilt = h % 180;
  const r = size / 2;
  const initials = id === 'chair' ? '§' : id === 'user' ? '•' : p?.initials ?? id.slice(0, 2).toUpperCase();
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} onClick={onClick} className="avatar" role={onClick ? 'button' : 'img'} aria-label={title ?? p?.name ?? id}>
      <title>{title ?? p?.name ?? id}</title>
      <circle cx={r} cy={r} r={r - 1} fill="#15171b" stroke={guest ? 'var(--p-speculative)' : 'var(--brass)'} strokeWidth={1.2} strokeDasharray={guest ? '3 2' : undefined} />
      <g opacity={0.35} stroke={guest ? 'var(--p-speculative)' : 'var(--brass)'} strokeWidth={0.6} fill="none">
        {Array.from({ length: petals }, (_, i) => (
          <ellipse key={i} cx={r} cy={r} rx={r - 4} ry={(r - 4) * 0.34} transform={`rotate(${tilt + (i * 180) / petals} ${r} ${r})`} />
        ))}
      </g>
      <circle cx={r} cy={r} r={r * 0.46} fill="#15171b" />
      <text x={r} y={r + size * 0.11} textAnchor="middle" fontFamily="var(--f-display)" fontWeight={700} fontSize={size * 0.31} fill="var(--chalk)">
        {initials}
      </text>
    </svg>
  );
}

export function ProvenanceBadge({ p, withLabel = true }: { p: Provenance; withLabel?: boolean }) {
  return (
    <span className={`pbadge ${p}`} title={PROVENANCE_LABEL[p]}>
      <i />
      {withLabel && PROVENANCE_SHORT[p]}
    </span>
  );
}

export function Confidence({ c }: { c: Confidence }) {
  const n = c === 'high' ? 3 : c === 'medium' ? 2 : 1;
  return (
    <span className="conf" title={`${c} confidence`}>
      {'●'.repeat(n)}
      <span style={{ opacity: 0.3 }}>{'●'.repeat(3 - n)}</span> {c}
    </span>
  );
}

export function Legend() {
  return (
    <div className="legend" aria-label="Provenance legend">
      {(['quotation', 'documented', 'inference', 'speculative'] as Provenance[]).map((p) => (
        <span key={p} className={`pbadge ${p}`}>
          <i />
          {PROVENANCE_LABEL[p]}
        </span>
      ))}
    </div>
  );
}

export function SourceLine({ id }: { id: string }) {
  const s = archive.byId.source.get(id);
  if (!s) return <span className="muted">Unknown source {id}</span>;
  return (
    <div className="cite-line">
      <span className={`rel ${s.reliability}`}>{s.reliability}</span> {s.citation}
    </div>
  );
}

export function Close({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-btn close" onClick={onClick} aria-label="Close">
      <svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4l10 10M14 4L4 14" />
      </svg>
    </button>
  );
}

export function Seal({ letter = 'S' }: { letter?: string }) {
  return <span className="seal">{letter}</span>;
}
