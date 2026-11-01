import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { createLearner, storeLearnerId } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MusiAvatar } from '@/musi/MusiAvatar'

export function Home() {
  const [nickname, setNickname] = useState('')
  const navigate = useNavigate()
  const m = useMutation({
    mutationFn: createLearner,
    onSuccess: (l) => {
      storeLearnerId(l.id)
      void navigate({ to: '/aprender' })
    },
  })
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="items-center text-center">
        <MusiAvatar state="idle" />
        <CardTitle>¡Hola! Soy Musi</CardTitle>
        <p>Vamos a aprender fracciones juntos. ¿Cómo te llamás?</p>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (nickname.trim()) m.mutate(nickname.trim())
          }}
        >
          <label htmlFor="nickname" className="font-semibold">Tu apodo</label>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="off"
            className="min-h-12 rounded-lg border-2 border-border bg-card px-3 text-base"
          />
          <Button type="submit" size="lg" disabled={m.isPending}>Empezar</Button>
          {m.isError && <p role="alert" className="text-red-700">No pudimos conectarnos. Probá de nuevo.</p>}
        </form>
      </CardContent>
    </Card>
  )
}
