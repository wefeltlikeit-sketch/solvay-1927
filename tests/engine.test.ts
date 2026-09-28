import { describe, expect, it } from 'vitest';
import { archive } from '../src/data/archive';
import type { Session, Thread, Utterance } from '../src/model/types';
import { continueThread, debateProposition, presentIds, silentOn, type Batch } from '../src/engine/debate';
import { openEnvelope } from '../src/engine/envelope';
import { route } from '../src/engine/router';
import { ledgerFor } from '../src/engine/ledger';
import { buildArgumentMap } from '../src/engine/argumentMap';
import { validateSpeech } from '../src/engine/validator';

function session(over: Partial<Session> = {}): Session {
  return { id: 's', name: 't', createdAt: 0, updatedAt: 0, mode: 'historical', voicing: 'archival', threads: [], utterances: {}, openedEnvelopes: [], ...over };
}

function apply(s: Session, b: Batch, opened?: string): Session {
  const utterances = { ...s.utterances };
  b.utterances.forEach((u) => (utterances[u.id] = u));
  const thread: Thread = { ...b.thread, utteranceIds: [...b.thread.utteranceIds, ...b.utterances.map((u) => u.id)] };
  return {
    ...s,
    utterances,
    threads: [...s.threads.filter((t) => t.id !== thread.id), thread],
    openedEnvelopes: opened ? [...s.openedEnvelopes, opened] : s.openedEnvelopes,
  };
}

const speeches = (us: Utterance[]) => us.filter((u) => u.kind === 'speech');

describe('seminar on a proposition', () => {
  const prop = archive.byId.proposition.get('qm-complete')!;
  const s = session();
  const batch = debateProposition(archive, s, prop);
  const sp = speeches(batch.utterances);

  it('selects several speakers rather than everyone', () => {
    const speakers = new Set(sp.map((u) => u.speaker));
    expect(speakers.size).toBeGreaterThanOrEqual(3);
    expect(speakers.size).toBeLessThan(archive.attendees.length);
  });
  it('opens with opposing sides', () => {
    expect(sp[0].stance! * sp[1].stance!).toBeLessThan(0);
  });
  it('every line is an archived claim and passes validation', () => {
    for (const u of sp) {
      expect(archive.byId.claim.get(u.claimId!)?.voice).toContain(u.text);
      expect(validateSpeech(u.text, { archive, speakerId: u.speaker, mode: 'historical', openedEnvelopes: [] })).toEqual([]);
      expect(u.rationale.length).toBeGreaterThan(0);
    }
  });
  it('no speaker talks more than twice', () => {
    const counts: Record<string, number> = {};
    sp.forEach((u) => (counts[u.speaker] = (counts[u.speaker] ?? 0) + 1));
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
  });
  it('records defensible silence for those without grounded positions', () => {
    expect(silentOn(archive, s, 'qm-complete')).toContain('curie');
    expect(batch.utterances.at(-1)!.text).toMatch(/silent/);
  });
  it('eventually exhausts the archive and says so', () => {
    let st = apply(s, batch);
    let thread = st.threads[0];
    for (let i = 0; i < 12; i++) {
      const working = { ...thread, usedClaims: [...thread.usedClaims] };
      const more = continueThread(archive, st, working);
      st = apply(st, { thread: { ...working, utteranceIds: thread.utteranceIds }, utterances: more });
      thread = st.threads[0];
      if (more.some((u) => /exhausted/.test(u.text))) return;
    }
    throw new Error('never exhausted');
  });
  it('builds an argument map with both sides and at least one attack', () => {
    const st = apply(s, batch);
    const map = buildArgumentMap(archive, st, st.threads[0]);
    const cols = new Set(map.nodes.map((n) => n.column));
    expect(cols.has('affirm') && cols.has('deny')).toBe(true);
    expect(map.edges.some((e) => e.kind === 'attacks')).toBe(true);
  });
});

describe('guests and modes', () => {
  it('guests are absent in historical mode even if seated', () => {
    expect(presentIds(archive, session({ guest: 'bell' }))).not.toContain('bell');
    expect(presentIds(archive, session({ guest: 'bell', mode: 'experimental' }))).toContain('bell');
  });
});

describe('the moderator', () => {
  it('routes free text to a proposition', () => {
    const r = route(archive, session(), 'Is nature fundamentally random?');
    expect(r.kind === 'batch' && r.batch.thread.propositionId).toBe('probability-fundamental');
  });
  it('refuses to let 1927 speakers hear about Bell, and offers the envelope', () => {
    const r = route(archive, session(), "Professor Einstein, in 1964 John Bell derives the following result: Bell's inequality...");
    expect(r.kind).toBe('batch');
    if (r.kind !== 'batch') return;
    const chair = r.batch.utterances.find((u) => u.speaker === 'chair')!;
    expect(chair.offer?.envelopeIds).toContain('bell');
    expect(speeches(r.batch.utterances)).toHaveLength(0);
  });
  it('catches future dates and names even without technical terms', () => {
    const r = route(archive, session(), 'Professor Einstein, in 1964 John Bell derives the following result...');
    if (r.kind !== 'batch') throw new Error();
    expect(r.batch.utterances.find((u) => u.speaker === 'chair')?.offer?.envelopeIds).toContain('bell');
    const after = route(archive, session({ openedEnvelopes: ['epr', 'bell'] }), 'Professor Einstein, in 1964 John Bell derives the following result...');
    if (after.kind !== 'batch') throw new Error();
    expect(after.batch.utterances[1].speaker).toBe('einstein');
  });
  it('answers addressed questions, or says there is not enough evidence', () => {
    const r = route(archive, session(), 'Dirac, is quantum mechanics complete?');
    expect(r.kind).toBe('batch');
    if (r.kind !== 'batch') return;
    const first = r.batch.utterances[1];
    expect(first.speaker).toBe('dirac');
    const r2 = route(archive, session(), 'Madame Curie, must physics give us pictures?');
    if (r2.kind !== 'batch') throw new Error();
    expect(r2.batch.utterances[1].kind).toBe('silence');
    expect(r2.batch.utterances[1].text).toMatch(/do not have enough evidence to confidently infer Curie/);
  });
  it('recognises evidence requests', () => {
    expect(route(archive, session(), 'Why did you make Einstein say that?').kind).toBe('evidence');
  });
});

describe('envelopes and the ledger', () => {
  it('Bell envelope: reactions differ by framework and reach the ledger', () => {
    let s = session({ openedEnvelopes: ['epr'] });
    const b = openEnvelope(archive, s, archive.byId.envelope.get('bell')!);
    s = apply(s, b, 'bell');
    const byWho = Object.fromEntries(speeches(b.utterances).map((u) => [u.speaker, u.status]));
    expect(byWho.einstein).toBe('disputed');
    expect(byWho.bohr).toBe('accepted');
    const ledger = ledgerFor(archive, s, 'einstein');
    expect(ledger.introduced.map((i) => i.refId)).toContain('bell');
    expect(ledger.disputed.map((i) => i.refId)).toContain('bell');
    expect(ledger.unknown.some((e) => e.id === 'bell-1964')).toBe(false);
    expect(ledger.unknown.some((e) => e.id === 'aspect-1982')).toBe(true);
    const dirac = ledgerFor(archive, s, 'dirac');
    expect(dirac.unresolved.map((i) => i.refId)).toContain('bell');
  });
  it('responses follow the reactions they answer', () => {
    const b = openEnvelope(archive, session(), archive.byId.envelope.get('epr')!);
    const order = speeches(b.utterances).map((u) => u.claimId);
    expect(order.indexOf('epr/bohr')).toBeGreaterThan(order.indexOf('epr/einstein'));
    expect(order.indexOf('epr/ehrenfest')).toBeGreaterThan(order.indexOf('epr/bohr'));
  });
  it('vocabulary is unlocked only by the envelope that introduces it', () => {
    const ctx = { archive, speakerId: 'bohr', mode: 'historical' as const, openedEnvelopes: [] as string[] };
    expect(validateSpeech('The entanglement of the two particles…', ctx).some((i) => i.kind === 'anachronism')).toBe(true);
    expect(validateSpeech('The entanglement of the two particles…', { ...ctx, openedEnvelopes: ['schrodingers-cat'] })).toEqual([]);
  });
  it('flags invented quotations', () => {
    const issues = validateSpeech('As I once wrote, “the electron is a small billiard ball that knows everything”.', {
      archive, speakerId: 'einstein', mode: 'historical', openedEnvelopes: [],
    });
    expect(issues.some((i) => i.kind === 'unverified-quotation')).toBe(true);
  });
});
