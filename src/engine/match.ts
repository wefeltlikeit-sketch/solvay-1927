/**
 * Reading what the user typed.
 *
 * The room only discusses what the archive can ground. Free text is routed
 * to canonical propositions by keyword; the user's own future references are
 * detected (so the chair can offer the matching envelope instead of letting
 * 1927 speakers pretend to understand them).
 */
import type { Archive } from '../data/archive';
import type { Envelope, LexiconTerm, Proposition } from '../model/types';

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'");
}

const STOP = new Set(
  'the a an is are was be of to in and or that this it its does do did can could would should what which who how why whether not no yes on for by with as at from before after really there their them they we you i'.split(' '),
);

function tokens(s: string): string[] {
  return normalise(s)
    .split(/[^a-z0-9ψ]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export interface PropositionMatch {
  id: string;
  score: number;
  hits: string[];
}

export function matchPropositions(text: string, propositions: Proposition[]): PropositionMatch[] {
  const norm = normalise(text);
  const toks = new Set(tokens(text));
  const out: PropositionMatch[] = [];
  for (const p of propositions) {
    let score = 0;
    const hits: string[] = [];
    for (const kw of p.keywords) {
      const k = normalise(kw);
      if (k.includes(' ') || k.length <= 3 ? norm.includes(k) : new RegExp(`\\b${escapeRe(k)}`).test(norm)) {
        score += k.includes(' ') ? 2 : 1.2;
        hits.push(kw);
      }
    }
    for (const t of tokens(p.text + ' ' + p.question)) if (toks.has(t)) score += 0.4;
    if (score > 0) out.push({ id: p.id, score, hits });
  }
  return out.sort((a, b) => b.score - a.score);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Does the user's phrasing negate the canonical proposition? */
export function isNegated(text: string, p: Proposition): boolean {
  const NEG = /\b(not|never|no longer|isn't|doesn't|don't|cannot|can't|incomplete)\b/;
  return NEG.test(normalise(text)) && !NEG.test(normalise(p.text));
}

export interface FutureReference {
  term: LexiconTerm;
  envelope?: Envelope;
}

/** Lexicon terms after the horizon that appear in the user's text. */
export function findFutureReferences(text: string, archive: Archive, horizon: string): FutureReference[] {
  const refs: FutureReference[] = [];
  for (const term of archive.lexicon) {
    if (term.firstKnown <= horizon) continue;
    if (!new RegExp(term.pattern, 'i').test(text)) continue;
    const re = new RegExp(term.pattern, 'i');
    // Prefer the envelope that is *about* the term, then the earliest that introduces it.
    const envelope = archive.envelopes
      .filter((e) => e.unlocks.some((u) => re.test(u)) || re.test(e.title))
      .sort((a, b) => Number(!re.test(a.title)) - Number(!re.test(b.title)) || a.year.localeCompare(b.year))[0];
    refs.push({ term, envelope });
  }
  return refs;
}

/** Years after the horizon named in the text ("in 1964 …"), with the envelope that covers them. */
export function findFutureYears(text: string, archive: Archive, horizon: string): { year: number; envelopes: Envelope[] }[] {
  const limit = Number(horizon.slice(0, 4));
  const years = [...text.matchAll(/\b(19[2-9]\d|20\d\d)\b/g)].map((m) => Number(m[1])).filter((y) => y > limit);
  return [...new Set(years)].map((year) => {
    const ids = new Set(
      archive.events.filter((e) => Number(e.date.slice(0, 4)) === year && e.envelopeId).map((e) => e.envelopeId!),
    );
    archive.envelopes.filter((e) => e.year.startsWith(String(year))).forEach((e) => ids.add(e.id));
    return { year, envelopes: [...ids].map((id) => archive.byId.envelope.get(id)!).filter(Boolean) };
  });
}

export interface Address {
  participantId: string;
  rest: string;
}

/** "Bohr, what do you…", "Professor Einstein — …", "@pauli …", "Ask Dirac whether…". */
export function findAddressee(text: string, archive: Archive, candidates: string[]): Address | null {
  const n = normalise(text).trim();
  for (const id of candidates) {
    const p = archive.byId.participant.get(id);
    if (!p) continue;
    const names = [p.shortName, p.name.split(' ').slice(-1)[0], id].map(normalise);
    for (const name of names) {
      const re = new RegExp(
        `^(?:@|ask\\s+|(?:professor|prof\\.?|dr\\.?|monsieur|madame|herr|mr\\.?|mrs\\.?)\\s+)?${escapeRe(name)}\\b[\\s,:;—–-]*`,
        'i',
      );
      const m = n.match(re);
      if (m && (m[0].match(/[,:;—–-]|^@|^ask/) || n.length > m[0].length + 3)) {
        return { participantId: id, rest: text.slice(m[0].length).trim() || text };
      }
    }
  }
  return null;
}

/** "Why did you make Einstein say that?" */
export function findEvidenceRequest(text: string, archive: Archive): { participantId?: string } | null {
  const n = normalise(text);
  if (!/\bwhy (did|does|would) (you|the simulation|it)? ?(make|have|let)? ?\w*|\bwhere does (that|this) come from|\bsource for (that|this)|\bprovenance\b/.test(n)) return null;
  if (!/\b(say|said|claim|that|this|provenance|source)\b/.test(n)) return null;
  for (const p of archive.participants) {
    const names = [p.shortName, p.name.split(' ').slice(-1)[0]].map(normalise);
    if (names.some((nm) => n.includes(nm))) return { participantId: p.id };
  }
  return {};
}
