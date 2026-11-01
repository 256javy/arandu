/** Kitchen icons for the recipe exercise: own SVGs, purely decorative. */
type P = { className?: string }

export function FlourCup({ className = '' }: P) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden focusable="false">
      <path d="M8 14 h24 l-3 20 a3 3 0 0 1 -3 3 h-12 a3 3 0 0 1 -3 -3 z" fill="#e7e5e4" stroke="#57534e" strokeWidth="2" />
      <path d="M9 14 q5 -8 11 -4 q6 -6 11 4 z" fill="#fff" stroke="#a8a29e" strokeWidth="1.5" />
      <path d="M32 18 h3 a3 3 0 0 1 0 8 h-4" fill="none" stroke="#57534e" strokeWidth="2" />
    </svg>
  )
}

export function Egg({ className = '' }: P) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden focusable="false">
      <path d="M20 4 c9 0 14 14 14 21 a14 13 0 0 1 -28 0 c0 -7 5 -21 14 -21 z" fill="#fef3c7" stroke="#b45309" strokeWidth="2" />
      <ellipse cx="14" cy="17" rx="3" ry="5" fill="#fff" opacity=".8" />
    </svg>
  )
}

export function MilkCup({ className = '' }: P) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden focusable="false">
      <path d="M8 10 h24 l-3 24 a3 3 0 0 1 -3 3 h-12 a3 3 0 0 1 -3 -3 z" fill="#fff" stroke="#1d4ed8" strokeWidth="2" />
      <path d="M9.5 18 h21 l-2 16 a2 2 0 0 1 -2 2 h-13 a2 2 0 0 1 -2 -2 z" fill="#bfdbfe" />
      <path d="M32 15 h3 a3 3 0 0 1 0 8 h-4" fill="none" stroke="#1d4ed8" strokeWidth="2" />
    </svg>
  )
}

export function Pancakes({ className = '' }: P) {
  return (
    <svg viewBox="0 0 40 24" className={className} aria-hidden focusable="false">
      <ellipse cx="20" cy="19" rx="18" ry="4" fill="#e7e5e4" />
      <ellipse cx="20" cy="15" rx="14" ry="4" fill="#d97706" />
      <ellipse cx="20" cy="11" rx="14" ry="4" fill="#f59e0b" />
      <ellipse cx="20" cy="7" rx="14" ry="4" fill="#fbbf24" />
      <rect x="16" y="4" width="8" height="4" rx="1.5" fill="#fef9c3" />
    </svg>
  )
}

const COLORS = ['#0369a1', '#7c3aed', '#be185d', '#047857', '#b45309', '#4338ca', '#0f766e', '#9d174d']

/** A diner: happy with a pancake stack when fed, waiting with an empty plate otherwise. */
export function Diner({ i, fed, className = '' }: { i: number; fed: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 40 52" className={className} aria-hidden focusable="false">
      <circle cx="20" cy="15" r="13" fill={COLORS[i % COLORS.length]} opacity={fed ? 1 : 0.55} />
      <circle cx="15" cy="13" r="2" fill="#fff" />
      <circle cx="25" cy="13" r="2" fill="#fff" />
      <path d={fed ? 'M13 18 q7 7 14 0' : 'M14 21 q6 -3 12 0'} stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <ellipse cx="20" cy="45" rx="17" ry="5" fill="#fff" stroke="#a8a29e" strokeWidth="1.5" />
      {fed && (
        <g>
          <ellipse cx="20" cy="42" rx="11" ry="3.2" fill="#d97706" />
          <ellipse cx="20" cy="38.5" rx="11" ry="3.2" fill="#fbbf24" />
        </g>
      )}
    </svg>
  )
}
