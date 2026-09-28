# Configuring AI models

The simulation runs completely without a model (**Archival** voices). A model is
used only for **Live** voices: rephrasing the claim the engine already selected so
the turn answers the previous speaker naturally.

## Setup

```
cp .env.example .env
ANTHROPIC_API_KEY=sk-ant-…
SOLVAY_MODEL=claude-opus-5     # any Claude model id
SOLVAY_EFFORT=low              # low | medium | high
SOLVAY_FALLBACKS=default       # server-side refusal fallback (Claude API beta); "off" to disable
```

Restart `npm run dev`. The top bar's **Live** toggle becomes available.

## What the model sees

`server/api.mjs` fills `prompts/speaker.system.md` and `prompts/speaker.user.md` with
a packet built in `src/engine/live.ts`:

- the speaker's style notes and the caricatures to avoid
- the knowledge horizon, the forbidden vocabulary, and envelopes introduced so far
- the last five turns
- **one** claim: summary, reasoning, evidence, archival voice lines

It must return `{ text, usedClaimIds, insufficient }` (enforced with a JSON schema).

## What happens to its output

`validateSpeech` checks the rendering exactly as it checks archival text, plus:
the rendering must declare the one claim it was given, and nothing else. Any error —
an anachronism, an unarchived quotation, a missing or stray claim id, a refusal, a
network failure — discards the rendering and keeps the archival text. The evidence
panel shows both versions and the reason.

Edit the prompts freely; they are Markdown with `{{placeholders}}`. The test
`tests/live.test.ts` fails if a template uses a placeholder the packet does not fill.

## Using another provider

Replace the `render()` function in `server/api.mjs`. The contract is: receive
`{ vars }`, return `{ ok, text, usedClaimIds, insufficient, model }`. Nothing else
in the app changes.
