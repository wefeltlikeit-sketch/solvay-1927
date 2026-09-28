import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { archive } from '../src/data/archive';
import { debateProposition } from '../src/engine/debate';
import { buildPacket, renderLive } from '../src/engine/live';
import type { Session } from '../src/model/types';

const session: Session = { id: 's', name: 't', createdAt: 0, updatedAt: 0, mode: 'historical', voicing: 'live', threads: [], utterances: {}, openedEnvelopes: [] };
const batch = debateProposition(archive, session, archive.byId.proposition.get('qm-complete')!);
const s: Session = {
  ...session,
  threads: [{ ...batch.thread, utteranceIds: batch.utterances.map((u) => u.id) }],
  utterances: Object.fromEntries(batch.utterances.map((u) => [u.id, u])),
};
const u = batch.utterances.find((x) => x.kind === 'speech')!;

describe('live rendering packet', () => {
  it('fills every placeholder in both prompt templates', () => {
    const { vars } = buildPacket(archive, s, u);
    for (const f of ['prompts/speaker.system.md', 'prompts/speaker.user.md']) {
      const filled = readFileSync(f, 'utf8').replace(/\{\{(\w+)\}\}/g, (_, k) => (vars as Record<string, string>)[k] ?? `MISSING:${k}`);
      expect(filled).not.toMatch(/MISSING:/);
    }
    expect(vars.forbidden_terms).toMatch(/entanglement/);
  });
  it('accepts a grounded rendering and rejects an anachronistic one', async () => {
    const reply = (text: string) =>
      vi.fn(async () => new Response(JSON.stringify({ ok: true, text, usedClaimIds: [u.claimId], insufficient: false, model: 'test' })));
    vi.stubGlobal('fetch', reply('I accept that the theory is impressive, but I ask whether it describes the single case completely.'));
    const good = await renderLive(archive, s, u);
    expect(good.render?.outcome).toBe('accepted');
    vi.stubGlobal('fetch', reply('Bell’s theorem and entanglement show I was right.'));
    const bad = await renderLive(archive, s, u);
    expect(bad.render?.outcome).toBe('fell-back');
    expect(bad.text).toBe(u.text);
    vi.stubGlobal('fetch', reply('As I wrote, “God is subtle but the electron is a billiard ball of great malice”, and so on.'));
    expect((await renderLive(archive, s, u)).render?.outcome).toBe('fell-back');
    vi.unstubAllGlobals();
  });
});
