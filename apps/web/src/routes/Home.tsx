import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Brain, Hand, ShieldCheck, Volume2 } from 'lucide-react'
import { getMe, getToken, storeLearnerId } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MusiAvatar } from '@/musi/MusiAvatar'

export function Home() {
  const token = getToken()
  return token ? <WhoLearns /> : <Landing />
}

function Landing() {
  const features = [
    { icon: Hand, title: 'Se aprende haciendo', text: 'Cortar una pizza, ubicar la batería del celular, explicar con tus palabras. No es un chat.' },
    { icon: Brain, title: 'Musi pregunta, no responde', text: 'Ve lo que hacés en el ejercicio y te guía con preguntas. Nunca te da la respuesta.' },
    { icon: Volume2, title: 'Habla en voz alta', text: 'Para quien todavía no lee bien. Anda en celular, tablet y computadora, con teclado y lector de pantalla.' },
    { icon: ShieldCheck, title: 'Privacidad primero', text: 'Un adulto crea la cuenta; los chicos usan un apodo. El modelo solo recibe un id seudónimo.' },
  ]
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <MusiAvatar state="happy" />
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold sm:text-4xl">Fracciones con Musi, tu tutora que pregunta</h1>
          <p className="text-lg">Arandu es una tutora de matemática para chicos de 9 a 12 años, en español. Recuerda lo que ya demostraste y elige la próxima misión.</p>
          <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
            <Button asChild size="lg"><Link to="/entrar">Crear cuenta de adulto</Link></Button>
          </div>
        </div>
      </section>
      <ul className="grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <li key={f.title}>
            <Card className="h-full">
              <CardHeader className="flex-row items-center gap-3">
                <f.icon aria-hidden className="size-7 shrink-0 text-primary" />
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent><p>{f.text}</p></CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}

function WhoLearns() {
  const me = useQuery({ queryKey: ['me'], queryFn: getMe })
  const navigate = useNavigate()
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="items-center text-center">
        <MusiAvatar state="idle" />
        <CardTitle>¿Quién aprende hoy?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {me.isPending && <p>Cargando…</p>}
        {me.isError && <p role="alert" className="text-red-700">No pudimos cargar los perfiles. <Link to="/entrar" className="underline">Entrar de nuevo</Link></p>}
        {me.data?.learners.length === 0 && <p className="text-center">Todavía no hay perfiles. Un adulto puede crear uno en Familia.</p>}
        <ul className="flex flex-col gap-3">
          {me.data?.learners.map((l) => (
            <li key={l.id}>
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  storeLearnerId(l.id)
                  void navigate({ to: '/aprender' })
                }}
              >
                Soy {l.nickname}
              </Button>
            </li>
          ))}
        </ul>
        <Button asChild variant="outline"><Link to="/familia">Familia: perfiles y progreso</Link></Button>
      </CardContent>
    </Card>
  )
}
