import { useEffect, useRef } from 'react';
import { archive, nameOf } from '../data/archive';
import { silentOn } from '../engine/debate';
import type { Utterance } from '../model/types';
import { useSession, useStore } from '../state/store';
import { Confidence, Medallion, ProvenanceBadge, Seal } from './bits';

const MOVE_WORD: Record<string, string> = {
  assert: 'states',
  challenge: 'objects',
  question: 'asks',
  evidence: 'cites evidence',
  concede: 'concedes',
  redirect: 'turns the question',
  clarify: 'clarifies',
};

function UtteranceView({ u }: { u: Utterance }) {
  const setUi = useStore((s) => s.setUi);
  const debate = useStore((s) => s.debate);
  const openEnvelope = useStore((s) => s.openEnvelope);

  if (u.kind === 'user') {
    return (
      <div className="utt user">
        <div className="bubble">
          <span className="mono">You{u.addressedTo ? ` → ${nameOf(u.addressedTo)}` : ' → the room'}</span>
          {u.text}
        </div>
      </div>
    );
  }
  if (u.kind === 'envelope') {
    const env = archive.byId.envelope.get(u.envelopeId!)!;
    return (
      <div className="utt envelope">
        <div className="letter">
          <span className="stamp">
            <Seal letter={env.year.slice(2, 4)} />
          </span>
          <div className="from">An envelope from the future · {env.year}</div>
          <h4>{env.title}</h4>
          <p>{u.text}</p>
        </div>
      </div>
    );
  }
  if (u.kind === 'narration') {
    return (
      <div className="utt narration">
        <div className="narr">{u.text}</div>
        {u.offer && (
          <div className="offers">
            {u.offer.envelopeIds?.map((id) => {
              const e = archive.byId.envelope.get(id)!;
              return (
                <button key={id} className="btn small" onClick={() => openEnvelope(id)}>
                  <Seal letter={e.year.slice(2, 4)} /> Open: {e.title} ({e.year})
                </button>
              );
            })}
            {u.offer.propositionIds?.map((id) => (
              <button key={id} className="chip" onClick={() => debate(id)}>
                {archive.byId.proposition.get(id)?.question}
              </button>
            ))}
          </div>
        )}
        {u.rationale.length > 0 && !u.offer && (
          <button className="why" style={{ marginTop: 6 }} onClick={() => setUi({ evidence: u.id })}>
            details
          </button>
        )}
      </div>
    );
  }

  const p = archive.byId.participant.get(u.speaker);
  const quote = u.quoteId ? archive.byId.quote.get(u.quoteId) : undefined;
  const quoteSource = quote ? archive.byId.source.get(quote.sourceId) : undefined;
  const isSilence = u.kind === 'silence';
  const fell = u.render?.outcome === 'fell-back';

  return (
    <div className={`utt ${u.kind}`}>
      <Medallion id={u.speaker} size={42} onClick={() => setUi(p?.kind === 'guest' ? { emptyChair: true } : { dossier: u.speaker, dossierTab: 'profile' })} />
      <div className="utt-head">
        <button className="who" onClick={() => p?.kind !== 'guest' && setUi({ dossier: u.speaker, dossierTab: 'profile' })}>
          {p?.shortName ?? u.speaker}
        </button>
        {p?.kind === 'guest' && <span className="pbadge speculative"><i />hypothetical guest</span>}
        {!isSilence && u.move && <span className="move">{MOVE_WORD[u.move]}</span>}
        {u.addressedTo && <span className="to">to {u.addressedTo === 'user' ? 'you' : nameOf(u.addressedTo)}</span>}
        {u.status && <span className={`status-tag status-${u.status}`}>{u.status}</span>}
      </div>
      <div className={`utt-body ${u.provenance ? `p-${u.provenance}` : ''}`}>{u.text}</div>
      {quote && (
        <div className="quote-inset">
          <div className="q">“{quote.text}”</div>
          <div className="cite">
            On record · {quote.wording.replace(/-/g, ' ')} · {quote.reportedBy ? `reported by ${quote.reportedBy}` : quoteSource?.author}, {quote.date}
          </div>
        </div>
      )}
      <div className="utt-foot">
        {u.provenance && <ProvenanceBadge p={u.provenance} />}
        {u.confidence && <Confidence c={u.confidence} />}
        {u.render?.mode === 'live' && (
          <span className="mono" style={{ fontSize: 9.5, color: fell ? 'var(--brass-2)' : 'var(--chalk-3)' }}>
            {fell ? 'live rendering rejected · archival text' : 'rendered live · validated'}
          </span>
        )}
        {(u.render?.issues ?? []).some((i) => i.severity === 'error') && !fell && (
          <span className="mono" style={{ color: 'var(--deny)', fontSize: 9.5 }}>validation issue</span>
        )}
        <button className="why" onClick={() => setUi({ evidence: u.id })}>
          {isSilence ? 'why silent?' : 'why this?'}
        </button>
      </div>
    </div>
  );
}

export function Minutes() {
  const session = useSession();
  const hidden = useStore((s) => s.hidden);
  const speaking = useStore((s) => s.speaking);
  const busy = useStore((s) => s.busy);
  const setActiveThread = useStore((s) => s.setActiveThread);
  const continueThread = useStore((s) => s.continueThread);
  const invite = useStore((s) => s.invite);
  const setUi = useStore((s) => s.setUi);
  const debate = useStore((s) => s.debate);
  const ref = useRef<HTMLDivElement>(null);

  const thread = session.threads.find((t) => t.id === session.activeThreadId) ?? session.threads[session.threads.length - 1];
  const utterances = thread ? thread.utteranceIds.map((id) => session.utterances[id]).filter((u) => u && !hidden[u.id]) : [];

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [utterances.length, speaking, thread?.id]);

  const prop = thread?.propositionId ? archive.byId.proposition.get(thread.propositionId) : undefined;
  const silent = prop && thread?.kind === 'proposition' ? silentOn(archive, session, prop.id) : [];
  const env = thread?.envelopeId ? archive.byId.envelope.get(thread.envelopeId) : undefined;
  const laterEnvelopes = prop
    ? prop.relatedEvents
        .map((e) => archive.byId.event.get(e)?.envelopeId)
        .filter((id, i, a): id is string => !!id && a.indexOf(id) === i && !session.openedEnvelopes.includes(id))
    : [];

  return (
    <>
      {session.threads.length > 0 && (
        <div className="threads" role="tablist" aria-label="Discussions">
          {session.threads.map((t) => (
            <button key={t.id} role="tab" aria-selected={t.id === thread?.id} className={t.id === thread?.id ? 'on' : ''} onClick={() => setActiveThread(t.id)} title={t.title}>
              {t.kind === 'envelope' ? '✉ ' : t.kind === 'question' ? '→ ' : '§ '}
              {t.title}
            </button>
          ))}
        </div>
      )}
      <div className="minutes" ref={ref} aria-live="polite">
        {!thread && (
          <div className="minutes-empty">
            <div className="mono muted">Procès-verbal</div>
            <h3>The minutes are open.</h3>
            <p>Put a proposition to the room, address a participant by name, or break the seal on an envelope from the future. Everything said here is drawn from the archive, and every line can be audited.</p>
          </div>
        )}
        {utterances.map((u) => (
          <UtteranceView key={u.id} u={u} />
        ))}
        {speaking && (
          <div className="speaking-indicator">
            <span className="dots"><span /><span /><span /></span> {nameOf(speaking)} {session.voicing === 'live' ? 'is composing a reply…' : 'takes the floor…'}
          </div>
        )}
        {thread && !busy && (
          <div className="thread-actions">
            {thread.kind !== 'envelope' && (
              <button className="btn small" onClick={() => continueThread(thread.id)}>
                Let the discussion continue
              </button>
            )}
            {thread.kind === 'proposition' && (
              <button className="btn small ghost" onClick={() => setUi({ view: 'map', mapThreadId: thread.id })}>
                See the argument map
              </button>
            )}
            {silent.length > 0 && (
              <span className="dim" style={{ fontSize: 13 }}>
                Ask a silent participant:{' '}
                {silent.map((id) => (
                  <button key={id} className="chip" style={{ marginRight: 4 }} onClick={() => invite(id, thread.id)}>
                    {nameOf(id)}
                  </button>
                ))}
              </span>
            )}
            {laterEnvelopes.slice(0, 2).map((id) => {
              const e = archive.byId.envelope.get(id)!;
              return (
                <button key={id} className="btn small" onClick={() => useStore.getState().openEnvelope(id)} title="Introduce a later result into this discussion">
                  <Seal letter={e.year.slice(2, 4)} /> {e.title}
                </button>
              );
            })}
            {env?.next?.filter((n) => !session.openedEnvelopes.includes(n)).map((n) => {
              const e = archive.byId.envelope.get(n)!;
              return (
                <button key={n} className="btn small" onClick={() => useStore.getState().openEnvelope(n)}>
                  <Seal letter={e.year.slice(2, 4)} /> Next envelope: {e.title}
                </button>
              );
            })}
            {prop?.followUps.map((f) => (
              <button key={f} className="chip" onClick={() => debate(f)}>
                {archive.byId.proposition.get(f)?.question}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
