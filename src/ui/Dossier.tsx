import { archive, ageAt, nameOf } from '../data/archive';
import { ledgerFor } from '../engine/ledger';
import { formatStance } from '../engine/weights';
import type { Claim } from '../model/types';
import { useSession, useStore } from '../state/store';
import { Close, Confidence, Medallion, ProvenanceBadge, SourceLine } from './bits';

const TABS = [
  ['profile', 'Profile'],
  ['positions', 'Positions'],
  ['relations', 'Relations'],
  ['quotations', 'Quotations'],
  ['sources', 'Sources'],
  ['horizon', 'Does not know'],
  ['ledger', 'Ledger'],
] as const;

function ClaimCard({ c }: { c: Claim }) {
  const setUi = useStore((s) => s.setUi);
  return (
    <div className="card">
      <h4>{c.label}</h4>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <ProvenanceBadge p={c.provenance} />
        <Confidence c={c.confidence} />
        <span className="conf">as of {c.asOf}</span>
      </div>
      <p style={{ margin: '0 0 6px' }}>{c.summary}</p>
      <p className="dim" style={{ margin: '0 0 6px', fontSize: 14 }}>
        <b className="mono" style={{ fontSize: 9.5 }}>Reasoning · </b>
        {c.reasoning}
      </p>
      {Object.keys(c.stances).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
          {Object.entries(c.stances).map(([pid, v]) => (
            <span key={pid} className="chip" style={{ color: v > 0.25 ? 'var(--affirm)' : v < -0.25 ? 'var(--deny)' : 'var(--chalk-2)' }}>
              {archive.byId.proposition.get(pid)?.short} {formatStance(v)}
            </span>
          ))}
        </div>
      )}
      <div className="muted" style={{ fontSize: 12.5 }}>
        Sources:{' '}
        {c.sourceIds.map((s, i) => (
          <button key={s} className="chip" style={{ marginRight: 4, marginTop: 4 }} onClick={() => setUi({ view: 'archive', archiveFocus: s, dossier: undefined })}>
            {archive.byId.source.get(s)?.author.split(',')[0]} {archive.byId.source.get(s)?.date.slice(0, 4)}
            {i < 0 ? '' : ''}
          </button>
        ))}
      </div>
      {c.later && (
        <p className="caution" style={{ marginTop: 8 }}>
          <b className="mono" style={{ fontSize: 9.5 }}>Later · shown to you, not to them · </b>
          {c.later}
        </p>
      )}
    </div>
  );
}

export function Dossier() {
  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);
  const session = useSession();
  const p = ui.dossier ? archive.byId.participant.get(ui.dossier) : undefined;
  if (!p) return null;
  const tab = ui.dossierTab ?? 'profile';
  const claims = archive.claimsByParticipant.get(p.id) ?? [];
  const quotes = archive.quotations.filter((q) => q.participant === p.id);
  const ledger = ledgerFor(archive, session, p.id);
  const close = () => setUi({ dossier: undefined });

  return (
    <>
      <div className="scrim" onClick={close} />
      <aside className="drawer" role="dialog" aria-label={`Dossier: ${p.name}`}>
        <div className="drawer-head">
          <Medallion id={p.id} size={64} />
          <div>
            <div className="mono muted">Intellectual dossier{p.kind === 'guest' ? ' · hypothetical guest' : ''}</div>
            <h2>{p.name}</h2>
            <div className="dim" style={{ fontSize: 14 }}>
              {p.kind === 'attendee' ? `Aged ${ageAt(p.born)} in October 1927 · ` : `${p.guest?.era} · `}
              {p.affiliation}
            </div>
          </div>
          <Close onClick={close} />
        </div>
        <div className="tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setUi({ dossierTab: id })}>
              {label}
            </button>
          ))}
        </div>
        <div className="drawer-body">
          {tab === 'profile' && (
            <>
              <dl className="kv">
                <dt>Born</dt>
                <dd>{p.born}</dd>
                <dt>Nationality</dt>
                <dd>{p.nationality}</dd>
                <dt>At this council</dt>
                <dd>{p.role}</dd>
              </dl>
              {p.guest && <p className="caution">{p.guest.whyInvited} {p.guest.caution}</p>}
              <div className="block">
                <p>{p.bio}</p>
              </div>
              <div className="block">
                <h3>Contributions by 1927</h3>
                {p.contributions.map((c) => (
                  <div key={c.title} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 10, marginBottom: 6 }}>
                    <span className="mono muted">{c.year}</span>
                    <span>
                      <b>{c.title}.</b> <span className="dim">{c.note}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="block">
                <h3>Current scientific beliefs</h3>
                <p>{p.beliefs}</p>
                <h3>Philosophical position</h3>
                <p>{p.philosophy}</p>
                <h3>Intellectual style</h3>
                <p>
                  <b>Method.</b> {p.style.method}
                </p>
                <p>
                  <b>Manner.</b> {p.style.manner}
                </p>
                <p className="caution">
                  <b className="mono" style={{ fontSize: 9.5 }}>The simulation must not reduce {p.shortName} to · </b>
                  {p.style.avoid.join(' · ')}
                </p>
              </div>
              {p.silences?.map((s) => (
                <p key={s.proposition} className="caution">
                  <b className="mono" style={{ fontSize: 9.5 }}>Where the evidence runs out · </b>
                  {s.note}
                </p>
              ))}
            </>
          )}
          {tab === 'positions' && (
            <>
              <p className="dim">
                {claims.length} archived claims. Every word {p.shortName} speaks in the room is drawn from one of these.
              </p>
              {claims.map((c) => (
                <ClaimCard key={c.id} c={c} />
              ))}
            </>
          )}
          {tab === 'relations' && (
            <>
              <div className="block">
                <h3>Relationships</h3>
                {p.relationships.map((r) => (
                  <div key={r.with} className="card clickable" onClick={() => archive.byId.participant.has(r.with) && setUi({ dossier: r.with, dossierTab: 'profile' })}>
                    <h4>
                      {nameOf(r.with)} <span className="mono muted">· {r.nature}</span>
                    </h4>
                    <div className="dim">{r.note}</div>
                  </div>
                ))}
              </div>
              <div className="block">
                <h3>Known disagreements</h3>
                {p.disagreements.length === 0 && <p className="muted">None documented in the archive.</p>}
                {p.disagreements.map((d, i) => (
                  <div key={i} className="card">
                    <h4>
                      {nameOf(d.with)} <span className="mono muted">· {d.topic}</span>
                    </h4>
                    <div className="dim">{d.note}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === 'quotations' && (
            <>
              <p className="dim">Only words with a traceable source appear here, each labelled for how securely we know the wording.</p>
              {quotes.length === 0 && <p className="muted">No quotations are archived for {p.shortName}. The simulation therefore paraphrases only.</p>}
              {quotes.map((q) => (
                <div key={q.id} className="quote-inset" style={{ margin: '0 0 12px' }}>
                  <div className="q">“{q.text}”</div>
                  <div className="cite">
                    {q.wording.replace(/-/g, ' ')} · {q.confidence} confidence · {q.date}
                    {q.laterTestimony ? ' · later testimony — not known in 1927' : ''}
                    {q.reportedBy ? ` · reported by ${q.reportedBy}` : ''}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 6, color: 'var(--paper-ink-2)' }}>{q.context}</div>
                </div>
              ))}
            </>
          )}
          {tab === 'sources' && p.sourceIds.map((s) => <div key={s} className="card"><SourceLine id={s} /><div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{archive.byId.source.get(s)?.context}</div></div>)}
          {tab === 'horizon' && (
            <>
              <p className="dim">
                What {p.shortName} does not yet know. The simulation withholds all of this unless you introduce it.
              </p>
              {p.horizonNotes?.map((h) => (
                <div key={h.eventId} className="card">
                  <h4>{archive.byId.event.get(h.eventId)?.title} <span className="mono muted">· {archive.byId.event.get(h.eventId)?.date}</span></h4>
                  <div className="dim">{h.note}</div>
                </div>
              ))}
              <div className="block">
                <h3>Sealed: {ledger.unknown.length} later events</h3>
                {ledger.unknown.map((e) => (
                  <div key={e.id} className="ledger-item">
                    <span className="d">{e.date}</span> {e.title}
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === 'ledger' && (
            <>
              {(['introduced', 'accepted', 'disputed', 'rejected', 'unresolved'] as const).map((col) => (
                <div key={col} className="block">
                  <h3>{col.toUpperCase()} ({ledger[col].length})</h3>
                  {ledger[col].length === 0 && <p className="muted" style={{ fontSize: 13 }}>—</p>}
                  {ledger[col].map((i) => (
                    <div key={i.id} className="ledger-item">
                      <span className="d">{i.date}</span> {i.label}
                      <div className="muted" style={{ fontSize: 12 }}>{i.note}</div>
                    </div>
                  ))}
                </div>
              ))}
              <div className="block">
                <h3>KNOWN IN 1927 ({ledger.known.length})</h3>
                {ledger.known.map((i) => (
                  <div key={i.id} className={`ledger-item ${i.direct ? 'direct' : ''}`}>
                    <span className="d">{i.date}</span> {i.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
