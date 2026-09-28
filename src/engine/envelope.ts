/**
 * The envelope from the future.
 *
 * Opening an envelope introduces a later result into the room. Each attendee
 * reacts from their 1927 framework (reaction claims in data/envelopes), in an
 * order that lets responses follow the remarks they answer. Where the real
 * person lived to react, the historical record is attached — clearly separated
 * from the simulated 1927 reaction.
 */
import type { Archive } from '../data/archive';
import { diedBefore, nameOf } from '../data/archive';
import type { Envelope, Reaction, Session, Utterance } from '../model/types';
import { createRng } from './rng';
import { newThread, presentIds, speech, type Batch } from './debate';
import { claimWeight } from './weights';

const STATUS_WORD: Record<Reaction['status'], string> = {
  accepted: 'accepts',
  disputed: 'disputes',
  rejected: 'rejects',
  unresolved: 'leaves unresolved',
};

/** Roots first (by weight), each followed immediately by the reactions that answer it. */
export function orderReactions(reactions: Reaction[]): Reaction[] {
  const ids = new Set(reactions.map((r) => r.claim.id));
  const isRoot = (r: Reaction) => !(r.claim.respondsTo ?? []).some((id) => ids.has(id));
  const weight = (r: Reaction) => claimWeight({ ...r.claim, participant: r.participant, stances: {} }) + (r.historical ? 0.3 : 0);
  const roots = reactions.filter(isRoot).sort((a, b) => weight(b) - weight(a));
  const out: Reaction[] = [];
  const placed = new Set<string>();
  const place = (r: Reaction) => {
    if (placed.has(r.claim.id)) return;
    placed.add(r.claim.id);
    out.push(r);
    reactions
      .filter((x) => (x.claim.respondsTo ?? []).includes(r.claim.id))
      .sort((a, b) => weight(b) - weight(a))
      .forEach(place);
  };
  roots.forEach(place);
  reactions.forEach(place);
  return out;
}

export function openEnvelope(archive: Archive, session: Session, env: Envelope): Batch {
  const thread = newThread('envelope', `Envelope: ${env.title} (${env.year})`, { envelopeId: env.id });
  const rng = createRng(thread.seed);
  const out: Utterance[] = [];
  const at = Date.now();

  out.push({
    id: `${thread.id}:envelope`,
    threadId: thread.id,
    kind: 'envelope',
    speaker: 'user',
    envelopeId: env.id,
    text: env.reading,
    sourceIds: env.sourceIds,
    rationale: ['Introduced by you. The participants did not know this; it is now recorded in each ledger as INTRODUCED BY USER.'],
    ts: at,
  });

  const missing = (env.prerequisites ?? []).filter((p) => !session.openedEnvelopes.includes(p));
  const chairLines = [`The chair breaks the seal. The document is dated ${env.year}, and it is read aloud to the room.`];
  if (missing.length) {
    chairLines.push(
      `It presupposes an argument the room has not yet seen: ${missing.map((m) => archive.byId.envelope.get(m)?.title).join(', ')}.`,
    );
  }
  out.push({
    id: `${thread.id}:chair`,
    threadId: thread.id,
    kind: 'narration',
    speaker: 'chair',
    text: chairLines.join(' '),
    rationale: ['Opening an envelope unlocks its vocabulary for everyone present, and only that vocabulary.'],
    ts: at,
  });

  // After this batch is applied the envelope counts as opened; validate against that.
  const sessionAfter: Session = { ...session, openedEnvelopes: [...new Set([...session.openedEnvelopes, env.id])] };
  const present = presentIds(archive, session);
  const reactions = orderReactions(env.reactions.filter((r) => present.includes(r.participant)));
  const byClaim = new Map<string, Utterance>();
  const shownQuotes = new Set<string>();

  for (const r of reactions) {
    const claim = archive.byId.claim.get(r.claim.id)!;
    const p = archive.byId.participant.get(r.participant)!;
    const answered = (claim.respondsTo ?? []).map((id) => byClaim.get(id)).find(Boolean);
    const rationale: string[] = [`${p.shortName} ${STATUS_WORD[r.status]} the envelope (ledger status: ${r.status.toUpperCase()}).`];
    if (diedBefore(p, env.year)) {
      rationale.push(`${p.shortName} died in ${p.died!.slice(0, 4)} and never saw this. The reaction is reconstructed from the 1927 framework.`);
    } else if (!r.historical) {
      rationale.push(`${p.shortName} lived to ${p.died?.slice(0, 4) ?? 'see it'}, but the archive holds no documented reaction; this is reconstructed from the 1927 framework.`);
    }
    if (r.historical) rationale.push(`Historical record: ${r.historical.note}`);
    if (answered) rationale.push(`Answers ${nameOf(answered.speaker)}'s reaction.`);
    const u = speech(archive, sessionAfter, thread, claim, {
      rng,
      addressedTo: answered?.speaker,
      respondsTo: answered,
      rationale,
      status: r.status,
      envelopeId: env.id,
      shownQuotes, // later testimony is filtered out; it stays in the evidence panel
    });
    byClaim.set(claim.id, u);
    thread.usedClaims.push(claim.id);
    out.push(u);
  }

  const silent = present.filter(
    (id) => !env.reactions.some((r) => r.participant === id) && archive.byId.participant.get(id)?.kind === 'attendee',
  );
  if (silent.length) {
    out.push({
      id: `${thread.id}:silence`,
      threadId: thread.id,
      kind: 'narration',
      speaker: 'chair',
      text: `No grounded basis to infer a reaction from: ${silent.map(nameOf).join(', ')}. Their ledgers record the envelope as introduced and unresolved.`,
      rationale: silent.map((id) => `${nameOf(id)} — no reaction in the archive for this envelope.`),
      ts: at,
    });
  }
  return { thread, utterances: out };
}
