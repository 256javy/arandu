import { useCallback, useEffect, useRef, useState } from 'react'

export function useSpeech() {
  const [muted, setMuted] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  // the user may have interacted before this component mounted (e.g. clicking a link)
  const activated = useRef(typeof navigator !== 'undefined' && !!navigator.userActivation?.hasBeenActive)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // speech only starts after the first user interaction
  useEffect(() => {
    const on = () => { activated.current = true }
    window.addEventListener('pointerdown', on, { once: true })
    window.addEventListener('keydown', on, { once: true })
    return () => {
      window.removeEventListener('pointerdown', on)
      window.removeEventListener('keydown', on)
    }
  }, [])

  const speak = useCallback((text: string) => {
    if (!supported || muted || !activated.current) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const voices = window.speechSynthesis.getVoices()
    const voice =
      voices.find((v) => v.lang.toLowerCase().startsWith('es-py')) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('es'))
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? 'es-419'
    u.onstart = () => setSpeaking(true)
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(u)
  }, [muted, supported])

  const toggleMute = () => {
    if (!muted && supported) window.speechSynthesis.cancel()
    setSpeaking(false)
    setMuted((m) => !m)
  }

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel() }, [supported])

  return { speak, muted, toggleMute, speaking, supported }
}
