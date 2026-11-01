import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { HistoryItem } from '@/api/client'
import { Button } from '@/components/ui/button'

/** Full conversation in a bottom sheet (side panel on desktop). Closed by default. */
export function ChatDrawer({ open, messages, onClose }: { open: boolean; messages: HistoryItem[]; onClose(): void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const endRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    endRef.current?.scrollIntoView?.({ block: 'nearest' })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 lg:items-stretch lg:justify-end" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80dvh] w-full flex-col rounded-t-2xl bg-card shadow-xl lg:max-h-none lg:w-96 lg:rounded-none"
      >
        <div className="flex items-center justify-between border-b p-3">
          <h2 id="chat-title" className="text-lg font-bold">Charla con Musi</h2>
          <Button ref={closeRef} variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose}>
            <X aria-hidden />
          </Button>
        </div>
        <ol role="log" aria-label="Conversación" className="flex flex-col gap-2 overflow-y-auto p-3">
          {messages.map((m, i) => (
            <li
              key={i}
              ref={i === messages.length - 1 ? endRef : undefined}
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.role === 'tutor' ? 'self-start bg-amber-100 text-amber-950' : 'self-end bg-teal-700 text-white'}`}
            >
              <span className="sr-only">{m.role === 'tutor' ? 'Musi: ' : 'Vos: '}</span>
              {m.text}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
