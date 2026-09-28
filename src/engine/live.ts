/**
 * Optional live rendering.
 *
 * The engine has already chosen the speaker and the claim; a language model
 * may rephrase that claim so the turn responds naturally to what was just
 * said. The result is validated (knowledge boundary, quotation, grounding);
 * if it fails, the archival text stands and the evidence panel says why.
 */
import type { Archive } from '../data/archive';
import { CONFERENCE_DATES, ageAt, nameOf } from '../data/archive';
import type { Session, Utterance } from '../model/types';
import { hasErrors, horizonFor, unlockedTerms, validateSpeech } from './validator';
import { PROVENANCE_LABEL } from './weights';

export interface LiveStatus {
  enabled: boolean;
  model?: string;
  provider?: string;
}

export async function fetchLiveStatus(): Promise<LiveStatus> {
  try {
    const r = await fetch('/api/status');
    if (!r.ok) return { enabled: false };
    return (await r.json()) as LiveStatus;
  } catch {
    return { enabled: false };
  }
}

export function buildPacket(archive: Archive, session: Session, u: Utterance) {
  const claim = archive.byId.claim.get(u.claimId!)!;
  const p = archive.byId.participant.get(u.speaker)!;
  const horizon = horizonFor(p);
  const unlocked = unlockedTerms(archive, session.openedEnvelopes);
  const forbidden = archive.lexicon
    .filter((t) => t.firstKnown.slice(0, 7) > horizon && !unlocked.has(t.term))
    .map((t) => t.term);
  const thread = session.threads.find((t) => t.id === u.threadId);
  const history = (thread?.utteranceIds ?? [])
    .map((id) => session.utterances[id])
    .filter((x) => x && x.id !== u.id && x.ts <= u.ts)
    .slice(-5)
    .map((x) => `${x.kind === 'user' ? 'The visitor' : nameOf(x.speaker)}: ${x.text}`)
    .join('\n');
  const introduced = session.openedEnvelopes.map((id) => {
    const e = archive.byId.envelope.get(id);
    return e ? `${e.title} (${e.year})` : id;
  });
  return {
    vars: {
      conference_dates: CONFERENCE_DATES,
      speaker_name: p.name,
      speaker_role: p.kind === 'guest' ? `hypothetical guest from ${p.guest?.era}` : p.role,
      speaker_age: String(ageAt(p.born, p.kind === 'guest' ? `${horizon}-12-31` : '1927-10-24')),
      speaker_method: p.style.method,
      speaker_manner: p.style.manner,
      speaker_avoid: p.style.avoid.join('; '),
      horizon,
      forbidden_terms: forbidden.join(', ') || '(none)',
      introduced: introduced.join('; ') || 'nothing',
      transcript: history || '(The discussion is just beginning.)',
      addressee: u.addressedTo ? (u.addressedTo === 'user' ? 'the visitor who asked' : nameOf(u.addressedTo)) : 'the room',
      move: u.move ?? 'assert',
      claim_id: claim.id,
      claim_provenance: PROVENANCE_LABEL[claim.provenance],
      claim_confidence: claim.confidence,
      claim_summary: claim.summary,
      claim_reasoning: claim.reasoning,
      claim_evidence: (claim.evidence ?? []).join('; ') || '—',
      claim_voice: claim.voice.map((v) => `- ${v}`).join('\n'),
    },
  };
}

/** Returns a patched utterance. Never throws: failure means archival text stands. */
export async function renderLive(archive: Archive, session: Session, u: Utterance): Promise<Utterance> {
  if (u.kind !== 'speech' || !u.claimId) return u;
  const archival = u.text;
  try {
    const r = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPacket(archive, session, u)),
    });
    const data = (await r.json()) as { ok: boolean; text?: string; usedClaimIds?: string[]; insufficient?: boolean; model?: string; error?: string };
    if (!data.ok || !data.text) {
      return {
        ...u,
        render: {
          mode: 'live',
          outcome: 'fell-back',
          archivalText: archival,
          issues: [...(u.render?.issues ?? []), { kind: 'provider', severity: 'warning', message: data.error ?? 'No rendering returned.' }],
        },
      };
    }
    const issues = validateSpeech(data.text, {
      archive,
      speakerId: u.speaker,
      mode: session.mode,
      openedEnvelopes: session.openedEnvelopes,
      allowedClaims: [u.claimId],
      usedClaims: data.usedClaimIds ?? [],
    });
    if (data.insufficient) {
      issues.push({ kind: 'ungrounded', severity: 'error', message: 'The renderer reported the claim could not answer the turn.' });
    }
    if (hasErrors(issues)) {
      return { ...u, render: { mode: 'live', model: data.model, outcome: 'fell-back', archivalText: archival, issues } };
    }
    return { ...u, text: data.text, render: { mode: 'live', model: data.model, outcome: 'accepted', archivalText: archival, issues } };
  } catch (err) {
    return {
      ...u,
      render: {
        mode: 'live',
        outcome: 'fell-back',
        archivalText: archival,
        issues: [{ kind: 'provider', severity: 'warning', message: err instanceof Error ? err.message : String(err) }],
      },
    };
  }
}

