/** Pizza de molde (rectangular) en SVG propio: masa con borde tostado, queso y pepperoni. Puramente decorativa. */
const PEPPERONI: [number, number, number][] = [
  [55, 60, 17], [140, 135, 15], [205, 55, 16], [290, 125, 17], [360, 62, 15], [445, 132, 16], [95, 140, 12], [250, 92, 11], [410, 95, 12], [470, 52, 11],
]

export function PizzaArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 200" className={className} aria-hidden focusable="false">
      <rect x="0" y="0" width="500" height="200" rx="26" fill="#b45309" />
      <rect x="6" y="6" width="488" height="188" rx="22" fill="#d97706" />
      <rect x="16" y="16" width="468" height="168" rx="16" fill="#dc2626" />
      <rect x="20" y="20" width="460" height="160" rx="14" fill="#fcd34d" />
      <path d="M40 40 q20 10 40 0 M180 160 q25 -8 45 4 M320 36 q20 12 42 2 M410 165 q18 -10 40 0" stroke="#fde68a" strokeWidth="6" fill="none" strokeLinecap="round" />
      {PEPPERONI.map(([cx, cy, r], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill="#b91c1c" />
          <circle cx={cx - r / 3} cy={cy - r / 3} r={r / 4} fill="#ef4444" />
        </g>
      ))}
    </svg>
  )
}

/** Mini pizza con n cortes iguales (para la ranura de abajo) o un solo pedazo (ranura de arriba). */
export function MiniPizza({ parts, only = false, className = '' }: { parts: number; only?: boolean; className?: string }) {
  const w = only ? 25 : 100
  return (
    <svg viewBox={`0 0 ${w} 40`} className={className} aria-hidden focusable="false">
      <rect x="1" y="1" width={w - 2} height="38" rx="6" fill="#fcd34d" stroke="#b45309" strokeWidth="2" />
      <circle cx={w / 2} cy="20" r="5" fill="#b91c1c" />
      {!only && Array.from({ length: parts - 1 }, (_, i) => <line key={i} x1={((i + 1) * w) / parts} x2={((i + 1) * w) / parts} y1="0" y2="40" stroke="#451a03" strokeWidth="2.5" />)}
    </svg>
  )
}

const FACE_COLORS = ['#0369a1', '#7c3aed', '#be185d', '#047857']

/** Carita simple de un amigo. */
export function Face({ i, happy = false, className = '' }: { i: number; happy?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden focusable="false">
      <circle cx="20" cy="20" r="18" fill={FACE_COLORS[i % 4]} />
      <circle cx="14" cy="17" r="2.6" fill="#fff" />
      <circle cx="26" cy="17" r="2.6" fill="#fff" />
      <path d={happy ? 'M12 24 q8 9 16 0' : 'M13 26 q7 4 14 0'} stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}
