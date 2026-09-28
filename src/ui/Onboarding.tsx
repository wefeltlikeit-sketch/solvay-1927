import { useEffect, useState } from 'react';
import { archive, ageAt } from '../data/archive';
import { useStore } from '../state/store';
import { ProvenanceBadge } from './bits';
import { Table } from './Table';

const OPENING = [
  'Brussels. Monday, the twenty-fourth of October, 1927.',
  'In the Institute of Physiology in the Parc Léopold, the fifth Solvay Council on Physics is convening. Its subject: electrons and photons.',
  'Around one table sit most of the people who built quantum mechanics — and nearly all of those who doubt it.',
  'They agree on the equations. They do not agree on what the equations mean.',
];

function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return m ? m[0].trim() : s;
}

export function Onboarding() {
  const finish = useStore((s) => s.finishOnboarding);
  const debate = useStore((s) => s.debate);
  const openEnvelope = useStore((s) => s.openEnvelope);
  const [scene, setScene] = useState(0);
  const [who, setWho] = useState(0);
  const people = archive.attendees;

  useEffect(() => {
    if (scene !== 1) return;
    const t = setInterval(() => setWho((w) => (w + 1) % people.length), 3400);
    return () => clearInterval(t);
  }, [scene, people.length]);

  const p = people[who];
  const featured = archive.propositions.filter((x) => x.featured);
  const firstEnvelope = archive.envelopes.find((e) => e.firstEnvelope)!;

  return (
    <div className="onboard" role="dialog" aria-label="Introduction">
      <button className="btn small ghost skip" onClick={finish}>
        Skip introduction
      </button>
      <div className="stage">
        {scene === 0 && (
          <>
            <h1 className="title">SOLVAY 1927</h1>
            <div className="sub">The Conference That Never Ends</div>
            {OPENING.map((l, i) => (
              <p key={i} className={`line ${i > 1 ? 'small' : ''}`} style={{ animationDelay: `${0.6 + i * 1.6}s` }}>
                {l}
              </p>
            ))}
            <div className="controls" style={{ animationDelay: `${0.6 + OPENING.length * 1.6}s` }}>
              <button className="btn primary" onClick={() => setScene(1)}>
                Enter the room
              </button>
            </div>
          </>
        )}

        {scene === 1 && (
          <>
            <div className="intro-grid">
              <div>
                <Table compact highlight={p.id} />
              </div>
              <div className="intro-person" key={p.id}>
                <div className="mono muted">
                  {who + 1} of {people.length} · aged {ageAt(p.born)} · {p.nationality}
                </div>
                <h3>{p.name}</h3>
                <div className="dim" style={{ marginBottom: 10 }}>{p.affiliation}</div>
                <p>{firstSentence(p.bio)}</p>
                <p className="dim" style={{ fontSize: 14 }}>
                  <b>At this council:</b> {p.role}.
                </p>
              </div>
            </div>
            <div className="controls" style={{ animationDelay: '0.2s' }}>
              <button className="btn ghost" onClick={() => setWho((w) => (w - 1 + people.length) % people.length)}>
                ←
              </button>
              <button className="btn ghost" onClick={() => setWho((w) => (w + 1) % people.length)}>
                →
              </button>
              <button className="btn primary" onClick={() => setScene(2)}>
                Take your seat
              </button>
            </div>
            <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 14 }}>
              Sixteen others are present — Kramers, Langmuir, Bragg, Debye and more — shown faintly at the back of the room until their dossiers are grounded. One chair stands empty.
            </p>
          </>
        )}

        {scene === 2 && (
          <>
            <p className="line" style={{ animationDelay: '0s' }}>The rules of the room</p>
            <p className="line small" style={{ animationDelay: '0.3s' }}>
              No one here is a chatbot wearing a name tag. Every word spoken is drawn from an archive of documented positions, and marked for how we know it.
            </p>
            <div className="rules">
              {[
                ['quotation', 'Recorded words, from a traceable source, with the security of the wording stated. Never invented.'],
                ['documented', 'A position the sources show they held — paraphrased in the room, never presented as their words.'],
                ['inference', 'A reasonable extension of what they held to a question they did not address in this form.'],
                ['speculative', 'Beyond the evidence. Kept only because it is labelled — and never in place of silence.'],
              ].map(([k, t], i) => (
                <div key={k} className="rule" style={{ animationDelay: `${0.5 + i * 0.25}s` }}>
                  <ProvenanceBadge p={k as never} />
                  <p style={{ marginTop: 6 }}>{t}</p>
                </div>
              ))}
              <div className="rule" style={{ animationDelay: '1.6s' }}>
                <h4>The horizon is October 1927</h4>
                <p>They do not know what comes later — not Bell, not the positron, not the cat. You may tell them, by envelope. The ledger records what each has been told and how they took it.</p>
              </div>
              <div className="rule" style={{ animationDelay: '1.85s' }}>
                <h4>Silence is a feature</h4>
                <p>Where evidence runs out, the minutes say so. Ask “why did you make Einstein say that?” at any time, and the simulation will show its sources.</p>
              </div>
            </div>
            <div className="controls" style={{ animationDelay: '2.2s' }}>
              <button className="btn primary" onClick={() => setScene(3)}>
                The chair calls the session to order
              </button>
            </div>
          </>
        )}

        {scene === 3 && (
          <>
            <p className="line" style={{ animationDelay: '0s' }}>What will you put to the room?</p>
            <div className="big-questions">
              {featured.map((q, i) => (
                <button
                  key={q.id}
                  className="big-q"
                  style={{ animationDelay: `${0.3 + i * 0.15}s` }}
                  onClick={() => {
                    finish();
                    debate(q.id);
                  }}
                >
                  {q.question}
                  <small>{q.context.split('. ')[0]}.</small>
                </button>
              ))}
              <button
                className="big-q first-envelope"
                style={{ animationDelay: '1s' }}
                onClick={() => {
                  finish();
                  openEnvelope(firstEnvelope.id);
                }}
              >
                <span className="seal">{firstEnvelope.year.slice(2, 4)}</span>
                <span>
                  Open the first envelope from the future
                  <small>
                    Dated {firstEnvelope.year}. {firstEnvelope.seal}.
                  </small>
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
