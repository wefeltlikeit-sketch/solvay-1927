/**
 * The knowledge ledger.
 *
 * A pure function of the archive and the session: for each participant, what
 * they knew in 1927, what the user has introduced, and how they stand on each
 * item. Nothing reaches a participant except through this ledger.
 */
import type { Archive } from '../data/archive';
import { HORIZON, diedBefore } from '../data/archive';
import type { HistoricalEvent, LedgerStatus, Session } from '../model/types';
import { horizonFor } from './validator';
import { sideOf } from './weights';

export type LedgerColumn = 'known' | 'introduced' | LedgerStatus;

export interface LedgerItem {
  id: string;
  label: string;
  date: string;
  kind: 'event' | 'envelope' | 'proposition';
  column: LedgerColumn;
  /** Why the item sits where it does. */
  note: string;
  direct?: boolean;
  refId: string;
}

export interface Ledger {
  participantId: string;
  horizon: string;
  known: LedgerItem[];
  introduced: LedgerItem[];
  accepted: LedgerItem[];
  disputed: LedgerItem[];
  rejected: LedgerItem[];
  unresolved: LedgerItem[];
  /** Post-horizon events not yet introduced. */
  unknown: HistoricalEvent[];
}

export function ledgerFor(archive: Archive, session: Session, participantId: string): Ledger {
  const p = archive.byId.participant.get(participantId);
  const horizon = horizonFor(p);
  const ledger: Ledger = {
    participantId,
    horizon,
    known: [],
    introduced: [],
    accepted: [],
    disputed: [],
    rejected: [],
    unresolved: [],
    unknown: [],
  };

  for (const e of archive.events) {
    if (e.date.slice(0, 7) <= horizon) {
      ledger.known.push({
        id: `known:${e.id}`,
        label: e.title,
        date: e.date,
        kind: 'event',
        column: 'known',
        note: e.knownNote ?? (e.affects.includes(participantId) ? 'Directly involved or directly affected.' : 'Common knowledge in the field by this date.'),
        direct: e.affects.includes(participantId),
        refId: e.id,
      });
    }
  }

  const introducedEvents = new Set<string>();
  for (const envId of session.openedEnvelopes) {
    const env = archive.byId.envelope.get(envId);
    if (!env) continue;
    env.eventIds.forEach((id) => introducedEvents.add(id));
    if (env.year.slice(0, 4) <= horizon.slice(0, 4) && p?.kind === 'guest') {
      continue; // a guest already knew this unaided
    }
    ledger.introduced.push({
      id: `intro:${env.id}`,
      label: env.title,
      date: env.year,
      kind: 'envelope',
      column: 'introduced',
      note: 'Introduced by you from the future.',
      refId: env.id,
    });
    const reaction = env.reactions.find((r) => r.participant === participantId);
    const status: LedgerStatus = reaction?.status ?? 'unresolved';
    const died = p && diedBefore(p, env.year) ? ` (${p.shortName} died before ${env.year}; reaction reconstructed.)` : '';
    ledger[status].push({
      id: `env:${env.id}`,
      label: env.title,
      date: env.year,
      kind: 'envelope',
      column: status,
      note: (reaction ? reaction.claim.summary : 'No grounded basis to infer a reaction.') + died,
      refId: env.id,
    });
  }

  // Positions taken on propositions in this session.
  const seen = new Set<string>();
  for (const t of session.threads) {
    if (!t.propositionId || t.kind === 'envelope') continue;
    const prop = archive.byId.proposition.get(t.propositionId);
    if (!prop || seen.has(prop.id)) continue;
    const spoken = t.utteranceIds
      .map((id) => session.utterances[id])
      .filter((u) => u && u.kind === 'speech' && u.speaker === participantId && u.stance !== undefined);
    if (!spoken.length) continue;
    seen.add(prop.id);
    const mean = spoken.reduce((s, u) => s + (u.stance ?? 0), 0) / spoken.length;
    const side = sideOf(mean);
    const column: LedgerStatus = side === 'affirm' ? 'accepted' : side === 'deny' ? 'rejected' : 'disputed';
    ledger[column].push({
      id: `prop:${prop.id}`,
      label: prop.text,
      date: HORIZON,
      kind: 'proposition',
      column,
      note: `Stance voiced in session: ${mean > 0 ? '+' : ''}${mean.toFixed(1)}.`,
      refId: prop.id,
    });
  }

  ledger.unknown = archive.events.filter((e) => e.date.slice(0, 7) > horizon && !introducedEvents.has(e.id));
  return ledger;
}
