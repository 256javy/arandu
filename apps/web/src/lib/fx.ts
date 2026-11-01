/** Exercise effects with plain WAAPI (no library). All of them respect prefers-reduced-motion. */
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Wrong: a soft shake (not a punishment). Fallback: an outline flash, no movement. */
export function shake(el: HTMLElement) {
  if (reduced()) {
    el.animate([{ outlineColor: 'transparent' }, { outlineColor: '#b45309' }, { outlineColor: 'transparent' }], { duration: 600 })
    return
  }
  el.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
    { duration: 380, easing: 'ease-out' },
  )
}

/** Right: the check mark bounces in (overshoot). Fallback: a fade-in. */
export function popIn(el: HTMLElement) {
  const frames = reduced()
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.25)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }]
  el.animate(frames, { duration: reduced() ? 150 : 450, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'both' })
}

/** A cut that snaps into place with a spring. */
export function snapTo(el: HTMLElement, fromPx: number) {
  if (reduced()) return
  el.animate([{ transform: `translateX(${fromPx}px)` }, { transform: 'translateX(0)' }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' })
}

/** Hand-rolled confetti: ~25 self-removing elements animated with WAAPI. Reduced motion: no-op (Musi and the check mark are enough). */
export function confetti(origin: HTMLElement, n = 24) {
  if (reduced()) return
  const r = origin.getBoundingClientRect()
  const colors = ['#f59e0b', '#fb7185', '#14b8a6', '#8b5cf6', '#facc15']
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i')
    Object.assign(d.style, {
      position: 'fixed', left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`, width: '8px', height: '12px',
      background: colors[i % colors.length], borderRadius: '2px', pointerEvents: 'none', zIndex: '50',
    })
    document.body.appendChild(d)
    const a = Math.random() * Math.PI * 2, v = 90 + Math.random() * 130
    const x = Math.cos(a) * v, y = Math.sin(a) * v - 80
    d.animate(
      [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${x}px,${y}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.55 }, { transform: `translate(${x * 1.2}px,${y + 260}px) rotate(720deg)`, opacity: 0 }],
      { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' },
    ).onfinish = () => d.remove()
  }
}
