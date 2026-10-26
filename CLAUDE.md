# Arandu — convenciones

Monorepo público. Todo lo que se agregue acá es visible para cualquiera.

- `apps/web`: React 19 + Vite + TypeScript, Tailwind CSS v4, TanStack Router + TanStack Query, shadcn/ui. Package manager: pnpm.
- `apps/api`: Spring Boot, Java 25, Maven.
- `evals/` e `infra/modal/`: Python 3.12.
- Secretos solo en variables de entorno (`.env` está ignorado); nunca en el código.
- El producto está en español (es-PY); el código, los commits y los docs, en inglés.
