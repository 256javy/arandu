import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { HttpError, login, signup } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function SignIn() {
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const m = useMutation({
    mutationFn: () => (mode === 'signup' ? signup(email, password) : login(email, password)),
    onSuccess: () => {
      queryClient.clear()
      void navigate({ to: '/' })
    },
  })
  const error =
    m.error instanceof HttpError
      ? m.error.status === 409
        ? 'Ya existe una cuenta con ese email. Probá entrar.'
        : m.error.status === 401
          ? 'Email o contraseña incorrectos.'
          : m.error.status === 400
            ? 'Revisá el email y que la contraseña tenga al menos 8 caracteres.'
            : 'No pudimos conectarnos. Probá de nuevo.'
      : m.error
        ? 'No pudimos conectarnos. Probá de nuevo.'
        : null

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{mode === 'signup' ? 'Crear cuenta de adulto' : 'Entrar'}</CardTitle>
        <p className="text-muted-foreground">
          La cuenta es de un adulto (madre, padre o docente). Los chicos usan perfiles con apodo, sin email ni datos personales.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            m.mutate()
          }}
        >
          <label htmlFor="email" className="font-semibold">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 rounded-lg border-2 border-border bg-card px-3 text-base"
          />
          <label htmlFor="password" className="font-semibold">Contraseña</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            aria-describedby="password-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 rounded-lg border-2 border-border bg-card px-3 text-base"
          />
          <p id="password-hint" className="text-sm text-muted-foreground">Al menos 8 caracteres.</p>
          {mode === 'signup' && (
            <label className="flex items-start gap-2">
              <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-5" />
              <span>Soy un adulto responsable y acepto que Arandu guarde el progreso de los perfiles que cree. Puedo borrarlos cuando quiera.</span>
            </label>
          )}
          <Button type="submit" size="lg" disabled={m.isPending}>
            {mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
          </Button>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          <Button type="button" variant="ghost" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); m.reset() }}>
            {mode === 'signup' ? 'Ya tengo cuenta: entrar' : 'No tengo cuenta: crear una'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
