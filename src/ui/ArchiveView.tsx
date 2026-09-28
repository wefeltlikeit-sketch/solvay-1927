import { useEffect, useMemo, useState } from 'react';
import { archive, nameOf } from '../data/archive';
import { normalise } from '../engine/match';
import { useStore } from '../state/store';
import { Confidence, ProvenanceBadge } from './bits';

type Tab = 'sources' | 'quotations' | 'claims';

export function ArchiveView() {
  const focus = useStore((s) => s.ui.archiveFocus);
  const setUi = useStore((s) => s.setUi);
  const [tab, setTab] = useState<Tab>('sources');
  const [q, setQ] = useState('');
  const [who, setWho] = useState('');
  const [rel, setRel] = useState('');

  useEffect(() => {
    if (focus) {
      setTab('sources');
      setTimeout(() => document.getElementById(`src-${focus}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
    }
  }, [focus]);

  const nq = normalise(q);
  const sources = useMemo(
    () =>
      archive.sources.filter(
        (s) =>
          (!who || s.participants.includes(who)) &&
          (!rel || s.reliability === rel) &&
          (!nq || normalise(`${s.title} ${s.author} ${s.citation} ${s.context ?? ''}`).includes(nq)),
      ),
    [who, rel, nq],
  );
  const quotes = archive.quotations.filter((x) => (!who || x.participant === who) && (!nq || normalise(x.text + x.context).includes(nq)));
  const claims = [...archive.claims, ...archive.reactionClaims].filter(
    (c) => (!who || c.participant === who) && (!nq || normalise(`${c.label} ${c.summary}`).includes(nq)),
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="mono muted">The archive</div>
          <h1>Sources, words and claims</h1>
          <p>
            {archive.sources.length} sources · {archive.quotations.length} quotations · {archive.claims.length + archive.reactionClaims.length} claims. Everything the simulation says is built on these, stored as plain JSON in <code>data/</code>.
          </p>
        </div>
      </div>
      <div className="tabs" style={{ padding: 0, marginBottom: 12 }}>
        {(['sources', 'quotations', 'claims'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="filters">
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the archive" />
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Participant">
          <option value="">Everyone</option>
          {archive.participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.shortName}
            </option>
          ))}
        </select>
        {tab === 'sources' && (
          <select value={rel} onChange={(e) => setRel(e.target.value)} aria-label="Reliability">
            <option value="">Any reliability</option>
            <option value="primary">Primary</option>
            <option value="recollection">Recollection</option>
            <option value="secondary">Secondary</option>
          </select>
        )}
      </div>

      {tab === 'sources' &&
        sources.map((s) => {
          const citing = archive.claimsBySource.get(s.id) ?? [];
          return (
            <div key={s.id} id={`src-${s.id}`} className="card" style={focus === s.id ? { borderColor: 'var(--brass)' } : undefined}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span className={`rel ${s.reliability}`}>{s.reliability}</span>
                <span className="mono muted">{s.type} · {s.date}</span>
              </div>
              <h4 style={{ marginTop: 4 }}>{s.title}</h4>
              <div className="dim" style={{ fontSize: 14 }}>{s.citation}</div>
              {s.context && <p className="muted" style={{ fontSize: 13.5, margin: '6px 0 0' }}>{s.context}</p>}
              {citing.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 12.5 }} className="muted">
                  Grounds {citing.length} claim{citing.length > 1 ? 's' : ''}:{' '}
                  {citing.slice(0, 8).map((c) => `${nameOf(c.participant)} — ${c.label}`).join(' · ')}
                  {citing.length > 8 ? ' …' : ''}
                </div>
              )}
            </div>
          );
        })}

      {tab === 'quotations' &&
        quotes.map((x) => (
          <div key={x.id} className="quote-inset" style={{ margin: '0 0 12px' }}>
            <div className="q">“{x.text}”</div>
            <div className="cite">
              {archive.byId.participant.get(x.participant)?.name} · {x.date} · {x.wording.replace(/-/g, ' ')} · {x.confidence} confidence
              {x.laterTestimony ? ' · later testimony' : ''}
            </div>
            <div style={{ fontSize: 13, marginTop: 6, color: 'var(--paper-ink-2)' }}>
              {x.context} <i>— {archive.byId.source.get(x.sourceId)?.citation}</i>
            </div>
          </div>
        ))}

      {tab === 'claims' &&
        claims.map((c) => (
          <div key={c.id} className="card">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <b className="display" style={{ fontSize: 18 }}>{nameOf(c.participant)}</b>
              <span>{c.label}</span>
              <ProvenanceBadge p={c.provenance} />
              <Confidence c={c.confidence} />
              {c.id.includes('/') && <span className="mono muted">reaction · {archive.byId.envelope.get(c.id.split('/')[0])?.title}</span>}
            </div>
            <p className="dim" style={{ margin: '6px 0 0', fontSize: 14 }}>{c.summary}</p>
            <div style={{ marginTop: 6 }}>
              {c.sourceIds.map((s) => (
                <button key={s} className="chip" style={{ marginRight: 4 }} onClick={() => { setTab('sources'); setUi({ archiveFocus: s }); }}>
                  {archive.byId.source.get(s)?.author.split(',')[0]} {archive.byId.source.get(s)?.date.slice(0, 4)}
                </button>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
