/**
 * Archive integrity. Run with `npm run check:data` after editing data/.
 * These tests are the guard-rail that keeps the simulation auditable:
 * every citation must resolve, and no 1927 voice may use later vocabulary.
 */
import { describe, expect, it } from 'vitest';
import { archive, HORIZON } from '../src/data/archive';
import { findAnachronisms, unlockedTerms } from '../src/engine/validator';

const A = archive;
const participantOrBystander = new Set([...A.participants.map((p) => p.id), ...A.bystanders.map((b) => b.id)]);

function uniq(ids: string[], what: string) {
  const seen = new Set<string>();
  for (const id of ids) {
    expect(seen.has(id), `duplicate ${what} id ${id}`).toBe(false);
    seen.add(id);
  }
}

describe('ids are unique', () => {
  it('sources, quotations, claims, events, envelopes, propositions', () => {
    uniq(A.sources.map((s) => s.id), 'source');
    uniq(A.quotations.map((q) => q.id), 'quotation');
    uniq([...A.claims, ...A.reactionClaims].map((c) => c.id), 'claim');
    uniq(A.events.map((e) => e.id), 'event');
    uniq(A.envelopes.map((e) => e.id), 'envelope');
    uniq(A.propositions.map((p) => p.id), 'proposition');
    uniq(A.participants.map((p) => p.id), 'participant');
  });
});

describe('every reference resolves', () => {
  it('claims', () => {
    for (const c of [...A.claims, ...A.reactionClaims]) {
      expect(A.byId.participant.has(c.participant), `${c.id}: participant ${c.participant}`).toBe(true);
      expect(c.sourceIds.length, `${c.id}: needs at least one source`).toBeGreaterThan(0);
      for (const s of c.sourceIds) expect(A.byId.source.has(s), `${c.id}: source ${s}`).toBe(true);
      for (const q of c.quoteIds ?? []) expect(A.byId.quote.has(q), `${c.id}: quote ${q}`).toBe(true);
      for (const r of c.respondsTo ?? []) expect(A.byId.claim.has(r), `${c.id}: respondsTo ${r}`).toBe(true);
      for (const p of Object.keys(c.stances)) expect(A.byId.proposition.has(p), `${c.id}: stance on ${p}`).toBe(true);
      for (const t of c.topics) expect(A.byId.topic.has(t), `${c.id}: topic ${t}`).toBe(true);
      for (const v of Object.values(c.stances)) expect(Math.abs(v)).toBeLessThanOrEqual(1);
      expect(c.voice.length, `${c.id}: needs a voice line`).toBeGreaterThan(0);
    }
  });
  it('quotations', () => {
    for (const q of A.quotations) {
      expect(A.byId.source.has(q.sourceId), `${q.id}: source ${q.sourceId}`).toBe(true);
      expect(A.byId.participant.has(q.participant), `${q.id}: participant ${q.participant}`).toBe(true);
      if (A.byId.participant.get(q.participant)?.kind === 'attendee' && q.date.slice(0, 7) > '1927-11') expect(q.laterTestimony, `${q.id} is after the horizon and must be marked laterTestimony`).toBe(true);
    }
  });
  it('participants', () => {
    for (const p of A.participants) {
      for (const s of p.sourceIds) expect(A.byId.source.has(s), `${p.id}: source ${s}`).toBe(true);
      for (const r of p.relationships) expect(participantOrBystander.has(r.with), `${p.id}: relationship ${r.with}`).toBe(true);
      for (const r of p.relationships) for (const s of r.sourceIds ?? []) expect(A.byId.source.has(s), `${p.id}: ${s}`).toBe(true);
      for (const d of p.disagreements) for (const s of d.sourceIds ?? []) expect(A.byId.source.has(s), `${p.id}: ${s}`).toBe(true);
      for (const h of p.horizonNotes ?? []) expect(A.byId.event.has(h.eventId), `${p.id}: horizon event ${h.eventId}`).toBe(true);
      if (p.kind === 'guest') expect(p.guest, `${p.id} guest block`).toBeTruthy();
    }
  });
  it('events, envelopes, propositions', () => {
    for (const e of A.events) {
      for (const s of e.sourceIds) expect(A.byId.source.has(s), `${e.id}: ${s}`).toBe(true);
      if (e.envelopeId) expect(A.byId.envelope.has(e.envelopeId), `${e.id}: envelope ${e.envelopeId}`).toBe(true);
    }
    for (const env of A.envelopes) {
      for (const s of env.sourceIds) expect(A.byId.source.has(s), `${env.id}: ${s}`).toBe(true);
      for (const e of env.eventIds) expect(A.byId.event.has(e), `${env.id}: event ${e}`).toBe(true);
      for (const n of [...(env.next ?? []), ...(env.prerequisites ?? [])]) expect(A.byId.envelope.has(n), `${env.id}: ${n}`).toBe(true);
      for (const r of env.reactions) {
        expect(r.claim.id.startsWith(`${env.id}/`), `${r.claim.id} should be namespaced by envelope`).toBe(true);
        for (const s of r.historical?.sourceIds ?? []) expect(A.byId.source.has(s), `${r.claim.id}: ${s}`).toBe(true);
      }
    }
    expect(A.envelopes.filter((e) => e.firstEnvelope).length).toBe(1);
    for (const p of A.propositions) {
      for (const e of p.relatedEvents) expect(A.byId.event.has(e), `${p.id}: event ${e}`).toBe(true);
      for (const f of p.followUps) expect(A.byId.proposition.has(f), `${p.id}: follow-up ${f}`).toBe(true);
    }
  });
});

describe('historical integrity of the voices', () => {
  const QUOTE = /[“"][^”"]{12,}[”"]/;
  it('no voice line wraps paraphrase in quotation marks', () => {
    for (const c of [...A.claims, ...A.reactionClaims]) for (const v of c.voice) expect(QUOTE.test(v), `${c.id}: ${v}`).toBe(false);
  });
  it('1927 attendees never use post-horizon vocabulary in standing claims', () => {
    const none = new Set<string>();
    for (const c of A.claims) {
      const p = A.byId.participant.get(c.participant)!;
      if (p.kind !== 'attendee') continue;
      for (const v of [...c.voice, c.label]) {
        const hits = findAnachronisms(v, A.lexicon, HORIZON, none).map((t) => t.term);
        expect(hits, `${c.id}: ${v}`).toEqual([]);
      }
    }
  });
  it('attendee standing claims are dated at or before the council (allowing Ehrenfest’s letter of 3 Nov 1927)', () => {
    for (const c of A.claims) {
      if (A.byId.participant.get(c.participant)?.kind !== 'attendee') continue;
      expect(c.asOf.slice(0, 7) <= '1927-11', `${c.id} asOf ${c.asOf}`).toBe(true);
    }
  });
  it('envelope reactions use only vocabulary the envelope itself introduces (plus its prerequisites)', () => {
    for (const env of A.envelopes) {
      const unlocked = unlockedTerms(A, [env.id, ...(env.prerequisites ?? [])]);
      for (const r of env.reactions) {
        if (A.byId.participant.get(r.participant)?.kind !== 'attendee') continue;
        for (const v of r.claim.voice) {
          const hits = findAnachronisms(v, A.lexicon, HORIZON, unlocked).map((t) => t.term);
          expect(hits, `${r.claim.id}: ${v}`).toEqual([]);
        }
      }
    }
  });
  it('guests stay within their own horizon', () => {
    for (const c of A.claims) {
      const p = A.byId.participant.get(c.participant)!;
      if (p.kind !== 'guest') continue;
      for (const v of c.voice) {
        const hits = findAnachronisms(v, A.lexicon, p.guest!.horizon, new Set()).map((t) => t.term);
        expect(hits, `${c.id}: ${v}`).toEqual([]);
      }
    }
  });
  it('speculative and low-confidence claims explain themselves', () => {
    for (const c of [...A.claims, ...A.reactionClaims]) {
      if (c.provenance === 'speculative') expect(c.summary.toLowerCase(), c.id).toMatch(/speculat|no (documented|evidence)|extrapolat|enough evidence/);
    }
  });
});
