import { useEffect } from 'react';
import { useStore } from '../state/store';
import { ArchiveView } from './ArchiveView';
import { ArgumentMapView } from './ArgumentMapView';
import { Dossier } from './Dossier';
import { Evidence } from './Evidence';
import { LedgerView } from './LedgerView';
import { EmptyChair, EnvelopePicker, Sessions } from './Modals';
import { Onboarding } from './Onboarding';
import { Room } from './Room';
import { Timeline } from './Timeline';
import { TopBar } from './TopBar';

const GHOSTS: [string, number, number, number][] = [
  ['iħ ∂ψ/∂t = Hψ', 6, 14, 44],
  ['pq − qp = h/2πi', 72, 22, 36],
  ['Δq · Δp ~ h', 14, 78, 40],
  ['λ = h/p', 82, 70, 52],
  ['E = hν', 46, 90, 34],
  ['|ψ|²', 90, 40, 60],
];

export function App() {
  const view = useStore((s) => s.ui.view);
  const onboarded = useStore((s) => s.onboarded);
  const init = useStore((s) => s.init);
  const setUi = useStore((s) => s.setUi);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUi({ dossier: undefined, evidence: undefined, emptyChair: false, envelopes: false, sessions: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setUi]);

  return (
    <div className="app">
      <div className="ghosts" aria-hidden>
        {GHOSTS.map(([t, x, y, s]) => (
          <span key={t} style={{ left: `${x}%`, top: `${y}%`, fontSize: s }}>
            {t}
          </span>
        ))}
      </div>
      <TopBar />
      <main className="main">
        {view === 'room' && <Room />}
        {view === 'map' && <ArgumentMapView />}
        {view === 'timeline' && <Timeline />}
        {view === 'ledger' && <LedgerView />}
        {view === 'archive' && <ArchiveView />}
      </main>
      <Dossier />
      <Evidence />
      <EmptyChair />
      <EnvelopePicker />
      <Sessions />
      {!onboarded && <Onboarding />}
    </div>
  );
}
