# Architecture

Arandu is a Socratic math tutor. A kid works on interactive exercises and **Musi**, the tutor character, sits beside them: it sees what the kid does, asks instead of answering, and remembers what the kid has already demonstrated.

## Principles

- **Not a chatbot.** Learning happens in the exercise; the tutor reacts to its real state.
- **Never gives the answer.** One short question at a time, grounded in what the kid did.
- **Any device.** Responsive web for phone, tablet and desktop; no platform is primary. Each screen adds its own value (touch on phones, precision and space on desktop).
- **Accessible.** Keyboard navigation, screen readers, large targets, high contrast. Musi speaks out loud (text-to-speech) for kids who don't read well yet. Speech recognition is optional and out of the MVP.
- **Privacy by design.** An adult creates the account; each kid has a pseudonymous profile (nickname, no email, no photo). The model only receives a pseudonymous id and the exercise state. Evidence is stored per skill, not as endless transcripts.
- **Closed world.** No open web, no ads.

## Exercise contract

Exercises are free in how they look and behave. They only share how they talk to the tutor:

```ts
interface ExerciseDefinition<S> {
  id: string;                 // "fractions.share-bar"
  skills: string[];           // ["fraction.equal-parts"]
  goal: string;               // what the kid is trying to achieve
  initialState(): S;
  describe(state: S): string; // plain-language state for the LLM
  check(state: S): Evidence[];// deterministic whenever possible
  Component: React.ComponentType<...>;
}
```

Modes built: manipulable (pizza with notation tiles, recipe), number line, explain in words, real-world photo (SAM 3.1). Planned: free drawing, word problems. Deterministic `check()` evidence has high confidence; LLM-judged evidence (explanations) is medium. The exercise has no submit button of its own: the mission screen owns a single dock action and passes the local `check()` result back as `feedback`, so the visual can animate the culprit piece immediately, before the model answers. Multi-step exercises expose `step(state)` and `stepCopy` so the screen can swap the prompt and Musi's bubble.

The **learner model is organized by skill, not by exercise**, so the same skill can be demonstrated in any mode and the planner can switch modes when a kid is stuck or bored.

## Components

| Path | Role |
|---|---|
| `apps/web` | React app: mission screen with a fixed dock, animated Musi (SVG), exercises, photo mode (decodes SAM masks with `@meta-sam/parser`), family page, Playwright e2e |
| `apps/api` | Spring Boot: learners, evidence, tutor turns, rubric judge, family spotlight, SAM proxy (`/api/vision/portions`, rate-limited, photos never stored) |
| `evals` | Simulated kid personas + LLM judge scoring tutors on pedagogy and safety |
| `infra/modal` | Muse Glimmer (open weights) on vLLM for eval kids and an optional "Musi offline" tutor; eval fan-out |
| `infra/cloudflare` | Cron worker that keeps the API warm |

## Tutor turn

1. The exercise emits an event (`submitted`, `stuck`, or a kid `message`).
2. The web sends `describe(state)`, `check(state)` and recent history to `POST /api/tutor/turn`.
3. The API checks the learner belongs to the signed-in adult, keeps only evidence for skills the exercise can show, and strips personal data from kid text.
4. For open-ended exercises, Muse Spark judges the explanation against a server-side rubric; the result is stored as **medium-confidence** evidence.
5. Muse Spark answers as Musi with the system prompt, the exercise type (manipulable: the kid can only touch and move; explain: the kid writes), the exercise state (its numbers marked as internal), this turn's evidence and a **memory** of what the kid showed in earlier sessions. Musi answers in one short sentence (a speech bubble), with no percentages or decimals.

Musi and the judge are separate clients with their own `reasoning_effort` and `max_tokens` (`META_TUTOR_*`, `META_JUDGE_*`, both `minimal` by default). Warm local turn latency with the defaults (2026-11-01, n=5, median): share-bar 1.6 s, number line 1.3 s, explain with judge 2.7 s.
6. The planner recomputes the next mission from the learner model; Musi's reply is shown and spoken.

Judged explanations keep the kid's scrubbed words as the evidence `quote` (≤ 280 chars). The family page's "Esta semana" card (`GET /api/learners/{id}/spotlight`) asks Muse Spark (minimal effort, no nickname or account sent) for a 2–4 sentence summary of the last 7 days that quotes those words and suggests something to do at home. It is cached in the `spotlight` table until newer evidence arrives or it is a day old; with no evidence this week a fixed text is shown without calling the model. Quotes and summary are deleted with the profile.

## Learner model and planner

Evidence is aggregated per skill as a confidence-weighted moving average (a deterministic check moves it more than an LLM judgment). Each skill is `new`, `practicing`, `stuck` (two misses in a row), `likely` (last answer right but only LLM-judged) or `mastered`.

The planner walks the skills in teaching order (equal parts → notation → compare → equivalence → scale → unit rate) and picks the first one not yet shown. It switches mode when the kid is stuck (number line → explain in words), confirms `likely` skills with a deterministic exercise when one exists, and explains each choice in plain Spanish for the family view.

| Exercise | Mode | Skills | Checked by |
|---|---|---|---|
| `fractions.share-bar` | Manipulable | equal parts, notation | Deterministic |
| `fractions.number-line` | Number line | compare | Deterministic |
| `fractions.explain-compare` | Explain in words | compare | LLM + rubric |
| `fractions.explain-equivalence` | Explain in words | equivalence | LLM + rubric |
| `proportions.recipe` | Manipulable | scale, unit rate | Deterministic |
| `fractions.photo` | Real-world photo (opt-in, never planned) | equal parts, notation | Deterministic over SAM masks |

## Accounts and privacy

An adult signs up with email and password (bcrypt); sessions are opaque bearer tokens stored only as SHA-256 hashes. Kid profiles are a nickname under the adult's account. The model receives the exercise state, the kid's scrubbed text and skill names, never the account or nickname. The scrub is heuristic, not a guarantee: it hides emails (also spelled out with "arroba"/"punto"), phone-like numbers, runs of seven or more digits and "calle/avenida/ruta … number" addresses, but it will miss names, other address formats and anything phrased creatively. To limit the damage, a kid's text is only kept as a `quote` (shown to the adult and sent to the spotlight model) when the scrub changed nothing and it has fewer than seven digits; otherwise no quote is stored. Client-sent evidence `detail` is scrubbed, stripped of `<>` and line breaks, clipped to 200 chars and never sent to the spotlight. Deleting a profile deletes its evidence (database cascade).

## Roadmap

Fractions (MVP) → proportions (first exercise built) → powers → roots, each reusing the same contract and learner model.

## Deployment

| Piece | Service |
|---|---|
| Web | Cloudflare (Workers static assets, SPA mode) |
| API | Vercel container runtime (scales to zero; a Java AOT cache trained at build time keeps cold start around 2 s) |
| Database | Neon (serverless Postgres) |
| LLM | Meta Model API: `muse-spark-1.3` (Musi, judge, spotlight) and SAM 3.1 (photo portions) |
| Evals | Modal (fan-out) or local async runner |
| Open-weights model | Modal: Muse Glimmer on vLLM (H100/A100), scales to zero |
| Keep-warm | Cloudflare cron worker |
