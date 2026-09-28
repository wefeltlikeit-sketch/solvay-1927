import { archive, nameOf } from '../data/archive';
import { unlockedTerms } from '../engine/validator';
import { PROVENANCE_LABEL } from '../engine/weights';
import type { Provenance } from '../model/types';
import { useSession, useStore } from '../state/store';
import { Close, Confidence, Medallion, ProvenanceBadge, SourceLine } from './bits';

const LAYERS: { p: Provenance; what: string }[] = [
  { p: 'quotation', what: 'Words the person is recorded as having written or said, with the wording’s security stated.' },
  { p: 'documented', what: 'A position the sources show they held — paraphrased, never presented as their words.' },
  { p: 'inference', what: 'A reasonable extension of documented positions to a question they did not address in this form.' },
  { p: 'speculative', what: 'Extrapolation beyond the evidence, kept only because it is labelled and constrained.' },
];

export function Evidence() {
  const id = useStore((s) => s.ui.evidence);
  const setUi = useStore((s) => s.setUi);
  const session = useSession();
  if (!id) return null;
  const close = () => setUi({ evidence: undefined });
  const u = session.utterances[id];

  if (!u) {
    return (
      <>
        <div className="scrim" onClick={close} />
        <aside className="drawer" role="dialog" aria-label="Evidence">
          <div className="drawer-head">
            <h2>Evidence</h2>
            <Close onClick={close} />
          </div>
          <div className="drawer-body">
            <p className="dim">There is no matching speech in this session yet to explain. Once someone has spoken, ask again — or press “why this?” beneath any turn.</p>
          </div>
        </aside>
      </>
    );
  }

  const claim = u.claimId ? archive.byId.claim.get(u.claimId) : undefined;
  const quotes = [...new Set([...(u.quoteId ? [u.quoteId] : []), ...(claim?.quoteIds ?? [])])].map((q) => archive.byId.quote.get(q)!).filter(Boolean);
  const unlocked = [...unlockedTerms(archive, session.openedEnvelopes)];
  const who = archive.byId.participant.get(u.speaker);
  const issues = u.render?.issues ?? [];

  return (
    <>
      <div className="scrim" onClick={close} />
      <aside className="drawer" role="dialog" aria-label="Evidence">
        <div className="drawer-head">
          {who ? <Medallion id={who.id} size={52} /> : null}
          <div>
            <div className="mono muted">Evidence mode · intellectually auditable</div>
            <h2>{u.kind === 'narration' ? 'Why the chair said this' : `Why did the simulation make ${nameOf(u.speaker)} say that?`}</h2>
          </div>
          <Close onClick={close} />
        </div>
        <div className="drawer-body">
          {u.kind !== 'narration' && (
            <div className="card" style={{ background: 'var(--ink-1)' }}>
              <div className="dim" style={{ fontStyle: 'italic' }}>{u.text}</div>
            </div>
          )}

          {u.kind === 'silence' && (
            <div className="block">
              <h3>Why silence</h3>
              <p>
                The archive contains no claim by {nameOf(u.speaker)} that bears on this question. Rather than generate a plausible-sounding opinion, the simulation records the absence of evidence. That is a feature, not a failure.
              </p>
            </div>
          )}

          {claim && (
            <div className="block">
              <h3>Layer of evidence</h3>
              {LAYERS.map((l) => (
                <div key={l.p} className="card" style={{ opacity: l.p === claim.provenance ? 1 : 0.4, borderColor: l.p === claim.provenance ? 'var(--brass-dim)' : undefined }}>
                  <ProvenanceBadge p={l.p} /> {l.p === claim.provenance && <b className="mono" style={{ fontSize: 9.5, color: 'var(--brass-2)' }}> ← this turn</b>}
                  <div className="dim" style={{ fontSize: 13.5, marginTop: 4 }}>{l.what}</div>
                </div>
              ))}
            </div>
          )}

          {claim && (
            <div className="block">
              <h3>The archived claim</h3>
              <div className="card">
                <h4>{claim.label}</h4>
                <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                  <ProvenanceBadge p={claim.provenance} />
                  <Confidence c={claim.confidence} />
                  <span className="conf">held as of {claim.asOf}</span>
                </div>
                <p>{claim.summary}</p>
                <p className="dim"><b>Reasoning.</b> {claim.reasoning}</p>
                {claim.evidence && <p className="dim"><b>Evidence available at the time.</b> {claim.evidence.join(' · ')}</p>}
                {claim.objections && <p className="dim"><b>Objections.</b> {claim.objections.join(' · ')}</p>}
                {claim.exchangeNote && <p className="dim"><b>The exchange.</b> {claim.exchangeNote}</p>}
                <p className="muted" style={{ fontSize: 12.5 }}>
                  The words spoken are one of {claim.voice.length} paraphrase rendering{claim.voice.length > 1 ? 's' : ''} written for the simulation within the limits of this claim. They are not quotation.
                </p>
              </div>
            </div>
          )}

          <div className="block">
            <h3>Why this {u.kind === 'narration' ? 'note' : 'speaker, this claim, now'}</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {u.rationale.map((r, i) => (
                <li key={i} style={{ marginBottom: 5 }}>{r}</li>
              ))}
            </ul>
          </div>

          {quotes.length > 0 && (
            <div className="block">
              <h3>Documented words</h3>
              {quotes.map((q) => (
                <div key={q.id} className="quote-inset" style={{ margin: '0 0 10px' }}>
                  <div className="q">“{q.text}”</div>
                  <div className="cite">
                    {q.wording.replace(/-/g, ' ')} · {q.confidence} confidence · {q.date}
                    {q.laterTestimony ? ' · later testimony: not known to the 1927 speaker' : ''}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 6, color: 'var(--paper-ink-2)' }}>{q.context}</div>
                </div>
              ))}
            </div>
          )}

          {(u.sourceIds ?? []).length > 0 && (
            <div className="block">
              <h3>Historical sources</h3>
              {u.sourceIds!.map((s) => (
                <div key={s} className="card">
                  <SourceLine id={s} />
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{archive.byId.source.get(s)?.context}</div>
                </div>
              ))}
            </div>
          )}

          {u.kind === 'speech' && (
            <div className="block">
              <h3>Historical validation</h3>
              {issues.length === 0 && <div className="issue ok">No post-horizon vocabulary. No unverified quotation marks. Claim grounding intact.</div>}
              {issues.map((i, k) => (
                <div key={k} className={`issue ${i.severity === 'error' ? 'error' : 'warning'}`}>
                  <b className="mono" style={{ fontSize: 9.5 }}>{i.kind} · </b>
                  {i.message}
                </div>
              ))}
              <p className="muted" style={{ fontSize: 13 }}>
                Knowledge boundary: {who?.kind === 'guest' ? `${who.shortName}'s own horizon, ${who.guest?.horizon}` : 'October 1927'}.
                {unlocked.length ? ` Introduced by you and therefore speakable: ${unlocked.join(', ')}.` : ' Nothing from the future has been introduced.'}
              </p>
            </div>
          )}

          {u.render?.mode === 'live' && (
            <div className="block">
              <h3>Rendering</h3>
              <p className="dim">
                {u.render.outcome === 'accepted'
                  ? `Rephrased live by ${u.render.model ?? 'the configured model'} from the archived claim, then validated.`
                  : 'A live rendering was attempted and rejected by the validator; the archival text is shown instead.'}
              </p>
              {u.render.archivalText && (
                <div className="card">
                  <div className="mono muted">Archival text</div>
                  <div className="dim">{u.render.archivalText}</div>
                </div>
              )}
            </div>
          )}
          {u.provenance && <p className="muted" style={{ fontSize: 12.5 }}>Displayed as: {PROVENANCE_LABEL[u.provenance]}.</p>}
        </div>
      </aside>
    </>
  );
}
