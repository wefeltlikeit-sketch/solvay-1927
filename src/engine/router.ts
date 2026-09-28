/**
 * The moderator: decides what to do with whatever the user typed.
 */
import type { Archive } from '../data/archive';
import { HORIZON, nameOf } from '../data/archive';
import type { Session, Utterance } from '../model/types';
import { askParticipant, debateProposition, newThread, presentIds, type Batch } from './debate';
import { findAddressee, findEvidenceRequest, findFutureReferences, findFutureYears, isNegated, matchPropositions } from './match';

export type RouteResult =
  | { kind: 'batch'; batch: Batch }
  | { kind: 'evidence'; utteranceId?: string; participantId?: string };

function chairOnly(title: string, userText: string, text: string, rationale: string[], offer?: Utterance['offer']): Batch {
  const thread = newThread('question', title, { userText });
  const now = Date.now();
  return {
    thread,
    utterances: [
      { id: `${thread.id}:u`, threadId: thread.id, kind: 'user', speaker: 'user', text: userText, rationale: [], ts: now },
      { id: `${thread.id}:c`, threadId: thread.id, kind: 'narration', speaker: 'chair', text, rationale, offer, ts: now },
    ],
  };
}

export function route(archive: Archive, session: Session, text: string, target?: string): RouteResult {
  const trimmed = text.trim();

  // 1. "Why did you make Einstein say that?"
  const ev = findEvidenceRequest(trimmed, archive);
  if (ev) {
    const all = Object.values(session.utterances)
      .filter((u) => u.kind === 'speech' && (!ev.participantId || u.speaker === ev.participantId))
      .sort((a, b) => b.ts - a.ts);
    return { kind: 'evidence', utteranceId: all[0]?.id, participantId: ev.participantId };
  }

  const present = presentIds(archive, session);
  const address = target ? { participantId: target, rest: trimmed } : findAddressee(trimmed, archive, archive.participants.map((p) => p.id));

  // 2. The user speaks of things after 1927 that have not been introduced.
  const refs = findFutureReferences(trimmed, archive, HORIZON).filter(
    (r) => !r.envelope || !session.openedEnvelopes.includes(r.envelope.id),
  );
  // A bare year counts as introduced once any envelope for that year has been opened.
  const years = findFutureYears(trimmed, archive, HORIZON).filter((y) => !y.envelopes.some((e) => session.openedEnvelopes.includes(e.id)));
  const addressingGuest = address && archive.byId.participant.get(address.participantId)?.kind === 'guest';
  if ((refs.length || years.length) && !addressingGuest) {
    const envs = [...new Set([...refs.map((r) => r.envelope?.id), ...years.flatMap((y) => y.envelopes.map((e) => e.id))].filter(Boolean) as string[])];
    const terms = [...refs.map((r) => `‘${r.term.term}’ (${r.term.firstKnown})`), ...years.filter(() => !refs.length).map((y) => `the year ${y.year}`)].join(', ');
    return {
      kind: 'batch',
      batch: chairOnly(
        'Beyond the horizon',
        trimmed,
        `Your words reach past the room's horizon: ${terms}. No one here can know of ${refs.length + years.length > 1 ? 'these' : 'this'} in October 1927. ${
          envs.length ? 'If you wish to introduce it, place the envelope on the table.' : 'The archive holds no envelope for it yet.'
        }`,
        [...refs.map((r) => r.term.note), ...years.map((y) => `A date after the horizon: ${y.year}.${y.envelopes.length ? ` Envelopes for that year: ${y.envelopes.map((e) => e.title).join(', ')}.` : ''}`)],
        { envelopeIds: envs },
      ),
    };
  }

  const matches = matchPropositions(address?.rest ?? trimmed, archive.propositions);

  // 3. Addressed to one person.
  if (address) {
    if (!present.includes(address.participantId)) {
      const p = archive.byId.participant.get(address.participantId);
      return {
        kind: 'batch',
        batch: chairOnly(
          `To ${nameOf(address.participantId)}`,
          trimmed,
          p?.kind === 'guest'
            ? `${p.shortName} is not at the table. ${session.mode === 'historical' ? 'Guests from other eras may join only in Experimental mode, through the empty chair.' : 'Invite them to the empty chair first.'}`
            : `${nameOf(address.participantId)} is not present.`,
          [],
        ),
      };
    }
    return { kind: 'batch', batch: askParticipant(archive, session, address.participantId, address.rest, matches.slice(0, 2).map((m) => m.id)) };
  }

  // 4. A proposition for the room.
  const best = matches[0];
  if (best && best.score >= 1) {
    const prop = archive.byId.proposition.get(best.id)!;
    const note = [
      `Your words were routed to the canonical proposition “${prop.text}” (matched: ${best.hits.join(', ') || 'shared vocabulary'}).`,
      isNegated(trimmed, prop) ? 'You stated it in the negative; the room debates the same question.' : '',
      matches[1] ? `Also close: “${archive.byId.proposition.get(matches[1].id)?.text}”.` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return { kind: 'batch', batch: debateProposition(archive, session, prop, { userText: trimmed, matchNote: note }) };
  }

  // 5. Nothing grounded to say.
  const nearest = (matches.length ? matches.map((m) => m.id) : archive.propositions.filter((p) => p.featured).map((p) => p.id)).slice(0, 3);
  return {
    kind: 'batch',
    batch: chairOnly(
      'Unrouted',
      trimmed,
      'The minutes hold no grounded material on that exact proposition, and the room will not improvise one. These are the nearest questions it can take up:',
      ['Free text is routed to canonical propositions by keyword. New propositions and claims can be added in data/propositions.json and data/positions/.'],
      { propositionIds: nearest },
    ),
  };
}
