import { readFileSync } from 'node:fs'
import type { Page, Route } from '@playwright/test'

/** API base the app under test talks to (same default as playwright.config.ts). */
export const API = process.env.E2E_API_URL ?? 'http://api.mock'
export const REAL = !!process.env.E2E_API_URL

const portions = JSON.parse(readFileSync(new URL('../src/exercises/__fixtures__/pizza-portions.json', import.meta.url), 'utf8'))

type Confidence = 'high' | 'medium' | 'low'
/** `quote`: the kid's own words, kept only for explanations judged by the model. */
interface Ev { skill: string; ok: boolean; confidence: Confidence; exercise: string; detail: string; at: string; quote: string | null }
interface Plan { exerciseId: string; skill: string; reason: string }

// Mirror of the API's catalog and planner (apps/api .../planner), small enough to keep in sync by hand.
const SKILLS = ['fraction.equal-parts', 'fraction.notation', 'fraction.compare', 'fraction.equivalence', 'proportion.scale', 'proportion.unit-rate']
const LABEL: Record<string, string> = {
  'fraction.equal-parts': 'partes iguales',
  'fraction.notation': 'notación a/b',
  'fraction.compare': 'comparar fracciones',
  'fraction.equivalence': 'fracciones equivalentes',
  'proportion.scale': 'escalar una receta',
  'proportion.unit-rate': 'valor por unidad',
}
const CATALOG = [
  { id: 'fractions.share-bar', skills: ['fraction.equal-parts', 'fraction.notation'], llm: false },
  { id: 'fractions.number-line', skills: ['fraction.compare'], llm: false },
  { id: 'fractions.explain-compare', skills: ['fraction.compare'], llm: true },
  { id: 'fractions.explain-equivalence', skills: ['fraction.equivalence'], llm: true },
  { id: 'proportions.recipe', skills: ['proportion.scale', 'proportion.unit-rate'], llm: false },
]
const WEIGHT: Record<Confidence, number> = { high: 1, medium: 0.6, low: 0.3 }

function skillState(evs: Ev[], skill: string) {
  const obs = evs.filter((e) => e.skill === skill)
  if (!obs.length) return { status: 'new', mastery: 0, attempts: 0, successes: 0, last: undefined as Ev | undefined }
  let m = 0
  for (const o of obs) m += 0.5 * WEIGHT[o.confidence] * ((o.ok ? 1 : 0) - m)
  const last = obs[obs.length - 1]
  const prev = obs[obs.length - 2]
  const status = last.ok && m >= 0.5 ? 'mastered' : last.ok ? 'likely' : prev && !prev.ok ? 'stuck' : 'practicing'
  return { status, mastery: m, attempts: obs.length, successes: obs.filter((o) => o.ok).length, last }
}

function plan(evs: Ev[]): Plan {
  for (const skill of SKILLS) {
    const st = skillState(evs, skill)
    const options = CATALOG.filter((e) => e.skills.includes(skill))
    if (st.status === 'mastered') continue
    if (st.status === 'likely') {
      const other = options.find((e) => !e.llm && e.id !== st.last?.exercise)
      if (other) return { exerciseId: other.id, skill, reason: 'Lo confirmamos con un ejercicio que se corrige solo.' }
      continue
    }
    if (st.status === 'stuck') {
      const other = options.find((e) => e.id !== st.last?.exercise) ?? options[0]
      return { exerciseId: other.id, skill, reason: `Se trabó dos veces seguidas en ${LABEL[skill]}: probamos otro modo.` }
    }
    if (st.status === 'practicing') return { exerciseId: st.last?.exercise ?? options[0].id, skill, reason: `Sigue con ${LABEL[skill]}.` }
    return { exerciseId: options[0].id, skill, reason: `Próxima habilidad: ${LABEL[skill]}.` }
  }
  return { exerciseId: 'fractions.number-line', skill: 'fraction.compare', reason: 'Repaso.' }
}

export interface MockOptions {
  /** Mock everything (default) or only the vision endpoint (real stack). */
  only?: 'vision'
  /** Start signed in with this profile. */
  signedIn?: boolean
  /** Always plan this exercise (for page-level checks). */
  forceNext?: string
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }

/** Installs a stateful fake of the Arandu API on `page`. Returns the evidence log for assertions. */
export async function mockApi(page: Page, opts: MockOptions = {}) {
  const learners: { id: string; nickname: string }[] = opts.signedIn ? [{ id: 'l1', nickname: 'Tati' }] : []
  const evidence: Ev[] = []
  if (opts.signedIn) {
    await page.addInitScript(() => {
      localStorage.setItem('arandu.token', 'tok')
      localStorage.setItem('arandu.learnerId', 'l1')
    })
  }
  const json = (r: Route, body: unknown, status = 200) =>
    r.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) })

  await page.route(`${API}/**`, async (r) => {
    const req = r.request()
    const path = new URL(req.url()).pathname
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS })
    if (path === '/api/vision/portions') return json(r, portions)
    if (opts.only === 'vision') return r.fallback()

    if (path === '/actuator/health') return json(r, { status: 'UP' })
    if (path === '/api/auth/signup' || path === '/api/auth/login') return json(r, { token: 'tok' })
    if (path === '/api/auth/logout') return r.fulfill({ status: 204, headers: CORS })
    if (path === '/api/me') return json(r, { email: 'e2e@example.com', learners })
    if (path === '/api/learners' && req.method() === 'POST') {
      const l = { id: `l${learners.length + 1}`, nickname: (req.postDataJSON() as { nickname: string }).nickname }
      learners.push(l)
      return json(r, l)
    }
    const m = path.match(/^\/api\/learners\/([^/]+)(?:\/(next|mastery|evidence|spotlight))?$/)
    if (m && m[2] === 'next') return json(r, opts.forceNext ? { exerciseId: opts.forceNext, skill: 'x', reason: 'Forzado.' } : plan(evidence))
    if (m && m[2] === 'mastery')
      return json(r, SKILLS.map((s) => {
        const st = skillState(evidence, s)
        return { skill: s, label: LABEL[s], attempts: st.attempts, successes: st.successes, mastery: st.mastery, status: st.status,
          lastDetail: st.last?.detail ?? null, lastExercise: st.last?.exercise ?? null, lastConfidence: st.last?.confidence ?? null }
      }))
    if (m && m[2] === 'spotlight')
      return json(r, evidence.length
        ? { text: `Esta semana practicó ${evidence.length} veces y ya demostró ${new Set(evidence.filter((e) => e.ok).map((e) => e.skill)).size} habilidades.`, generated: true, generatedAt: new Date().toISOString() }
        : { text: 'Esta semana todavía no hubo práctica.', generated: false, generatedAt: new Date().toISOString() })
    if (m && m[2] === 'evidence') return json(r, [...evidence].reverse().map((e) => ({ ...e, label: LABEL[e.skill] })))
    if (m && req.method() === 'DELETE') return r.fulfill({ status: 204, headers: CORS })

    if (path === '/api/tutor/turn') {
      const t = req.postDataJSON() as { exerciseId: string; event: string; message?: string; evidence: Omit<Ev, 'exercise' | 'at' | 'quote'>[] }
      let evs = t.evidence
      const ex = CATALOG.find((e) => e.id === t.exerciseId)
      // MockTutorModel's assessor: a reason word makes the explanation ok (medium confidence)
      if (t.event === 'submitted' && ex?.llm && t.message) {
        const ok = /porque|mitad|falta/i.test(t.message)
        evs = [{ skill: ex.skills[0], ok, confidence: 'medium', detail: ok ? 'Dio una razón válida.' : 'Falta: una razón.' }]
      }
      const at = new Date().toISOString()
      const quote = ex?.llm && t.message ? t.message : null
      evs.forEach((e) => evidence.push({ ...e, exercise: t.exerciseId, at, quote }))
      const next = opts.forceNext ? { exerciseId: opts.forceNext, skill: 'x', reason: 'Forzado.' } : plan(evidence)
      return json(r, { reply: 'Mirá bien lo que hiciste: ¿qué te dice cada parte?', evidence: evs, next })
    }
    return json(r, { error: 'not mocked' }, 404)
  })
  return { evidence }
}
