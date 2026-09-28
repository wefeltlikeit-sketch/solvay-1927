import { useRef, useState } from 'react';
import { archive } from '../data/archive';
import { useSession, useStore } from '../state/store';
import { Close, Medallion } from './bits';

export function EmptyChair() {
  const open = useStore((s) => s.ui.emptyChair);
  const setUi = useStore((s) => s.setUi);
  const seat = useStore((s) => s.seatGuest);
  const unseat = useStore((s) => s.unseatGuest);
  const setMode = useStore((s) => s.setMode);
  const session = useSession();
  if (!open) return null;
  const close = () => setUi({ emptyChair: false });
  const historical = session.mode === 'historical';

  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="modal" role="dialog" aria-label="The empty chair">
        <div style={{ display: 'flex' }}>
          <div>
            <div className="mono" style={{ color: 'var(--p-speculative)' }}>The empty chair</div>
            <h2>Invite someone who was not here</h2>
          </div>
          <Close onClick={close} />
        </div>
        <p className="dim">
          A guest brings knowledge from their own time into October 1927. They are shown with a dashed violet ring and are never mistaken for an attendee. The attendees still know only what you introduce — a guest's words are theirs, not the room's.
        </p>
        {historical && (
          <div className="caution" style={{ margin: '10px 0' }}>
            Historical mode admits no one and nothing from after October 1927 unless introduced by envelope.{' '}
            <button className="btn small" onClick={() => setMode('experimental')}>
              Switch to Experimental mode
            </button>
          </div>
        )}
        {session.guest && !historical && (
          <p>
            Currently seated: <b>{archive.byId.participant.get(session.guest)?.name}</b>.{' '}
            <button className="btn small ghost" onClick={unseat}>
              Ask them to leave
            </button>
          </p>
        )}
        <div className="grid-cards">
          {archive.guests.map((g) => (
            <button key={g.id} className="guest-card" disabled={historical} onClick={() => seat(g.id)} style={{ opacity: historical ? 0.5 : 1, outline: session.guest === g.id ? '1px solid var(--p-speculative)' : undefined }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Medallion id={g.id} size={40} />
                <div>
                  <h4>{g.name}</h4>
                  <div className="mono muted">{g.guest?.era}</div>
                </div>
              </div>
              <p className="dim" style={{ fontSize: 13.5, margin: '8px 0 4px' }}>{g.guest?.whyInvited}</p>
              <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{g.guest?.caution}</p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function EnvelopePicker() {
  const open = useStore((s) => s.ui.envelopes);
  const setUi = useStore((s) => s.setUi);
  const openEnvelope = useStore((s) => s.openEnvelope);
  const session = useSession();
  if (!open) return null;
  const close = () => setUi({ envelopes: false });
  const sorted = archive.envelopes.slice().sort((a, b) => Number(!!b.firstEnvelope) - Number(!!a.firstEnvelope) || a.year.localeCompare(b.year));

  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="modal" role="dialog" aria-label="Envelopes from the future">
        <div style={{ display: 'flex' }}>
          <div>
            <div className="mono" style={{ color: 'var(--brass-2)' }}>Envelopes from the future</div>
            <h2>What will you tell them?</h2>
          </div>
          <Close onClick={close} />
        </div>
        <p className="dim">
          Each envelope contains a later result, written for a 1927 audience. The participants will react from their own frameworks — not from ours. Where the real person lived to respond, the historical record is attached, separately.
        </p>
        <div className="grid-cards">
          {sorted.map((e) => {
            const opened = session.openedEnvelopes.includes(e.id);
            const missing = (e.prerequisites ?? []).filter((p) => !session.openedEnvelopes.includes(p));
            return (
              <button key={e.id} className={`env-card ${opened ? 'opened' : ''} ${e.firstEnvelope && !opened ? 'first' : ''}`} onClick={() => openEnvelope(e.id)}>
                <span className="seal">{e.year.slice(2, 4)}</span>
                <div className="year">{e.year}{e.firstEnvelope ? ' · the first envelope' : ''}</div>
                <h4>{e.title}</h4>
                <p>{e.seal}</p>
                <div className="year" style={{ marginTop: 8 }}>
                  {opened ? 'Opened — open again to rehear' : missing.length ? `Best after: ${missing.map((m) => archive.byId.envelope.get(m)?.title).join(', ')}` : `${e.reactions.length} reactions archived`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function Sessions() {
  const open = useStore((s) => s.ui.sessions);
  const setUi = useStore((s) => s.setUi);
  const sessions = useStore((s) => s.sessions);
  const currentId = useStore((s) => s.currentId);
  const { newSession, switchSession, renameSession, deleteSession, importSession, replayOnboarding } = useStore.getState();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!open) return null;
  const close = () => setUi({ sessions: false });

  const exportSession = (id: string) => {
    const s = sessions[id];
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `solvay1927-${s.name.replace(/\W+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="modal" role="dialog" aria-label="Sittings" style={{ width: 'min(620px, calc(100vw - 32px))' }}>
        <div style={{ display: 'flex' }}>
          <div>
            <div className="mono muted">Sittings · saved in this browser</div>
            <h2>Your sessions</h2>
          </div>
          <Close onClick={close} />
        </div>
        {Object.values(sessions)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((s) => (
            <div key={s.id} className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderColor: s.id === currentId ? 'var(--brass-dim)' : undefined }}>
              <input
                defaultValue={s.name}
                onBlur={(e) => renameSession(s.id, e.target.value || s.name)}
                style={{ background: 'transparent', border: 0, fontFamily: 'var(--f-display)', fontSize: 19, flex: 1, minWidth: 160 }}
                aria-label="Session name"
              />
              <span className="mono muted">
                {s.threads.length} discussions · {s.openedEnvelopes.length} envelopes · {s.mode}
              </span>
              {s.id !== currentId && <button className="btn small" onClick={() => { switchSession(s.id); close(); }}>Resume</button>}
              <button className="btn small ghost" onClick={() => exportSession(s.id)}>Export</button>
              <button className="btn small ghost" onClick={() => confirm(`Delete “${s.name}”?`) && deleteSession(s.id)}>Delete</button>
            </div>
          ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => { newSession(); close(); }}>New sitting</button>
          <button className="btn" onClick={() => file.current?.click()}>Import session…</button>
          <button className="btn ghost" onClick={() => { replayOnboarding(); close(); }}>Replay the introduction</button>
          <input
            ref={file}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const err = importSession(await f.text());
              setMsg(err ?? 'Imported.');
            }}
          />
        </div>
        {msg && <p className="dim">{msg}</p>}
      </div>
    </>
  );
}
