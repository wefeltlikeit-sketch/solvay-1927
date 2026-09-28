/**
 * The information model.
 *
 * Everything historical lives in data/*.json and is typed here. Application
 * code never contains beliefs, quotations or citations — only the machinery
 * that selects, orders, validates and displays them.
 *
 * The central atom is the Claim: one documented or inferred position held by
 * one person, with explicit provenance, confidence, sources and a stance on
 * zero or more canonical propositions. Speech is always generated *from*
 * claims, never the other way around.
 */

/** How we know what a simulated participant says. Ordered strongest → weakest. */
export type Provenance = 'quotation' | 'documented' | 'inference' | 'speculative';
export type Confidence = 'high' | 'medium' | 'low';

/** What a turn of speech does in the seminar. */
export type Move = 'assert' | 'challenge' | 'question' | 'evidence' | 'concede' | 'redirect' | 'clarify';

/** ISO-ish partial date: "1927", "1927-10" or "1927-10-24". Compared lexically. */
export type PartialDate = string;

// ───────────────────────────────── Sources ─────────────────────────────────

export type SourceType =
  | 'proceedings'
  | 'paper'
  | 'letter'
  | 'memoir'
  | 'biography'
  | 'scholarship'
  | 'lecture'
  | 'book'
  | 'interview'
  | 'archive';

/**
 * primary     — written by the participant at the time
 * recollection — written or told by a participant, decades later
 * secondary   — historians and biographers
 */
export type Reliability = 'primary' | 'recollection' | 'secondary';

export interface Source {
  id: string;
  type: SourceType;
  title: string;
  author: string;
  date: PartialDate;
  citation: string;
  reliability: Reliability;
  participants: string[];
  topics: string[];
  /** Why this source matters and how far to trust it. */
  context?: string;
  url?: string;
}

/**
 * How sure we are of the exact words.
 *  original-language      — we quote the original language verbatim
 *  standard-translation   — a published, widely used English translation
 *  translation-varies     — the sense is secure; English wordings differ between editions
 *  reported-recollection  — someone else remembered it, often decades later
 *  attributed             — commonly attributed; primary wording not confirmed
 */
export type Wording =
  | 'original-language'
  | 'standard-translation'
  | 'translation-varies'
  | 'reported-recollection'
  | 'attributed';

export interface Quotation {
  id: string;
  participant: string;
  sourceId: string;
  /** When the words were written or spoken (not when published). */
  date: PartialDate;
  text: string;
  wording: Wording;
  confidence: Confidence;
  topics: string[];
  context: string;
  /** Who reported it, if not the speaker. */
  reportedBy?: string;
  /** Present when the words post-date the simulation horizon. */
  laterTestimony?: boolean;
}

// ───────────────────────────────── Claims ──────────────────────────────────

export interface Claim {
  id: string;
  participant: string;
  /** Short label for the argument map (≤ 6 words). */
  label: string;
  topics: string[];
  /** Stance on canonical propositions, −1 (deny) … +1 (affirm). */
  stances: Record<string, number>;
  move?: Move;
  provenance: Provenance;
  confidence: Confidence;
  /** Third-person statement of the position, as a historian would write it. */
  summary: string;
  /**
   * First-person renderings used in the room. These are paraphrase written for
   * the simulation — never presented as quotation. Keep them within what the
   * summary and sources support.
   */
  voice: string[];
  /** Why the participant held this — the argument, not the conclusion. */
  reasoning: string;
  /** Experiments and results available at the time. */
  evidence?: string[];
  /** Objections that were raised or were available at the time. */
  objections?: string[];
  /** Claim ids this directly answers (documented or inferred exchanges). */
  respondsTo?: string[];
  /** Describes the exchange if respondsTo is historically documented. */
  exchangeNote?: string;
  quoteIds?: string[];
  sourceIds: string[];
  /** The date at which the participant is known/inferred to hold this. */
  asOf: PartialDate;
  /** What later science did to this position (shown to the user only). */
  later?: string;
  /** Suitable as an opening statement on its propositions. */
  opening?: boolean;
}

export interface PositionFile {
  participant: string;
  claims: Claim[];
}

// ─────────────────────────────── Participants ──────────────────────────────

export interface Relationship {
  with: string;
  nature: string;
  note: string;
  sourceIds?: string[];
}

export interface Silence {
  /** Proposition id, or "*" for a general note. */
  proposition: string;
  note: string;
}

export interface Participant {
  id: string;
  name: string;
  shortName: string;
  initials: string;
  kind: 'attendee' | 'guest';
  born: PartialDate;
  died?: PartialDate;
  nationality: string;
  affiliation: string;
  role: string;
  bio: string;
  contributions: { year: string; title: string; note: string }[];
  beliefs: string;
  philosophy: string;
  style: {
    method: string;
    manner: string;
    /** What the simulation must not reduce this person to. */
    avoid: string[];
  };
  relationships: Relationship[];
  disagreements: { with: string; topic: string; note: string; sourceIds?: string[] }[];
  silences?: Silence[];
  /** Post-horizon events of particular personal significance. */
  horizonNotes?: { eventId: string; note: string }[];
  sourceIds: string[];
  /** Guests only. */
  guest?: {
    era: string;
    whyInvited: string;
    caution: string;
    composite?: boolean;
    /** The guest's own knowledge horizon. */
    horizon: PartialDate;
  };
}

/** People in the room whose dossiers are not yet grounded. */
export interface Bystander {
  id: string;
  name: string;
  affiliation: string;
  note: string;
}

// ─────────────────────────────── Propositions ──────────────────────────────

export interface Proposition {
  id: string;
  /** The proposition as a declarative sentence. */
  text: string;
  /** The same as a question — the root of the argument map. */
  question: string;
  short: string;
  topics: string[];
  /** Phrases that route free text to this proposition. */
  keywords: string[];
  affirmLabel: string;
  denyLabel: string;
  context: string;
  later: string;
  relatedEvents: string[];
  followUps: string[];
  /** Offered on the first-run screen. */
  featured?: boolean;
}

export interface Topic {
  id: string;
  label: string;
  description: string;
}

// ──────────────────────────────── Timeline ─────────────────────────────────

export type EventCategory = 'theory' | 'experiment' | 'interpretation' | 'conference' | 'technology' | 'person';

export interface HistoricalEvent {
  id: string;
  date: PartialDate;
  title: string;
  category: EventCategory;
  summary: string;
  /** How this event changes the intellectual landscape. */
  landscape: string;
  people: string[];
  /** Simulation participants most affected. */
  affects: string[];
  sourceIds: string[];
  envelopeId?: string;
  /** Who in the room knew of it by October 1927 (defaults to everyone). */
  knownNote?: string;
}

// ──────────────────────────────── Envelopes ────────────────────────────────

export type LedgerStatus = 'accepted' | 'disputed' | 'rejected' | 'unresolved';

export interface Reaction {
  participant: string;
  status: LedgerStatus;
  claim: Omit<Claim, 'participant' | 'stances'> & { stances?: Record<string, number> };
  /** What the real person actually did or said, if they lived to react. */
  historical?: { note: string; sourceIds: string[] };
}

export interface Envelope {
  id: string;
  year: string;
  title: string;
  /** One line on the wax seal. */
  seal: string;
  category: 'result' | 'experiment' | 'theory' | 'interpretation' | 'technology';
  /** What the user places on the table, written for a 1927 audience. */
  reading: string;
  /** Deeper technical content, for the user. */
  detail: string;
  sourceIds: string[];
  eventIds: string[];
  /** Envelopes that should normally be opened first. */
  prerequisites?: string[];
  /** Lexicon terms this envelope makes speakable. */
  unlocks: string[];
  reactions: Reaction[];
  next?: string[];
  firstEnvelope?: boolean;
}

// ─────────────────────────────── Anachronisms ──────────────────────────────

export interface LexiconTerm {
  term: string;
  /** Case-insensitive regex source. */
  pattern: string;
  firstKnown: PartialDate;
  note: string;
}

// ─────────────────────────────── Simulation ────────────────────────────────

export type Mode = 'historical' | 'experimental';
export type Voicing = 'archival' | 'live';

export interface ValidationIssue {
  kind: 'anachronism' | 'unverified-quotation' | 'ungrounded' | 'length' | 'provider';
  severity: 'error' | 'warning' | 'info';
  message: string;
  term?: string;
}

export interface RenderInfo {
  mode: Voicing;
  model?: string;
  issues: ValidationIssue[];
  /** 'accepted' | 'fell-back' (live output rejected, archival text used) */
  outcome: 'archival' | 'accepted' | 'fell-back';
  /** The archival text that the live rendering was produced from. */
  archivalText?: string;
}

export type UtteranceKind = 'speech' | 'narration' | 'user' | 'abstention' | 'envelope' | 'silence';

export interface Utterance {
  id: string;
  threadId: string;
  kind: UtteranceKind;
  /** Participant id, 'chair' (the minutes) or 'user'. */
  speaker: string;
  move?: Move;
  addressedTo?: string;
  claimId?: string;
  /** Reaction claims are namespaced "<envelopeId>/<participantId>". */
  respondsToUtterance?: string;
  text: string;
  quoteId?: string;
  provenance?: Provenance;
  confidence?: Confidence;
  sourceIds?: string[];
  /** Why the engine chose this speaker and this claim. */
  rationale: string[];
  stance?: number;
  status?: LedgerStatus;
  envelopeId?: string;
  render?: RenderInfo;
  /** Actions the chair offers the user (open an envelope, take up a proposition). */
  offer?: { envelopeIds?: string[]; propositionIds?: string[] };
  ts: number;
}

export interface Thread {
  id: string;
  kind: 'proposition' | 'envelope' | 'question';
  propositionId?: string;
  envelopeId?: string;
  /** What the user actually typed, if anything. */
  userText?: string;
  target?: string;
  title: string;
  utteranceIds: string[];
  createdAt: number;
  /** Claims already spoken in this thread. */
  usedClaims: string[];
  seed: number;
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  mode: Mode;
  voicing: Voicing;
  guest?: string;
  threads: Thread[];
  utterances: Record<string, Utterance>;
  openedEnvelopes: string[];
  activeThreadId?: string;
}
