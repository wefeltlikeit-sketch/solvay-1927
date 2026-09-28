import { archive, nameOf } from '../data/archive';
import { presentIds } from '../engine/debate';
import { ledgerFor, type LedgerItem } from '../engine/ledger';
import { useSession, useStore } from '../state/store';
import { Medallion } from './bits';

const COLUMNS = [
  ['known', 'Known in 1927'],
  ['introduced', 'Introduced by you'],
  ['accepted', 'Accepted'],
  ['disputed', 'Disputed'],
  ['rejected', 'Rejected'],
  ['unresolved', 'Unresolved'],
] as const;

export function LedgerView() {
  const session = useSession();
  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);
  const ids = presentIds(archive, session);
  const who = ui.ledgerParticipant && ids.includes(ui.ledgerParticipant) ? ui.ledgerParticipant : ids[1] ?? ids[0];
  const ledger = ledgerFor(archive, session, who);
  const p = archive.byId.participant.get(who)!;

  const item = (i: LedgerItem) => (
    <div
      key={i.id}
      className={`ledger-item ${i.direct ? 'direct' : ''}`}
      title={i.note}
      onClick={() => i.kind === 'event' && setUi({ view: 'timeline', timelineEvent: i.refId })}
      style={{ cursor: i.kind === 'event' ? 'pointer' : 'default' }}
    >
      <div className="d">{i.date}{i.kind === 'proposition' ? ' · voiced in session' : i.kind === 'envelope' ? ' · envelope' : ''}</div>
      {i.label}
      {i.kind !== 'event' && <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{i.note}</div>}
    </div>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="mono muted">Knowledge ledger</div>
          <h1>What each of them knows</h1>
          <p>
            The simulation's guard against leaking the future. Nothing reaches a participant except what was known by their horizon, or what you have explicitly introduced — and each introduction is recorded with how they received it.
          </p>
        </div>
      </div>
      <div className="who-pick">
        {ids.map((id) => (
          <button key={id} className={`chip ${id === who ? 'on' : ''}`} onClick={() => setUi({ ledgerParticipant: id })}>
            <Medallion id={id} size={20} /> {nameOf(id)}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <h2 className="display" style={{ margin: 0, fontSize: 26 }}>{p.name}</h2>
        <span className="mono muted">Horizon {ledger.horizon} · {ledger.unknown.length} later events sealed</span>
        <button className="chip" onClick={() => setUi({ dossier: who, dossierTab: 'horizon' })}>What they do not know →</button>
      </div>
      <div className="ledger-grid">
        {COLUMNS.map(([id, label]) => (
          <div key={id} className="ledger-col">
            <h3>
              <span>{label.toUpperCase()}</span>
              <span>{ledger[id].length}</span>
            </h3>
            {ledger[id].length === 0 && <div className="muted" style={{ fontSize: 12.5 }}>—</div>}
            {id === 'known' ? ledger.known.slice().reverse().map(item) : ledger[id].map(item)}
          </div>
        ))}
      </div>

      <div className="panel panel-pad" style={{ marginTop: 18, overflowX: 'auto' }}>
        <div className="mono muted" style={{ marginBottom: 8 }}>The room at a glance · envelopes opened in this session</div>
        {session.openedEnvelopes.length === 0 ? (
          <p className="dim">No envelopes have been opened. The whole room still lives in October 1927.</p>
        ) : (
          <table className="matrix">
            <thead>
              <tr>
                <th>Participant</th>
                {session.openedEnvelopes.map((e) => (
                  <th key={e}>{archive.byId.envelope.get(e)?.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const l = ledgerFor(archive, session, id);
                return (
                  <tr key={id}>
                    <td>{nameOf(id)}</td>
                    {session.openedEnvelopes.map((e) => {
                      const st = (['accepted', 'disputed', 'rejected', 'unresolved'] as const).find((c) => l[c].some((i) => i.refId === e && i.kind === 'envelope'));
                      return (
                        <td key={e}>
                          {st ? <span className={`status-tag status-${st}`}>{st}</span> : <span className="muted">knew already</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
