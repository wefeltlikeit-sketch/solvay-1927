/**
 * Argument maps are derived, never stored: a pure function of a thread's
 * utterances and the claims they voice. The map therefore grows as the
 * seminar grows, and can never contain a node the transcript does not.
 */
import type { Archive } from '../data/archive';
import type { Claim, Session, Thread, Utterance } from '../model/types';
import { sideOf } from './weights';

export type ColumnId = 'deny' | 'qualify' | 'affirm';

export interface MapNode {
  id: string;
  claim: Claim;
  participant: string;
  column: ColumnId;
  order: number;
  utteranceIds: string[];
  stance?: number;
  status?: Utterance['status'];
}

export interface MapEdge {
  from: string;
  to: string;
  kind: 'supports' | 'attacks' | 'questions' | 'qualifies';
}

export interface ArgumentMap {
  threadId: string;
  root: string;
  columns: { id: ColumnId; label: string }[];
  nodes: MapNode[];
  edges: MapEdge[];
}

export function buildArgumentMap(archive: Archive, session: Session, thread: Thread): ArgumentMap {
  const utterances = thread.utteranceIds.map((id) => session.utterances[id]).filter((u) => u?.kind === 'speech' && u.claimId);
  const prop = thread.propositionId ? archive.byId.proposition.get(thread.propositionId) : undefined;
  const isEnvelope = thread.kind === 'envelope';
  const env = thread.envelopeId ? archive.byId.envelope.get(thread.envelopeId) : undefined;

  const columns: ArgumentMap['columns'] = isEnvelope
    ? [
        { id: 'deny', label: 'Rejects' },
        { id: 'qualify', label: 'Disputes · unresolved' },
        { id: 'affirm', label: 'Accepts' },
      ]
    : [
        { id: 'deny', label: prop?.denyLabel ?? 'Against' },
        { id: 'qualify', label: 'Qualifies · questions' },
        { id: 'affirm', label: prop?.affirmLabel ?? 'For' },
      ];

  const nodes = new Map<string, MapNode>();
  const byUtterance = new Map<string, string>();
  let order = 0;
  for (const u of utterances) {
    const claim = archive.byId.claim.get(u.claimId!);
    if (!claim) continue;
    byUtterance.set(u.id, claim.id);
    const existing = nodes.get(claim.id);
    if (existing) {
      existing.utteranceIds.push(u.id);
      continue;
    }
    let column: ColumnId;
    if (isEnvelope) {
      column = u.status === 'accepted' ? 'affirm' : u.status === 'rejected' ? 'deny' : 'qualify';
    } else {
      const stance = prop ? claim.stances[prop.id] : undefined;
      column = sideOf(stance) as ColumnId;
    }
    nodes.set(claim.id, {
      id: claim.id,
      claim,
      participant: claim.participant,
      column,
      order: order++,
      utteranceIds: [u.id],
      stance: prop ? claim.stances[prop.id] : undefined,
      status: u.status,
    });
  }

  const edges: MapEdge[] = [];
  const seen = new Set<string>();
  for (const u of utterances) {
    if (!u.respondsToUtterance) continue;
    const from = byUtterance.get(u.id);
    const to = byUtterance.get(u.respondsToUtterance);
    if (!from || !to || from === to) continue;
    const key = `${from}>${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const a = nodes.get(from)!;
    const b = nodes.get(to)!;
    let kind: MapEdge['kind'];
    if (u.move === 'question' || u.move === 'clarify') kind = 'questions';
    else if (a.column === b.column) kind = 'supports';
    else if (a.column === 'qualify' || b.column === 'qualify') kind = 'qualifies';
    else kind = 'attacks';
    edges.push({ from, to, kind });
  }

  return {
    threadId: thread.id,
    root: isEnvelope ? `How does the room receive ${env?.title ?? 'the envelope'}?` : prop?.question ?? thread.title,
    columns,
    nodes: [...nodes.values()],
    edges,
  };
}
