/**
 * The seminar engine.
 *
 *   proposition ─▶ chair ─▶ relevance / speaker selection ─▶ opening pair
 *        ─▶ cross-examination loop (documented exchanges first, then
 *           opposition, then questions and evidence) ─▶ recorded silences
 *        ─▶ validation of every line ─▶ (optional) live rendering
 *
 * Speakers never say anything that is not an archived claim. The engine
 * decides *who* speaks, *which* claim they voice, and *to whom*; every one of
 * those decisions is written into the utterance's rationale so that the user
 * can audit it.
 */
import type { Archive } from '../data/archive';
import { HORIZON, nameOf } from '../data/archive';
import type { Claim, Proposition, Session, Thread, Utterance } from '../model/types';
import { createRng, hashString, newId } from './rng';
import { claimWeight, formatStance, PROVENANCE_LABEL } from './weights';
import { contextFor, validateSpeech } from './validator';

export interface Batch {
  thread: Thread;
  utterances: Utterance[];
}

const MAX_TURNS_OPENING = 7;
const MAX_TURNS_PER_SPEAKER = 2;

// ─────────────────────────────── presence ───────────────────────────────

/** Who is in the room: all attendees, plus the guest in the empty chair. */
export function presentIds(archive: Archive, session: Session): string[] {
  const ids = archive.attendees.map((a) => a.id);
  if (session.mode === 'experimental' && session.guest) ids.push(session.guest);
  return ids;
}

function relevantClaims(archive: Archive, ids: string[], propId: string): Claim[] {
  return archive.claims.filter((c) => ids.includes(c.participant) && c.stances[propId] !== undefined);
}

// ─────────────────────────────── utterances ─────────────────────────────

let counter = 0;
function uid(threadId: string): string {
  counter += 1;
  return `${threadId}:${Date.now().toString(36)}${counter.toString(36)}`;
}

function narration(thread: Thread, text: string, rationale: string[] = []): Utterance {
  return { id: uid(thread.id), threadId: thread.id, kind: 'narration', speaker: 'chair', text, rationale, ts: Date.now() };
}

function pickVoice(claim: Claim, rng: () => number, usedBefore: number): string {
  const n = claim.voice.length;
  return claim.voice[(Math.floor(rng() * n) + usedBefore) % n];
}

function eligibleQuote(archive: Archive, claim: Claim, shown: Set<string>): string | undefined {
  return (claim.quoteIds ?? []).find((qid) => {
    const q = archive.byId.quote.get(qid);
    return q && !q.laterTestimony && q.date.slice(0, 7) <= HORIZON && !shown.has(qid);
  });
}

export function speech(
  archive: Archive,
  session: Session,
  thread: Thread,
  claim: Claim,
  opts: {
    rng: () => number;
    addressedTo?: string;
    respondsTo?: Utterance;
    rationale: string[];
    stance?: number;
    shownQuotes?: Set<string>;
    status?: Utterance['status'];
    envelopeId?: string;
  },
): Utterance {
  const priorUses = Object.values(session.utterances).filter((u) => u.claimId === claim.id).length;
  const text = pickVoice(claim, opts.rng, priorUses);
  const quoteId = opts.shownQuotes ? eligibleQuote(archive, claim, opts.shownQuotes) : undefined;
  if (quoteId) opts.shownQuotes!.add(quoteId);
  const issues = validateSpeech(text, contextFor(archive, session, claim.participant));
  return {
    id: uid(thread.id),
    threadId: thread.id,
    kind: 'speech',
    speaker: claim.participant,
    move: claim.move ?? 'assert',
    addressedTo: opts.addressedTo,
    claimId: claim.id,
    respondsToUtterance: opts.respondsTo?.id,
    text,
    quoteId,
    provenance: claim.provenance,
    confidence: claim.confidence,
    sourceIds: claim.sourceIds,
    rationale: [
      ...opts.rationale,
      `Voices the archived claim “${claim.label}” — ${PROVENANCE_LABEL[claim.provenance].toLowerCase()}, ${claim.confidence} confidence.`,
    ],
    stance: opts.stance,
    status: opts.status,
    envelopeId: opts.envelopeId,
    render: { mode: 'archival', outcome: 'archival', issues },
    ts: Date.now(),
  };
}

// ─────────────────────────────── scoring ────────────────────────────────

interface Candidate {
  claim: Claim;
  score: number;
  reasons: string[];
  addressedTo?: string;
  respondsTo?: Utterance;
}

function scoreResponse(
  archive: Archive,
  session: Session,
  thread: Thread,
  history: Utterance[],
  claim: Claim,
  propId: string | undefined,
  rng: () => number,
): Candidate | null {
  const speeches = history.filter((u) => u.kind === 'speech');
  const last = speeches[speeches.length - 1];
  if (!last || claim.participant === last.speaker) return null;
  if (thread.usedClaims.includes(claim.id)) return null;
  const turns = speeches.filter((u) => u.speaker === claim.participant).length;
  if (turns >= MAX_TURNS_PER_SPEAKER) return null;

  const reasons: string[] = [];
  let score = claimWeight(claim);
  let respondsTo: Utterance | undefined;
  let addressedTo: string | undefined;

  const direct = claim.respondsTo?.includes(last.claimId ?? '');
  const earlier = !direct && speeches.find((u) => u.claimId && claim.respondsTo?.includes(u.claimId));
  const stance = propId ? claim.stances[propId] : undefined;

  if (!direct && !earlier && stance === undefined) return null;

  if (direct) {
    score += 5;
    respondsTo = last;
    addressedTo = last.speaker;
    const lastClaim = archive.byId.claim.get(last.claimId!);
    reasons.push(
      claim.exchangeNote
        ? `Documented exchange — answers ${nameOf(last.speaker)}'s “${lastClaim?.label}”. ${claim.exchangeNote}`
        : `The archive links this claim directly to ${nameOf(last.speaker)}'s “${lastClaim?.label}”.`,
    );
  } else if (earlier) {
    score += 2.5;
    respondsTo = earlier;
    addressedTo = earlier.speaker;
    reasons.push(`Returns to ${nameOf(earlier.speaker)}'s earlier point, which this claim answers in the archive.`);
  }

  if (propId && stance !== undefined && last.stance !== undefined) {
    if (stance * last.stance < 0) {
      score += 0.75 * Math.abs(stance - last.stance);
      reasons.push(`Holds the opposite stance to ${nameOf(last.speaker)} (${formatStance(stance)} against ${formatStance(last.stance)}).`);
      if (!addressedTo) {
        addressedTo = last.speaker;
        respondsTo = last;
      }
    } else if (Math.abs(stance) > 0.5 && Math.abs(last.stance) > 0.5) {
      score += 0.2;
      reasons.push(`Adds support from the same side (${formatStance(stance)}).`);
    }
  }

  if (turns === 0) {
    score += 0.8;
    reasons.push('Has not yet spoken in this discussion.');
  }
  const recent = speeches.slice(-2).map((u) => u.speaker);
  if (recent.includes(claim.participant)) score -= 1.5;
  if ((claim.move === 'question' || claim.move === 'evidence') && speeches.length >= 2) {
    score += 0.4;
    reasons.push(claim.move === 'question' ? 'A question changes the direction of the discussion.' : 'Brings experimental evidence to the table.');
  }
  if (claim.provenance === 'speculative') score -= session.mode === 'historical' ? 1.2 : 0.4;
  score += rng() * 0.4;
  return { claim, score, reasons, respondsTo, addressedTo };
}

function nextTurn(
  archive: Archive,
  session: Session,
  thread: Thread,
  history: Utterance[],
  propId: string | undefined,
  rng: () => number,
  shownQuotes: Set<string>,
): Utterance | null {
  const ids = presentIds(archive, session);
  const pool = archive.claims.filter((c) => ids.includes(c.participant));
  const scored = pool
    .map((c) => scoreResponse(archive, session, thread, history, c, propId, rng))
    .filter((c): c is Candidate => !!c && c.score > 0.9)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;
  thread.usedClaims.push(best.claim.id);
  return speech(archive, session, thread, best.claim, {
    rng,
    addressedTo: best.addressedTo,
    respondsTo: best.respondsTo,
    rationale: best.reasons,
    stance: propId ? best.claim.stances[propId] : undefined,
    shownQuotes,
  });
}

function quotesShown(history: Utterance[]): Set<string> {
  return new Set(history.map((u) => u.quoteId).filter(Boolean) as string[]);
}

// ──────────────────────────────── threads ───────────────────────────────

export function newThread(kind: Thread['kind'], title: string, extra: Partial<Thread> = {}): Thread {
  const id = newId('t');
  return { id, kind, title, utteranceIds: [], createdAt: Date.now(), usedClaims: [], seed: hashString(id), ...extra };
}

/** Put a canonical proposition to the room. */
export function debateProposition(
  archive: Archive,
  session: Session,
  prop: Proposition,
  opts: { userText?: string; matchNote?: string } = {},
): Batch {
  const thread = newThread('proposition', prop.question, { propositionId: prop.id, userText: opts.userText });
  const rng = createRng(thread.seed);
  const out: Utterance[] = [];

  if (opts.userText) {
    out.push({ id: uid(thread.id), threadId: thread.id, kind: 'user', speaker: 'user', text: opts.userText, rationale: [], ts: Date.now() });
  }
  out.push(
    narration(thread, `The chair puts the question to the room: ${prop.question}`, [
      opts.matchNote ?? `Canonical proposition “${prop.text}”.`,
      `Context: ${prop.context}`,
    ]),
  );

  const ids = presentIds(archive, session);
  const relevant = relevantClaims(archive, ids, prop.id);
  if (relevant.length === 0) {
    out.push(
      silenceNote(archive, thread, ids, prop.id, 'No one present has a grounded position on this question. The minutes record silence rather than invention.'),
    );
    return { thread, utterances: out };
  }

  // Opening pair: the strongest grounded statement, then the strongest reply from the other side.
  const openingScore = (c: Claim) =>
    Math.abs(c.stances[prop.id]) * claimWeight(c) + (c.opening ? 0.6 : 0) - (c.provenance === 'speculative' ? 1 : 0) + rng() * 0.35;
  const ranked = relevant.slice().sort((a, b) => openingScore(b) - openingScore(a));
  const first = ranked[0];
  const firstStance = first.stances[prop.id];
  const second =
    ranked.find((c) => c.participant !== first.participant && c.stances[prop.id] * firstStance < 0) ??
    ranked.find((c) => c.participant !== first.participant);

  const shownQuotes = quotesShown(out);
  thread.usedClaims.push(first.id);
  out.push(
    speech(archive, session, thread, first, {
      rng,
      stance: firstStance,
      shownQuotes,
      rationale: [
        `Opens the discussion: the strongest grounded position on the question (${formatStance(firstStance)}).`,
        first.opening ? 'Marked in the archive as a suitable opening statement.' : '',
      ].filter(Boolean),
    }),
  );
  if (second) {
    thread.usedClaims.push(second.id);
    const opp = second.stances[prop.id] * firstStance < 0;
    const answersDirectly = second.respondsTo?.includes(first.id);
    out.push(
      speech(archive, session, thread, second, {
        rng,
        stance: second.stances[prop.id],
        addressedTo: first.participant,
        respondsTo: out[out.length - 1],
        shownQuotes,
        rationale: [
          opp
            ? `Strongest grounded position on the other side (${formatStance(second.stances[prop.id])}).`
            : 'No grounded opposing position is present; the next strongest voice replies.',
          answersDirectly ? `The archive records this as a reply to ${nameOf(first.participant)}.` : '',
        ].filter(Boolean),
      }),
    );
  }

  for (let i = 0; i < MAX_TURNS_OPENING - 2; i++) {
    const u = nextTurn(archive, session, thread, out, prop.id, rng, shownQuotes);
    if (!u) break;
    out.push(u);
  }

  out.push(silenceNote(archive, thread, ids, prop.id));
  return { thread, utterances: out.filter(Boolean) as Utterance[] };
}

/** Continue an existing proposition thread by a few turns. */
export function continueThread(archive: Archive, session: Session, thread: Thread, turns = 3): Utterance[] {
  const history = thread.utteranceIds.map((id) => session.utterances[id]).filter(Boolean);
  const rng = createRng(thread.seed + history.length * 7919);
  const shownQuotes = quotesShown(history);
  const out: Utterance[] = [];
  const working = thread; // mutated: usedClaims
  for (let i = 0; i < turns; i++) {
    const u = nextTurn(archive, session, working, [...history, ...out], thread.propositionId, rng, shownQuotes);
    if (!u) break;
    out.push(u);
  }
  if (out.length === 0) {
    out.push(
      narration(thread, 'The room has exhausted its grounded material on this question. Anything further would be invention, and the minutes decline to invent.', [
        'Every remaining claim in the archive has already been voiced, or its speaker has already had two turns.',
        'Invite a silent participant, open an envelope from the future, or add sources to data/ to deepen the discussion.',
      ]),
    );
  }
  return out;
}

/** Invite a specific participant into the current discussion. */
export function inviteSpeaker(archive: Archive, session: Session, thread: Thread, participantId: string): Utterance {
  const history = thread.utteranceIds.map((id) => session.utterances[id]).filter(Boolean);
  const speeches = history.filter((u) => u.kind === 'speech');
  const last = speeches[speeches.length - 1];
  const rng = createRng(thread.seed + hashString(participantId) + history.length);
  const propId = thread.propositionId;
  const mine = archive.claims.filter((c) => c.participant === participantId && !thread.usedClaims.includes(c.id));
  const scored = mine
    .map((c) => {
      let s = claimWeight(c);
      if (propId && c.stances[propId] !== undefined) s += 2 + Math.abs(c.stances[propId]);
      if (last?.claimId && c.respondsTo?.includes(last.claimId)) s += 3;
      if (speeches.some((u) => u.claimId && c.respondsTo?.includes(u.claimId))) s += 1;
      return { c, s };
    })
    .filter(({ c, s }) => s > 1.5 && (!propId || c.stances[propId] !== undefined || c.respondsTo?.some((r) => thread.usedClaims.includes(r))))
    .sort((a, b) => b.s - a.s);

  const pick = scored[0]?.c;
  if (!pick) return silence(archive, thread, participantId, propId);
  thread.usedClaims.push(pick.id);
  const respondsTo = speeches.find((u) => u.claimId && pick.respondsTo?.includes(u.claimId)) ?? last;
  return speech(archive, session, thread, pick, {
    rng,
    stance: propId ? pick.stances[propId] : undefined,
    addressedTo: respondsTo?.speaker !== participantId ? respondsTo?.speaker : undefined,
    respondsTo,
    shownQuotes: quotesShown(history),
    rationale: [`You invited ${nameOf(participantId)} to speak.`, 'The engine chose the archived claim most relevant to the discussion so far.'],
  });
}

/** Address a participant directly with a question. */
export function askParticipant(
  archive: Archive,
  session: Session,
  participantId: string,
  text: string,
  propIds: string[],
): Batch {
  const who = archive.byId.participant.get(participantId)!;
  const thread = newThread('question', `To ${who.shortName}: ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`, {
    target: participantId,
    userText: text,
    propositionId: propIds[0],
  });
  const rng = createRng(thread.seed);
  const out: Utterance[] = [
    { id: uid(thread.id), threadId: thread.id, kind: 'user', speaker: 'user', addressedTo: participantId, text, rationale: [], ts: Date.now() },
  ];
  const mine = archive.claims.filter((c) => c.participant === participantId);
  const words = text.toLowerCase();
  const ranked = mine
    .map((c) => {
      let s = 0;
      propIds.forEach((pid, i) => {
        if (c.stances[pid] !== undefined) s += (3 - i) * (0.6 + Math.abs(c.stances[pid]));
      });
      const props = propIds.map((p) => archive.byId.proposition.get(p)).filter(Boolean) as Proposition[];
      if (props.some((p) => p.topics.some((t) => c.topics.includes(t)))) s += 1;
      if (words.includes(c.label.toLowerCase().split(' ')[0])) s += 0.3;
      return { c, s: s * claimWeight(c) };
    })
    .filter((x) => x.s > 0.6)
    .sort((a, b) => b.s - a.s);

  if (!ranked[0]) {
    out.push(silence(archive, thread, participantId, propIds[0]));
    return { thread, utterances: out };
  }
  const shownQuotes = new Set<string>();
  const c = ranked[0].c;
  thread.usedClaims.push(c.id);
  out.push(
    speech(archive, session, thread, c, {
      rng,
      addressedTo: 'user',
      stance: propIds[0] ? c.stances[propIds[0]] : undefined,
      shownQuotes,
      rationale: [
        `Your question was routed to: ${propIds.map((p) => archive.byId.proposition.get(p)?.short).join(', ') || 'no canonical proposition'}.`,
        `Best-matching archived claim for ${who.shortName} on that question.`,
      ],
    }),
  );
  // Someone in the room may take it up.
  const reply = nextTurn(archive, session, thread, out, propIds[0], rng, shownQuotes);
  if (reply && (reply.rationale.some((r) => r.startsWith('Documented') || r.startsWith('The archive links')) || rng() < 0.6)) {
    reply.rationale.unshift('Another participant takes up the answer.');
    out.push(reply);
  }
  return { thread, utterances: out };
}

// ──────────────────────────────── silence ───────────────────────────────

export function silenceText(archive: Archive, participantId: string, propId?: string): string {
  const p = archive.byId.participant.get(participantId);
  const prop = propId ? archive.byId.proposition.get(propId) : undefined;
  const q = prop ? `on this specific question (${prop.short.toLowerCase()})` : 'on this specific question';
  const when = p?.kind === 'guest' ? '' : ' in October 1927';
  return `We do not have enough evidence to confidently infer ${p?.shortName ?? participantId}'s position ${q}${when}.`;
}

function silence(archive: Archive, thread: Thread, participantId: string, propId?: string): Utterance {
  const p = archive.byId.participant.get(participantId);
  const notes = (p?.silences ?? []).filter((s) => s.proposition === propId || s.proposition === '*').map((s) => s.note);
  const topics = [...new Set((archive.claimsByParticipant.get(participantId) ?? []).flatMap((c) => c.topics))]
    .map((t) => archive.byId.topic.get(t)?.label)
    .filter(Boolean);
  return {
    id: uid(thread.id),
    threadId: thread.id,
    kind: 'silence',
    speaker: participantId,
    text: silenceText(archive, participantId, propId),
    rationale: [
      ...notes,
      topics.length ? `The archive does ground ${p?.shortName}'s views on: ${topics.join(', ')}.` : 'The archive holds no grounded claims for this person yet.',
      'Historically defensible silence is preferred to invented certainty.',
    ],
    ts: Date.now(),
  };
}

function silenceNote(archive: Archive, thread: Thread, ids: string[], propId: string, lead?: string): Utterance {
  const silent = ids.filter((id) => !archive.claims.some((c) => c.participant === id && c.stances[propId] !== undefined));
  const names = silent.map(nameOf);
  const detail = silent.map((id) => {
    const p = archive.byId.participant.get(id);
    const note = p?.silences?.find((s) => s.proposition === propId || s.proposition === '*')?.note;
    return `${nameOf(id)} — ${note ?? 'no archived claim bears on this question.'}`;
  });
  return {
    id: uid(thread.id),
    threadId: thread.id,
    kind: 'narration',
    speaker: 'chair',
    text: lead ?? (names.length ? `Recorded as silent on this question, for want of evidence: ${names.join(', ')}.` : 'Every participant present has a grounded position on this question.'),
    rationale: detail,
    ts: Date.now(),
  };
}

export function silentOn(archive: Archive, session: Session, propId: string): string[] {
  return presentIds(archive, session).filter(
    (id) => !archive.claims.some((c) => c.participant === id && c.stances[propId] !== undefined),
  );
}
