import { useSession, useStore, type View } from '../state/store';
import { Seal } from './bits';

const VIEWS: [View, string][] = [
  ['room', 'The Room'],
  ['map', 'Argument Map'],
  ['timeline', 'Time Machine'],
  ['ledger', 'Ledger'],
  ['archive', 'Archive'],
];

export function TopBar() {
  const view = useStore((s) => s.ui.view);
  const setUi = useStore((s) => s.setUi);
  const setMode = useStore((s) => s.setMode);
  const setVoicing = useStore((s) => s.setVoicing);
  const live = useStore((s) => s.live);
  const session = useSession();

  return (
    <header className="topbar">
      <button className="wordmark" onClick={() => setUi({ view: 'room' })} aria-label="Solvay 1927 — back to the room">
        <b>SOLVAY 1927</b>
        <i>The Conference That Never Ends</i>
      </button>
      <nav className="nav" aria-label="Views">
        {VIEWS.map(([id, label]) => (
          <button key={id} className={view === id ? 'on' : ''} onClick={() => setUi({ view: id })}>
            {label}
          </button>
        ))}
      </nav>
      <div className="spacer" />
      <div className="toggle" role="group" aria-label="Simulation mode" title="Historical: nothing after October 1927 unless introduced. Experimental: later people may join through the empty chair.">
        <button className={`hist ${session.mode === 'historical' ? 'on' : ''}`} onClick={() => setMode('historical')}>
          Historical
        </button>
        <button className={`exp ${session.mode === 'experimental' ? 'on' : ''}`} onClick={() => setMode('experimental')}>
          Experimental
        </button>
      </div>
      <div
        className="toggle"
        role="group"
        aria-label="Voices"
        title={
          live.enabled
            ? `Archival: speech is the archived paraphrase. Live: ${live.model} rephrases the chosen claim in context; the validator checks every line.`
            : 'Live rendering is off: set ANTHROPIC_API_KEY on the server (see README). The archive works fully without it.'
        }
      >
        <button className={session.voicing === 'archival' ? 'on' : ''} onClick={() => setVoicing('archival')}>
          Archival
        </button>
        <button className={session.voicing === 'live' ? 'on' : ''} disabled={!live.enabled} onClick={() => setVoicing('live')} style={{ opacity: live.enabled ? 1 : 0.4 }}>
          Live
        </button>
      </div>
      <button className="btn small env-btn" onClick={() => setUi({ envelopes: true })}>
        <Seal /> <span className="label">Envelopes</span>
      </button>
      <button className="btn small ghost session-btn" onClick={() => setUi({ sessions: true })} title="Sessions">
        {session.name}
      </button>
    </header>
  );
}
