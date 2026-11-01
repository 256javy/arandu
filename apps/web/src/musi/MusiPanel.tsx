import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { HistoryItem } from '@/api/client'
import { MusiAvatar, type MusiState } from './MusiAvatar'

export function MusiPanel({
  messages,
  thinking,
  happy,
  speaking,
  muted,
  speechSupported,
  error,
  onToggleMute,
  onSend,
}: {
  messages: HistoryItem[]
  thinking: boolean
  happy?: boolean
  speaking: boolean
  muted: boolean
  speechSupported: boolean
  error: string | null
  onToggleMute(): void
  onSend(text: string): void
}) {
  const [text, setText] = useState('')
  const endRef = useRef<HTMLLIElement>(null)
  const state: MusiState = thinking ? 'thinking' : speaking ? 'talking' : happy ? 'happy' : 'idle'

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [messages, thinking])

  return (
    <Card aria-label="Musi, tu tutora" role="region" className="flex flex-col">
      <CardHeader className="flex-row items-center gap-3">
        <MusiAvatar state={state} />
        <CardTitle className="flex-1">Musi</CardTitle>
        {speechSupported && (
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleMute}
            aria-pressed={muted}
            aria-label={muted ? 'Activar la voz de Musi' : 'Silenciar la voz de Musi'}
          >
            {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul aria-live="polite" aria-label="Conversación" className="flex max-h-64 min-h-24 flex-col gap-2 overflow-y-auto lg:max-h-[50vh]">
          {messages.map((m, i) => (
            <li
              key={i}
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                m.role === 'tutor' ? 'self-start bg-secondary text-secondary-foreground' : 'self-end bg-primary text-primary-foreground'
              }`}
            >
              <span className="sr-only">{m.role === 'tutor' ? 'Musi: ' : 'Vos: '}</span>
              {m.text}
            </li>
          ))}
          {thinking && <li className="self-start text-muted-foreground">Musi está pensando…</li>}
          <li ref={endRef} aria-hidden className="h-0" />
        </ul>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const t = text.trim()
            if (!t) return
            onSend(t)
            setText('')
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Escribile a Musi"
            placeholder="Escribile a Musi…"
            className="min-h-12 min-w-0 flex-1 rounded-lg border-2 border-border bg-card px-3 text-base"
          />
          <Button type="submit">Enviar</Button>
        </form>
      </CardContent>
    </Card>
  )
}
