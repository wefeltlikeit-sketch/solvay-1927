# Solvay 1927 — The Conference That Never Ends

An explorable, historically grounded simulation of the Fifth Solvay Conference on
Physics (Brussels, 24–29 October 1927). You sit at the table with Einstein, Bohr,
Heisenberg, Schrödinger, Pauli, Born, de Broglie, Dirac, Curie, Lorentz, Planck,
Compton and Ehrenfest; put propositions to the room; open envelopes from the
future; and audit every word anyone says.

It is **not** a chatbot. Nobody in the room says anything that is not an archived,
cited claim. A language model is optional and only ever *rephrases* a claim the
engine has already chosen — and its output is validated before it is shown.

## Run it

```bash
cd solvay1927
npm install
npm run dev          # http://localhost:5173 — app + /api in one process
```

Production:

```bash
npm run build
npm start            # http://localhost:8787 — serves dist/ and /api
```

Checks:

```bash
npm test             # engine + archive integrity (30 tests)
npm run check:data   # archive integrity only — run after editing data/
npm run typecheck
```

Node 20+. No database. Sessions persist in the browser (localStorage) and can be
exported/imported as JSON from the session menu (top right).

### Optional: live voices

Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. The **Live** toggle in the
top bar then lets a Claude model rephrase each chosen claim so it responds to the
previous speaker. Without a key, everything works in **Archival** mode. See
[docs/AI.md](docs/AI.md).

## What's in the room

| Feature | Where |
|---|---|
| The table, dossiers, the minutes, provocations | **The Room** |
| “Why did you make Einstein say that?” | **why this?** under any turn, or ask in the composer |
| Argument map that grows with the discussion | **Argument Map** |
| 1900 → present, with the 1927 horizon | **Time Machine** |
| Known / introduced / accepted / disputed / rejected / unresolved, per person | **Ledger** |
| Sources, quotations and every claim, searchable | **Archive** |
| Envelopes from the future (16) | ✉ **Envelopes** |
| The empty chair (7 hypothetical guests) | **Experimental** mode, then the ? seat |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit
- [docs/HISTORICAL-GROUNDING.md](docs/HISTORICAL-GROUNDING.md) — provenance, knowledge boundaries, silence
- [docs/DATA.md](docs/DATA.md) — adding participants, claims, sources, quotations, events, envelopes
- [docs/AI.md](docs/AI.md) — configuring models and how live rendering is constrained

## Relationship to the rest of this repository

This app lives in its own folder and is **not** part of the Basilrun Books site.
Netlify publishes only `../public/`, so nothing here is deployed with the site.
