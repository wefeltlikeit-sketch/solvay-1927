import { useMemo } from 'react';
import { archive, SEAT_ORDER } from '../data/archive';
import { silentOn } from '../engine/debate';
import { useSession, useStore } from '../state/store';
import { Medallion } from './bits';

const W = 1000;
const H = 600;
const CX = 500;
const CY = 300;
const SEAT_RX = 420;
const SEAT_RY = 222;

const EMPTY = '__empty__';
const ORDER = [...SEAT_ORDER.slice(0, 7), EMPTY, ...SEAT_ORDER.slice(7)];

function seatPos(i: number) {
  const theta = ((180 - (i * 360) / ORDER.length) * Math.PI) / 180;
  return { x: CX + SEAT_RX * Math.cos(theta), y: CY - SEAT_RY * Math.sin(theta), top: Math.sin(theta) > 0.05 };
}

export function Table({ compact = false, highlight }: { compact?: boolean; highlight?: string }) {
  const session = useSession();
  const speaking = useStore((s) => s.speaking);
  const hidden = useStore((s) => s.hidden);
  const setUi = useStore((s) => s.setUi);
  const thread = session.threads.find((t) => t.id === session.activeThreadId);

  const lastShown = useMemo(() => {
    if (!thread) return undefined;
    const us = thread.utteranceIds.map((id) => session.utterances[id]).filter((u) => u && !hidden[u.id] && u.kind === 'speech');
    return us[us.length - 1];
  }, [thread, session.utterances, hidden]);

  const current = speaking ? undefined : lastShown;
  const activeSpeaker = speaking ?? highlight ?? current?.speaker;
  const addressee = !speaking ? current?.addressedTo : undefined;
  const silent = thread?.propositionId && thread.kind === 'proposition' ? new Set(silentOn(archive, session, thread.propositionId)) : new Set<string>();
  const guest = session.mode === 'experimental' ? session.guest : undefined;

  const positions = ORDER.map((id, i) => ({ id: id === EMPTY ? guest ?? EMPTY : id, ...seatPos(i) }));
  const from = positions.find((p) => p.id === activeSpeaker);
  const to = positions.find((p) => p.id === addressee);
  const tableLabel = thread?.kind === 'proposition' ? thread.title : thread?.kind === 'envelope' ? thread.title : 'Électrons et Photons';

  return (
    <svg className="table-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="The conference table">
      <defs>
        <radialGradient id="lamp" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="rgba(230,200,140,0.20)" />
          <stop offset="100%" stopColor="rgba(230,200,140,0)" />
        </radialGradient>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a1f16" />
          <stop offset="100%" stopColor="#1a130d" />
        </linearGradient>
        <radialGradient id="halo">
          <stop offset="0%" stopColor="rgba(230,202,140,0.55)" />
          <stop offset="100%" stopColor="rgba(230,202,140,0)" />
        </radialGradient>
      </defs>
      <ellipse cx={CX} cy={CY} rx={470} ry={280} fill="url(#lamp)" />

      {/* back row: present but not yet grounded */}
      {!compact &&
        archive.bystanders.map((b, i) => {
          const x = 110 + (i * 780) / (archive.bystanders.length - 1);
          const y = 16 + (i % 2) * 10;
          return (
            <g key={b.id} opacity={0.4}>
              <title>{`${b.name} — ${b.affiliation}. ${b.note}`}</title>
              <circle cx={x} cy={y} r={5.5} fill="none" stroke="var(--chalk-3)" strokeWidth={0.8} />
            </g>
          );
        })}

      <ellipse cx={CX} cy={CY + 6} rx={330} ry={128} fill="rgba(0,0,0,0.45)" />
      <ellipse cx={CX} cy={CY} rx={330} ry={126} fill="url(#wood)" stroke="#4a3a28" strokeWidth={1.5} />
      <ellipse cx={CX} cy={CY} rx={316} ry={114} fill="none" stroke="rgba(201,164,92,0.18)" strokeWidth={0.8} />
      {/* papers on the table */}
      {[[-170, -30, -8], [150, 20, 6], [-40, 50, 3], [60, -60, -4], [230, -40, 10], [-250, 30, 12]].map(([dx, dy, rot], i) => (
        <rect key={i} x={CX + dx - 22} y={CY + dy - 15} width={44} height={30} rx={1} fill="#d8cdb4" opacity={0.13} transform={`rotate(${rot} ${CX + dx} ${CY + dy})`} />
      ))}
      <text x={CX} y={CY - 8} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={10} letterSpacing="0.3em" fill="var(--brass)" opacity={0.8}>
        {thread ? 'ON THE TABLE' : 'CINQUIÈME CONSEIL DE PHYSIQUE SOLVAY'}
      </text>
      <text x={CX} y={CY + 22} textAnchor="middle" fontFamily="var(--f-display)" fontStyle="italic" fontSize={tableLabel.length > 42 ? 20 : 26} fill="var(--chalk)">
        {tableLabel.length > 60 ? tableLabel.slice(0, 58) + '…' : tableLabel}
      </text>

      {from && to && from !== to && (
        <path
          className="chalk-line"
          d={`M ${from.x} ${from.y} Q ${CX} ${CY} ${to.x} ${to.y}`}
          key={`${from.id}-${to.id}`}
        />
      )}

      {positions.map((p, seatIndex) => {
        const isEmpty = p.id === EMPTY;
        const participant = archive.byId.participant.get(p.id);
        const size = 66;
        const cls = [
          'seat',
          activeSpeaker === p.id ? 'speaking' : '',
          addressee === p.id ? 'addressed' : '',
          silent.has(p.id) ? 'dimmed' : '',
          participant?.kind === 'guest' ? 'guest' : '',
        ].join(' ');
        const label = isEmpty ? 'THE EMPTY CHAIR' : participant?.shortName.toUpperCase();
        const ly = p.top ? p.y - size / 2 - 9 : p.y + size / 2 + 19;
        return (
          <g
            key={seatIndex}
            className={cls}
            onClick={() => (isEmpty || participant?.kind === 'guest' ? setUi({ emptyChair: true }) : setUi({ dossier: p.id, dossierTab: 'profile' }))}
            tabIndex={0}
            role="button"
            aria-label={isEmpty ? 'The empty chair — invite a guest' : `${participant?.name} — open dossier`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') (e.currentTarget as SVGGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }}
          >
            <circle className="halo" cx={p.x} cy={p.y} r={size * 0.95} fill="url(#halo)" />
            {isEmpty ? (
              <g>
                <circle className="ring" cx={p.x} cy={p.y} r={size / 2} fill="rgba(12,13,15,0.8)" stroke="var(--p-speculative)" strokeWidth={1.3} strokeDasharray="4 4" />
                <text x={p.x} y={p.y + 9} textAnchor="middle" fontFamily="var(--f-display)" fontSize={26} fill="var(--p-speculative)">
                  ?
                </text>
              </g>
            ) : (
              <g transform={`translate(${p.x - size / 2} ${p.y - size / 2})`}>
                <Medallion id={p.id} size={size} />
                <circle className="ring" cx={size / 2} cy={size / 2} r={size / 2 - 0.5} fill="none" stroke="transparent" strokeWidth={1.5} />
              </g>
            )}
            <text className="name" x={p.x} y={ly} textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
