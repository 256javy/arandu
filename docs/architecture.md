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

Modes planned: manipulable, number line, explain in words, free drawing, real-world photo, word problems. Deterministic `check()` evidence has high confidence; LLM-judged evidence (explanations, drawings) is marked medium or low.

The **learner model is organized by skill, not by exercise**, so the same skill can be demonstrated in any mode and the planner can switch modes when a kid is stuck or bored.

## Components

| Path | Role |
|---|---|
| `apps/web` | React app: exercises, Musi panel, family view |
| `apps/api` | Spring Boot: learners, evidence, tutor turns, LLM client |
| `evals` | Simulated kid personas + LLM judge scoring tutors on pedagogy and safety |
| `infra/modal` | Eval fan-out and scheduled jobs on Modal |

## Tutor turn

1. The exercise emits an event (`submitted`, `stuck`, or a kid `message`).
2. The web sends `describe(state)`, `check(state)` and recent history to `POST /api/tutor/turn`.
3. The API stores the evidence, strips personal data from kid text, and calls Muse Spark with Musi's system prompt.
4. Musi's reply is shown and spoken.

## Roadmap

Fractions (MVP) → proportions → powers → roots, each reusing the same contract and learner model.

## Deployment

| Piece | Service |
|---|---|
| Web | Cloudflare Pages |
| API | Google Cloud Run (container) |
| Database | Neon (Postgres) |
| Evals | Modal |
