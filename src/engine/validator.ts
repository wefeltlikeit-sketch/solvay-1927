/**
 * Historical validation.
 *
 * Every line of speech — archival or AI-rendered — passes through here before
 * it is shown. The validator enforces the knowledge boundary (no post-1927
 * vocabulary unless the user has introduced it), refuses unverified quotation
 * marks, and checks that live renderings stay tied to the claims they were given.
 */
import type { Archive } from '../data/archive';
import { HORIZON } from '../data/archive';
import type { LexiconTerm, Mode, Participant, Session, ValidationIssue } from '../model/types';
import { normalise } from './match';

/** Terms made speakable by the envelopes opened in this session. */
export function unlockedTerms(archive: Archive, openedEnvelopes: string[]): Set<string> {
  const out = new Set<string>();
  for (const id of openedEnvelopes) {
    const env = archive.byId.envelope.get(id);
    if (!env) continue;
    for (const term of archive.lexicon) {
      const re = new RegExp(term.pattern, 'i');
      if (env.unlocks.some((u) => re.test(u)) || re.test(env.title)) out.add(term.term);
    }
  }
  return out;
}

/** The date up to which a speaker may know things unaided. */
export function horizonFor(p: Participant | undefined): string {
  return p?.guest?.horizon ?? HORIZON;
}

export interface ValidationContext {
  archive: Archive;
  speakerId: string;
  mode: Mode;
  openedEnvelopes: string[];
  /** Claim ids the text is meant to express (live renderings). */
  allowedClaims?: string[];
  usedClaims?: string[];
}

export function contextFor(archive: Archive, session: Session, speakerId: string): ValidationContext {
  return { archive, speakerId, mode: session.mode, openedEnvelopes: session.openedEnvelopes };
}

export function findAnachronisms(
  text: string,
  lexicon: LexiconTerm[],
  horizon: string,
  unlocked: Set<string>,
): LexiconTerm[] {
  return lexicon.filter(
    (t) => t.firstKnown.slice(0, 7) > horizon && !unlocked.has(t.term) && new RegExp(t.pattern, 'i').test(text),
  );
}

const QUOTED = /[“"]([^”"]{12,})[”"]/g;

export function validateSpeech(text: string, ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const speaker = ctx.archive.byId.participant.get(ctx.speakerId);
  const isGuest = speaker?.kind === 'guest';
  const horizon = horizonFor(speaker);
  const unlocked = unlockedTerms(ctx.archive, ctx.openedEnvelopes);

  for (const term of findAnachronisms(text, ctx.archive.lexicon, horizon, unlocked)) {
    issues.push({
      kind: 'anachronism',
      severity: ctx.mode === 'historical' && !isGuest ? 'error' : 'warning',
      term: term.term,
      message: `'${term.term}' is not available to ${speaker?.shortName ?? 'this speaker'} (first known ${term.firstKnown}; horizon ${horizon}). ${term.note}`,
    });
  }

  const quotes = [...text.matchAll(QUOTED)].map((m) => m[1]);
  for (const q of quotes) {
    const nq = normalise(q).replace(/\s+/g, ' ').trim();
    const verified = ctx.archive.quotations.some((qq) => normalise(qq.text).includes(nq.slice(0, 60)));
    if (!verified) {
      issues.push({
        kind: 'unverified-quotation',
        severity: 'error',
        message: `Quotation marks around words not in the quotation archive: “${q.slice(0, 80)}${q.length > 80 ? '…' : ''}”. Paraphrase must not be presented as quotation.`,
      });
    }
  }

  if (ctx.allowedClaims && ctx.usedClaims) {
    const stray = ctx.usedClaims.filter((c) => !ctx.allowedClaims!.includes(c));
    if (ctx.usedClaims.length === 0 || stray.length > 0) {
      issues.push({
        kind: 'ungrounded',
        severity: 'error',
        message:
          ctx.usedClaims.length === 0
            ? 'The rendering did not declare which archived claim it expresses.'
            : `The rendering cited claims it was not given: ${stray.join(', ')}.`,
      });
    }
  }

  const words = text.split(/\s+/).length;
  if (words > 170) {
    issues.push({ kind: 'length', severity: 'warning', message: `Unusually long turn (${words} words).` });
  }
  return issues;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
