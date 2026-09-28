# Adding to the archive

All history is JSON under `data/`. The app picks up new files automatically.
After any edit run `npm run check:data`. Types are in `src/model/types.ts`.

## Sources — `data/sources.json`

```json
{ "id": "heisenberg-1927", "type": "paper", "title": "…", "author": "Werner Heisenberg",
  "date": "1927-03", "citation": "Z. Phys. 43, 172–198 (1927). English in …",
  "reliability": "primary", "participants": ["heisenberg"], "topics": ["measurement"],
  "context": "Why it matters and how far to trust it." }
```

`reliability` is `primary` (written at the time), `recollection` (written later by a
participant — e.g. Heisenberg's *Physics and Beyond*) or `secondary` (historians).
`type`: proceedings, paper, letter, memoir, biography, scholarship, lecture, book,
interview, archive. Ids are stable handles; never renumber.

## Quotations — `data/quotations.json`

```json
{ "id": "q-pauli-eyes", "participant": "pauli", "sourceId": "pauli-briefwechsel-1",
  "date": "1926-10-19", "text": "…", "wording": "translation-varies",
  "confidence": "medium", "topics": ["measurement"], "context": "…",
  "reportedBy": "Werner Heisenberg", "laterTestimony": true }
```

Rules: never add a quotation you cannot cite. If wording is uncertain, say so in
`wording` and `context`. Mark anything dated after October 1927 `laterTestimony`.

## Participants — `data/participants/<id>.json`

Profile only (bio, affiliation, contributions, beliefs, philosophy, style,
relationships, disagreements, `silences`, `horizonNotes`, `sourceIds`). The
`style.avoid` list records the caricatures the simulation must not produce. Add the
id to `SEAT_ORDER` in `src/data/archive.ts` to give them a seat.
Guests go in `data/guests/` with a `guest` block (`era`, `whyInvited`, `caution`,
`horizon`, optional `composite`).

## Claims — `data/positions/<id>.json`

The unit of speech. One file per participant (guests share `guests.json`).

```json
{ "id": "einstein-screen", "participant": "einstein", "label": "Screen implies action at a distance",
  "topics": ["locality"], "stances": { "local-action": 1, "qm-complete": -0.8 },
  "move": "challenge", "provenance": "documented", "confidence": "high", "opening": true,
  "summary": "Third person, as a historian would write it.",
  "voice": ["First-person paraphrase for the room. No quotation marks."],
  "reasoning": "Why they held it.", "evidence": ["…"], "objections": ["…"],
  "respondsTo": ["bohr-…"], "exchangeNote": "If the exchange is documented, where.",
  "quoteIds": ["q-…"], "sourceIds": ["…"], "asOf": "1927-10", "later": "Shown to the user only." }
```

- `stances` (−1…+1) on proposition ids decide who speaks on what and where the claim
  sits on the argument map. Omit a proposition rather than guess.
- `respondsTo` creates seminar structure: the selector strongly prefers documented
  replies. Link generously when the historical record supports it.
- `move`: assert, challenge, question, evidence, concede, redirect, clarify.
- Keep voices inside the summary. If you need to say more, write another claim.

## Propositions — `data/propositions.json`

A canonical question the room can take up: `text`, `question`, `keywords` (routing
for free text), `affirmLabel` / `denyLabel` (map columns), `context`, `later`,
`relatedEvents`, `followUps`, `featured`.

## Events — `data/events.json`

Timeline entries: `date`, `title`, `category` (theory, experiment, technology,
conference, person, interpretation), `summary`, `landscape` (how it changes things),
`affects`, `sourceIds`, optional `envelopeId` and `knownNote` (who in the room
actually knew of it). Anything dated after October 1927 is automatically sealed.

## Envelopes — `data/envelopes/<id>.json`

A later result, written for a 1927 audience (`reading`), with `detail` for the user,
`unlocks` (phrases matched against the lexicon), `prerequisites`, `next`, and
`reactions`. Each reaction is a claim (id namespaced `<envelope>/<participant>`)
plus a ledger `status` (accepted, disputed, rejected, unresolved) and, if the real
person lived to respond, `historical: { note, sourceIds }`. Leave out people for whom
there is no basis to infer a reaction — the room will record them as unresolved.

## Lexicon — `data/lexicon.json`

`{ term, pattern (case-insensitive regex), firstKnown, note }`. Add every term, name
or concept you do not want a 1927 speaker to use.
