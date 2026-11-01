/** Efectos de ejercicio con WAAPI puro (0 kB de librería). Todos respetan prefers-reduced-motion. */
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Error: sacudida suave (no castiga). Fallback: destello de borde, sin movimiento. */
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

/** Acierto: el check rebota (overshoot). Fallback: aparece con fade. */
export function popIn(el: HTMLElement) {
  const frames = reduced()
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.25)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }]
  el.animate(frames, { duration: reduced() ? 150 : 450, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'both' })
}

/** Corte de la barra que encaja: se mueve al sitio con resorte y la barra "late" una vez. */
export function snapTo(el: HTMLElement, fromPx: number) {
  if (reduced()) return
  el.animate([{ transform: `translateX(${fromPx}px)` }, { transform: 'translateX(0)' }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' })
}

/** Confeti a mano: ~25 divs con WAAPI, se autodestruyen. ~0.5 kB min+gzip. Reduced motion: no hace nada (Musi y el check bastan). */
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

/** Encaje: late una vez (escala). Reduced motion: destello de borde verde. */
export function pulse(el: Element) {
  if (reduced()) {
    el.animate([{ outlineColor: 'transparent' }, { outlineColor: '#15803d' }, { outlineColor: 'transparent' }], { duration: 500 })
    return
  }
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'ease-out' })
}

/** FLIP: el elemento vuela desde un desplazamiento (dx, dy) hasta su lugar con rebote. Reduced motion: no se mueve. */
export function flyFrom(el: Element, dx: number, dy: number, duration = 320) {
  if (reduced()) return
  el.animate([{ transform: `translate(${dx}px,${dy}px) scale(1.1)` }, { transform: 'translate(0,0) scale(1)' }], {
    duration,
    easing: 'cubic-bezier(.34,1.56,.64,1)',
  })
}

/** Corte que aparece: el cuchillo baja (scaleY desde arriba). Reduced motion: no anima. */
export function knifeDown(el: HTMLElement, duration = 150) {
  if (reduced()) return
  el.animate([{ transform: 'scaleY(0)', transformOrigin: 'top' }, { transform: 'scaleY(1)', transformOrigin: 'top' }], { duration, easing: 'ease-out' })
}

/** Pista de "tocá acá": la mano baja y sube dos veces y se queda. Reduced motion: no se mueve. */
export function tapHint(el: HTMLElement) {
  if (reduced()) return
  el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(10px) scale(.92)' }, { transform: 'translateY(0)' }], {
    duration: 700,
    iterations: 2,
    delay: 400,
    easing: 'ease-in-out',
  })
}

export const prefersReducedMotion = reduced
