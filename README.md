# Arandu

**Arandu** ("wisdom" in Guaraní) is a long-running, multimodal tutor agent that turns what a kid already loves (Minecraft, football, dinosaurs) into a path to real STEM.

Built during the [Meta Global AI Developer Hackathon](https://cerebralvalley.ai) (Oct 27 – Nov 4, 2026) on Meta's Muse models.

## Repository layout

| Path | What | Stack |
|---|---|---|
| `apps/web` | Kid-facing app + parent/teacher view | React 19, Vite, TanStack Router, Tailwind, shadcn/ui |
| `apps/api` | Agent backend: learner model, quest planner, Socratic guardrails | Java, Spring Boot |
| `evals` | Open eval harness: simulated child personas score tutors on pedagogy and safety | Python |
| `infra/modal` | Modal functions: SAM 3.1, eval fan-out, scheduled jobs, open-weights serving | Python |
| `docs` | Architecture and design decisions | Markdown |

## License

[MIT](LICENSE)
