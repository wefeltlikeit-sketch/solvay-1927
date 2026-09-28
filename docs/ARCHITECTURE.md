# Architecture

```
data/            the historical archive (JSON) — no code, no prompts
prompts/         model prompt templates (Markdown) — used only in Live mode
server/          Node: /api/status, /api/render; serves dist/ in production
src/model/       types for the information model
src/data/        loads and indexes data/ (import.meta.glob, so new files are picked up)
src/engine/      the simulation — pure functions, fully unit-tested
src/state/       zustand store: sessions, persistence, reveal pacing
src/ui/          React views
tests/           archive integrity + engine behaviour
```

Stack: Vite + React + TypeScript, zustand, hand-built SVG for the table, map and
timeline (no charting dependency). The server is dependency-light Node with the
official Anthropic SDK.

## The orchestration

The brief suggested *proposition → moderator → speaker selection → agents →
cross-examination → validation → map → sources*. The implementation keeps that
shape but moves one decision: **beliefs are selected, never generated.**

```
user text
  │
  ▼  router.ts (the moderator)
  ├─ "why did you make X say that?"  → evidence panel
  ├─ mentions something after 1927   → chair refuses, offers the matching envelope
  ├─ "Bohr, …"                       → askParticipant (or recorded silence)
  ├─ matches a canonical proposition → debateProposition
  └─ nothing grounded                → chair says so, offers nearest questions
        │
        ▼  debate.ts
  opening pair  = strongest grounded claim + strongest claim on the other side
  each next turn = best-scoring archived claim from someone else, where the score
                   rewards (in order) documented exchanges (respondsTo), replies to
                   earlier points, opposite stance, not-yet-heard voices, questions
                   and evidence; penalises speculation (heavily in Historical mode)
                   and repetition; max two turns per speaker
  close         = recorded silences for everyone without a grounded position
        │
        ▼  validator.ts — every line, archival or live
  knowledge boundary (lexicon vs. horizon, unlocked only by opened envelopes)
  quotation marks only around archived quotations
  live renderings must cite exactly the claim they were given
        │
        ▼  live.ts (optional) — a model rephrases the chosen claim in context;
           failure of any check → archival text stands, and the evidence panel says why
        │
        ▼  derived views (pure functions of the session, never stored)
  argumentMap.ts  columns by archived stance, edges from who-answered-whom
  ledger.ts       known in 1927 / introduced / accepted / disputed / rejected / unresolved
```

Every utterance carries a `rationale` array recording *why this speaker, this claim,
now* — this is what the evidence panel shows.

Envelopes (`envelope.ts`) read the future result into the room, then play the
archived reaction claims, ordering them so that replies follow what they answer.
Reactions of people who died before the event are labelled as reconstructions;
where the real person lived to respond, their documented response is attached
separately.

## State and persistence

A `Session` holds threads, utterances, opened envelopes, mode, voicing and the
guest. It is persisted to localStorage (with an in-memory fallback, and a merge step
that discards damaged state). Maps and ledgers are recomputed on demand, so they
cannot drift from the transcript. Utterances are revealed turn by turn for pacing;
reveal state is not persisted.

## Scaling the archive

All lookups go through indexes built once in `src/data/archive.ts`
(`byId`, `claimsByParticipant`, `claimsBySource`). Adding hundreds of sources or
claims is a data change only; the integrity tests guard references.
