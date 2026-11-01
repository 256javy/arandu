import { useQuery } from '@tanstack/react-query'
import { getMastery, getStoredLearnerId } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function Family() {
  const id = getStoredLearnerId()
  const q = useQuery({ queryKey: ['mastery', id], queryFn: () => getMastery(id!), enabled: !!id })

  return (
    <Card>
      <CardHeader><CardTitle>Progreso</CardTitle></CardHeader>
      <CardContent>
        {!id && <p>Todavía no hay ningún aprendiz. Empezá desde el inicio.</p>}
        {q.isPending && id && <p>Cargando…</p>}
        {q.isError && <p role="alert" className="text-red-700">No pudimos cargar el progreso.</p>}
        {q.data?.length === 0 && <p>Todavía no hay intentos.</p>}
        <ul className="flex flex-col gap-4">
          {q.data?.map((m) => {
            const pct = Math.round(m.mastery * 100)
            return (
              <li key={m.skill}>
                <div className="flex justify-between font-semibold">
                  <span>{m.skill}</span>
                  <span>{pct}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`Dominio de ${m.skill}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  className="h-4 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {m.successes} de {m.attempts} intentos. {m.lastDetail}
                </p>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
