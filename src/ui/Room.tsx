import { useState } from 'react';
import { archive, CONFERENCE_DATES } from '../data/archive';
import { presentIds } from '../engine/debate';
import { useSession, useStore } from '../state/store';
import { Legend } from './bits';
import { Minutes } from './Minutes';
import { Table } from './Table';

function Composer() {
  const [text, setText] = useState('');
  const [target, setTarget] = useState('');
  const pose = useStore((s) => s.pose);
  const busy = useStore((s) => s.busy);
  const session = useSession();
  const present = presentIds(archive, session);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    pose(text, target || undefined);
    setText('');
  };

  return (
    <div className="composer">
      <form onSubmit={submit}>
        <select className="target-select" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Address">
          <option value="">The room</option>
          {present.map((id) => (
            <option key={id} value={id}>
              {archive.byId.participant.get(id)?.shortName}
            </option>
          ))}
        </select>
        <textarea
          value={text}
          rows={1}
          placeholder={target ? `Your question to ${archive.byId.participant.get(target)?.shortName}…` : 'Put a proposition to the room — or begin “Bohr, …”'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit();
          }}
          aria-label="Your proposition or question"
        />
        <button className="btn primary" type="submit" disabled={busy || !text.trim()}>
          Submit
        </button>
      </form>
      <div className="hint">
        <span>Try: “Is the electron somewhere before we look?” · “Heisenberg, what is a path?” · “Why did you make Bohr say that?”</span>
      </div>
    </div>
  );
}

export function Room() {
  const debate = useStore((s) => s.debate);
  const busy = useStore((s) => s.busy);
  const session = useSession();
  const setUi = useStore((s) => s.setUi);
  const featured = archive.propositions;

  return (
    <div className="room">
      <div className="room-left">
        <div className="section-head">
          <h2>The Room</h2>
          <span className="mono muted">Brussels · {CONFERENCE_DATES}</span>
        </div>
        <div className="table-wrap">
          <Table />
        </div>
        <div className="table-caption muted">
          Select a participant for their dossier.{' '}
          {session.mode === 'experimental' ? (
            <button className="chip" onClick={() => setUi({ emptyChair: true })}>
              {session.guest ? 'Change the guest in the empty chair' : 'Invite someone to the empty chair'}
            </button>
          ) : (
            <span>The empty chair opens in Experimental mode.</span>
          )}
        </div>
        <div className="section-head" style={{ paddingTop: 4 }}>
          <h2 style={{ fontSize: 17 }}>Put a question to the room</h2>
          <button className="chip" onClick={() => setUi({ envelopes: true })}>
            ✉ Envelopes from the future ({session.openedEnvelopes.length}/{archive.envelopes.length} opened)
          </button>
        </div>
        <div className="prompts">
          {featured.map((p) => (
            <button key={p.id} className="prompt-card" disabled={busy} onClick={() => debate(p.id)}>
              {p.question}
              <small>{p.short}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="room-right">
        <Minutes />
        <Composer />
        <Legend />
      </div>
    </div>
  );
}
