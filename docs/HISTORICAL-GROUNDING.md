# How historical grounding works

## Four layers, always visible

| Layer | Marker | Meaning |
|---|---|---|
| Documented quotation | solid brass rule; paper inset with the wording's status | Words from a traceable source. `wording` says how secure the exact words are: `original-language`, `standard-translation`, `translation-varies`, `reported-recollection`, `attributed`. |
| Documented position | solid chalk rule | The sources show the person held this. Spoken as paraphrase, never in quotation marks. |
| Reasoned inference | dashed blue rule | An extension of documented positions to a question they did not address in that form. |
| Speculative simulation | dotted violet rule | Beyond the evidence. Kept only when labelled, penalised by the speaker selector, and never used in place of silence. |

Confidence (●●● high / ●●○ medium / ●○○ low) is independent of layer.

**Voice lines are not quotations.** Each claim's `voice` array is first-person
paraphrase written for the simulation within the limits of its `summary`. The test
suite rejects any voice line that wraps text in double quotation marks. Real
quotations are shown separately, on paper, with their citation — as “on record”,
not as something said at the table. Quotations dated after the horizon are marked
`laterTestimony` and never shown in the room, only in the evidence panel and
archive.

## The knowledge boundary

- The horizon is **October 1927** (`HORIZON` in `src/data/archive.ts`). Guests have
  their own horizon (`guest.horizon`).
- `data/lexicon.json` lists post-horizon terms, names and concepts with the date
  they became available (`hidden variables`, 1932; `entanglement`, 1935;
  `Copenhagen interpretation`, 1955; `John Bell`, 1964; …).
- The validator rejects any attendee speech containing an unintroduced term. Opening
  an envelope unlocks only the vocabulary that envelope lists in `unlocks`.
- The router also catches the *user* referring to later things (terms, names, or a
  year after 1927) and offers the matching envelope instead of letting 1927 speakers
  respond as if they understood.
- The **ledger** is the inspectable record of all this, per person.
- **Historical mode:** no one and nothing from after 1927 except by envelope.
  **Experimental mode:** guests may sit in the empty chair. Guests are always shown
  with a dashed violet ring and labelled as hypothetical.

## Silence

If no archived claim bears on a question, the person does not speak. The minutes
record them as silent, and asking them directly produces:

> We do not have enough evidence to confidently infer Dirac's position on this
> specific question in October 1927.

followed (in the evidence panel) by the `silences` notes from their dossier and a list
of topics the archive *does* ground. Curie, Planck and Compton are frequently silent
on interpretation — because the record is.

## Integrity checks (`npm run check:data`)

- every source, quotation, claim, event, envelope and proposition reference resolves
- no 1927 voice uses post-horizon vocabulary; reactions use only what their envelope unlocks; guests stay within their horizon
- no voice line uses quotation marks
- attendee claims are dated at or before the council (Ehrenfest's letter of 3 November 1927 excepted)
- speculative claims explain in their summary why they are speculative

## Known limits of this first archive

- Quotations were entered from standard editions and scholarship, not re-checked
  against the originals in this build; each carries a `wording` status and
  confidence. Before public use, verify each against the edition cited.
- Some inferences (for example Born's reply to Einstein's two viewpoints) are the
  simulation's reconstructions and are labelled as such in their summaries.
- Sixteen attendees (Kramers, Langmuir, Bragg, Debye, …) are present but not yet
  grounded; they appear faintly at the back of the room.
