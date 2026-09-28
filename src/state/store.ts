/**
 * Session state. Sessions (threads, utterances, opened envelopes, mode, guest)
 * persist to localStorage; derived views (ledger, argument maps) are computed.
 * Export/import moves a session between browsers as JSON.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { archive } from '../data/archive';
import type { Mode, Session, Thread, Utterance, Voicing } from '../model/types';
import { continueThread, debateProposition, inviteSpeaker, type Batch } from '../engine/debate';
import { openEnvelope as engineOpenEnvelope } from '../engine/envelope';
import { fetchLiveStatus, renderLive, type LiveStatus } from '../engine/live';
import { route } from '../engine/router';
import { newId } from '../engine/rng';

export type View = 'room' | 'map' | 'timeline' | 'ledger' | 'archive';

export interface Ui {
  view: View;
  dossier?: string;
  dossierTab?: string;
  evidence?: string;
  mapThreadId?: string;
  mapNode?: string;
  timelineEvent?: string;
  ledgerParticipant?: string;
  emptyChair: boolean;
  envelopes: boolean;
  sessions: boolean;
  archiveFocus?: string;
}

interface Store {
  sessions: Record<string, Session>;
  currentId: string;
  onboarded: boolean;
  ui: Ui;
  live: LiveStatus;
  /** Utterances not yet revealed (not persisted: on reload everything is shown). */
  hidden: Record<string, true>;
  speaking?: string;
  busy: boolean;

  session: () => Session;
  setUi: (patch: Partial<Ui>) => void;
  finishOnboarding: () => void;
  replayOnboarding: () => void;
  init: () => Promise<void>;

  pose: (text: string, target?: string) => void;
  debate: (propositionId: string) => void;
  continueThread: (threadId: string) => void;
  invite: (participantId: string, threadId?: string) => void;
  openEnvelope: (envelopeId: string) => void;
  setMode: (mode: Mode) => void;
  setVoicing: (v: Voicing) => void;
  seatGuest: (id: string) => void;
  unseatGuest: () => void;
  setActiveThread: (id: string) => void;

  newSession: (name?: string) => void;
  switchSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  deleteSession: (id: string) => void;
  importSession: (json: string) => string | null;
}

function freshSession(name = 'First sitting'): Session {
  const now = Date.now();
  return {
    id: newId('s'),
    name,
    createdAt: now,
    updatedAt: now,
    mode: 'historical',
    voicing: 'archival',
    threads: [],
    utterances: {},
    openedEnvelopes: [],
  };
}

const first = freshSession();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const patchSession = (fn: (s: Session) => Session) =>
        set((st) => {
          const s = st.sessions[st.currentId];
          return { sessions: { ...st.sessions, [s.id]: { ...fn(s), updatedAt: Date.now() } } };
        });

      /** Adds a batch, then reveals it turn by turn — rendering live if enabled. */
      const apply = async (batch: Batch, extra?: (s: Session) => Session) => {
        const ids = batch.utterances.map((u) => u.id);
        patchSession((s) => {
          const utterances = { ...s.utterances };
          batch.utterances.forEach((u) => (utterances[u.id] = u));
          const thread: Thread = { ...batch.thread, utteranceIds: [...batch.thread.utteranceIds, ...ids] };
          const exists = s.threads.some((t) => t.id === thread.id);
          const next = {
            ...s,
            utterances,
            threads: exists ? s.threads.map((t) => (t.id === thread.id ? thread : t)) : [...s.threads, thread],
            activeThreadId: thread.id,
          };
          return extra ? extra(next) : next;
        });
        set((st) => ({ hidden: { ...st.hidden, ...Object.fromEntries(ids.map((i) => [i, true as const])) }, busy: true, ui: { ...st.ui, mapThreadId: batch.thread.id } }));
        await revealQueue(ids);
      };

      const revealQueue = async (ids: string[]) => {
        for (const id of ids) {
          const s = get().session();
          const u = s.utterances[id];
          if (!u) continue;
          if (u.kind === 'speech') {
            set({ speaking: u.speaker });
            if (s.voicing === 'live' && get().live.enabled) {
              const rendered = await renderLive(archive, s, u);
              patchSession((ss) => ({ ...ss, utterances: { ...ss.utterances, [id]: rendered } }));
            } else {
              await sleep(650 + Math.min(u.text.length * 4, 1100));
            }
          } else {
            await sleep(u.kind === 'user' ? 150 : 450);
          }
          set((st) => {
            const hidden = { ...st.hidden };
            delete hidden[id];
            return { hidden };
          });
        }
        set({ speaking: undefined, busy: false });
      };

      return {
        sessions: { [first.id]: first },
        currentId: first.id,
        onboarded: false,
        ui: { view: 'room', emptyChair: false, envelopes: false, sessions: false },
        live: { enabled: false },
        hidden: {},
        busy: false,

        session: () => get().sessions[get().currentId],
        setUi: (patch) => set((st) => ({ ui: { ...st.ui, ...patch } })),
        finishOnboarding: () => set({ onboarded: true }),
        replayOnboarding: () => set({ onboarded: false }),
        init: async () => set({ live: await fetchLiveStatus() }),

        pose: (text, target) => {
          if (!text.trim() || get().busy) return;
          const result = route(archive, get().session(), text, target);
          if (result.kind === 'evidence') {
            if (result.utteranceId) get().setUi({ evidence: result.utteranceId });
            else get().setUi({ evidence: 'none' });
            return;
          }
          void apply(result.batch);
        },

        debate: (propositionId) => {
          if (get().busy) return;
          const prop = archive.byId.proposition.get(propositionId);
          if (prop) void apply(debateProposition(archive, get().session(), prop));
        },

        continueThread: (threadId) => {
          if (get().busy) return;
          const s = get().session();
          const thread = s.threads.find((t) => t.id === threadId);
          if (!thread) return;
          const working = { ...thread, usedClaims: [...thread.usedClaims] };
          const us = continueThread(archive, s, working);
          void apply({ thread: { ...working, utteranceIds: thread.utteranceIds }, utterances: us });
        },

        invite: (participantId, threadId) => {
          if (get().busy) return;
          const s = get().session();
          const thread = s.threads.find((t) => t.id === (threadId ?? s.activeThreadId));
          if (!thread) return;
          const working = { ...thread, usedClaims: [...thread.usedClaims] };
          const u = inviteSpeaker(archive, s, working, participantId);
          void apply({ thread: { ...working, utteranceIds: thread.utteranceIds }, utterances: [u] });
        },

        openEnvelope: (envelopeId) => {
          if (get().busy) return;
          const env = archive.byId.envelope.get(envelopeId);
          if (!env) return;
          get().setUi({ envelopes: false, view: 'room' });
          void apply(engineOpenEnvelope(archive, get().session(), env), (s) => ({
            ...s,
            openedEnvelopes: s.openedEnvelopes.includes(env.id) ? s.openedEnvelopes : [...s.openedEnvelopes, env.id],
          }));
        },

        setMode: (mode) => patchSession((s) => ({ ...s, mode, guest: mode === 'historical' ? undefined : s.guest })),
        setVoicing: (voicing) => patchSession((s) => ({ ...s, voicing })),
        seatGuest: (id) => {
          patchSession((s) => ({ ...s, mode: 'experimental', guest: id }));
          get().setUi({ emptyChair: false });
        },
        unseatGuest: () => patchSession((s) => ({ ...s, guest: undefined })),
        setActiveThread: (id) => {
          patchSession((s) => ({ ...s, activeThreadId: id }));
          get().setUi({ mapThreadId: id });
        },

        newSession: (name) => {
          const s = freshSession(name ?? `Sitting ${Object.keys(get().sessions).length + 1}`);
          set((st) => ({ sessions: { ...st.sessions, [s.id]: s }, currentId: s.id, hidden: {} }));
        },
        switchSession: (id) => set({ currentId: id, hidden: {} }),
        renameSession: (id, name) =>
          set((st) => ({ sessions: { ...st.sessions, [id]: { ...st.sessions[id], name } } })),
        deleteSession: (id) =>
          set((st) => {
            const sessions = { ...st.sessions };
            delete sessions[id];
            if (!Object.keys(sessions).length) {
              const s = freshSession();
              sessions[s.id] = s;
            }
            const currentId = sessions[st.currentId] ? st.currentId : Object.keys(sessions)[0];
            return { sessions, currentId };
          }),
        importSession: (json) => {
          try {
            const data = JSON.parse(json) as Session;
            if (!data.threads || !data.utterances) return 'That file is not a Solvay 1927 session.';
            const s: Session = { ...data, id: newId('s'), name: `${data.name} (imported)` };
            set((st) => ({ sessions: { ...st.sessions, [s.id]: s }, currentId: s.id }));
            return null;
          } catch {
            return 'Could not read that file.';
          }
        },
      };
    },
    {
      name: 'solvay1927.v1',
      storage: createJSONStorage(() => {
        try {
          const probe = '__solvay_probe__';
          localStorage.setItem(probe, '1');
          localStorage.removeItem(probe);
          return localStorage;
        } catch {
          const mem = new Map<string, string>();
          return {
            getItem: (k: string) => mem.get(k) ?? null,
            setItem: (k: string, v: string) => void mem.set(k, v),
            removeItem: (k: string) => void mem.delete(k),
          };
        }
      }),
      partialize: (st) => ({ sessions: st.sessions, currentId: st.currentId, onboarded: st.onboarded }),
      // Never let stale or damaged saved state take the app down.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Store>;
        const sessions = Object.fromEntries(
          Object.entries(p.sessions ?? {}).filter(([, s]) => s && Array.isArray(s.threads) && s.utterances && Array.isArray(s.openedEnvelopes)),
        );
        if (!Object.keys(sessions).length) sessions[first.id] = first;
        const currentId = p.currentId && sessions[p.currentId] ? p.currentId : Object.keys(sessions)[0];
        return { ...current, sessions, currentId, onboarded: !!p.onboarded };
      },
    },
  ),
);

export function useSession(): Session {
  return useStore((st) => st.sessions[st.currentId]);
}

export function threadUtterances(session: Session, thread: Thread): Utterance[] {
  return thread.utteranceIds.map((id) => session.utterances[id]).filter(Boolean);
}
