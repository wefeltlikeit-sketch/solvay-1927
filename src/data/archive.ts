/**
 * The archive: every historical file in data/, loaded once and indexed.
 *
 * Nothing here interprets history. It only collects the JSON, attaches
 * reaction claims from envelopes to the claim index, and builds lookups.
 */
import type {
  Bystander,
  Claim,
  Envelope,
  HistoricalEvent,
  LexiconTerm,
  Participant,
  PositionFile,
  Proposition,
  Quotation,
  Source,
  Topic,
} from '../model/types';

import sourcesJson from '../../data/sources.json';
import quotationsJson from '../../data/quotations.json';
import propositionsJson from '../../data/propositions.json';
import topicsJson from '../../data/topics.json';
import eventsJson from '../../data/events.json';
import lexiconJson from '../../data/lexicon.json';
import bystandersJson from '../../data/bystanders.json';

const participantFiles = import.meta.glob('../../data/participants/*.json', { eager: true, import: 'default' });
const guestFiles = import.meta.glob('../../data/guests/*.json', { eager: true, import: 'default' });
const positionFiles = import.meta.glob('../../data/positions/*.json', { eager: true, import: 'default' });
const envelopeFiles = import.meta.glob('../../data/envelopes/*.json', { eager: true, import: 'default' });

export interface Archive {
  participants: Participant[];
  attendees: Participant[];
  guests: Participant[];
  bystanders: Bystander[];
  sources: Source[];
  quotations: Quotation[];
  propositions: Proposition[];
  topics: Topic[];
  events: HistoricalEvent[];
  envelopes: Envelope[];
  lexicon: LexiconTerm[];
  /** Standing claims (the 1927 positions and guest positions). */
  claims: Claim[];
  /** Reaction claims from envelopes, keyed "<envelope>/<participant>". */
  reactionClaims: Claim[];
  byId: {
    participant: Map<string, Participant>;
    source: Map<string, Source>;
    quote: Map<string, Quotation>;
    proposition: Map<string, Proposition>;
    topic: Map<string, Topic>;
    event: Map<string, HistoricalEvent>;
    envelope: Map<string, Envelope>;
    claim: Map<string, Claim>;
  };
  claimsByParticipant: Map<string, Claim[]>;
  /** Reverse index: source id → claims citing it. */
  claimsBySource: Map<string, Claim[]>;
}

/** The simulation's present. Participants know nothing after this. */
export const HORIZON = '1927-10';
export const CONFERENCE_DATES = '24–29 October 1927';

// Seat order around the table, clockwise from the chair's position.
export const SEAT_ORDER = [
  'lorentz',
  'einstein',
  'planck',
  'curie',
  'compton',
  'debroglie',
  'schrodinger',
  'dirac',
  'pauli',
  'heisenberg',
  'born',
  'bohr',
  'ehrenfest',
];

function values<T>(files: Record<string, unknown>): T[] {
  return Object.keys(files)
    .sort()
    .map((k) => files[k] as T);
}

function index<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]));
}

export function buildArchive(): Archive {
  const attendees = values<Participant>(participantFiles);
  const guests = values<Participant>(guestFiles);
  const participants = [...attendees, ...guests];
  const envelopes = values<Envelope>(envelopeFiles);
  const positions = values<PositionFile>(positionFiles);

  const claims = positions.flatMap((p) =>
    p.claims.map((c) => ({ ...c, participant: c.participant ?? p.participant })),
  );

  const reactionClaims: Claim[] = envelopes.flatMap((env) =>
    env.reactions.map((r) => ({
      ...r.claim,
      participant: r.participant,
      stances: r.claim.stances ?? {},
    })),
  );

  const allClaims = [...claims, ...reactionClaims];
  const claimsByParticipant = new Map<string, Claim[]>();
  for (const c of claims) {
    const list = claimsByParticipant.get(c.participant) ?? [];
    list.push(c);
    claimsByParticipant.set(c.participant, list);
  }
  const claimsBySource = new Map<string, Claim[]>();
  for (const c of allClaims) {
    for (const s of c.sourceIds) {
      const list = claimsBySource.get(s) ?? [];
      list.push(c);
      claimsBySource.set(s, list);
    }
  }

  const sources = sourcesJson as Source[];
  const quotations = quotationsJson as Quotation[];
  const propositions = propositionsJson as Proposition[];
  const topics = topicsJson as Topic[];
  const events = (eventsJson as HistoricalEvent[]).slice().sort((a, b) => a.date.localeCompare(b.date));

  return {
    participants,
    attendees: SEAT_ORDER.map((id) => attendees.find((a) => a.id === id)).filter(Boolean) as Participant[],
    guests,
    bystanders: bystandersJson as Bystander[],
    sources,
    quotations,
    propositions,
    topics,
    events,
    envelopes,
    lexicon: lexiconJson as LexiconTerm[],
    claims,
    reactionClaims,
    byId: {
      participant: index(participants),
      source: index(sources),
      quote: index(quotations),
      proposition: index(propositions),
      topic: index(topics),
      event: index(events),
      envelope: index(envelopes),
      claim: index(allClaims),
    },
    claimsByParticipant,
    claimsBySource,
  };
}

export const archive = buildArchive();

// ─────────────────────────────── helpers ───────────────────────────────

/** Age in whole years at a partial date. */
export function ageAt(born: string, at = '1927-10-24'): number {
  const [by, bm = '01', bd = '01'] = born.split('-');
  const [ay, am = '01', ad = '01'] = at.split('-');
  let age = Number(ay) - Number(by);
  if (Number(am) < Number(bm) || (Number(am) === Number(bm) && Number(ad) < Number(bd))) age -= 1;
  return age;
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** Did this person die before the given year? */
export function diedBefore(p: Participant, year: string): boolean {
  if (!p.died) return false;
  return yearOf(p.died) < yearOf(year);
}

export function isPostHorizon(date: string): boolean {
  return date.slice(0, 7) > HORIZON;
}

export function nameOf(id: string): string {
  if (id === 'chair') return 'The Minutes';
  if (id === 'user') return 'You';
  return archive.byId.participant.get(id)?.shortName ?? id;
}
