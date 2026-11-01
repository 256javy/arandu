export type MusiState = 'idle' | 'thinking' | 'talking' | 'happy'

export function MusiAvatar({ state }: { state: MusiState }) {
  const label = {
    idle: 'Musi está atenta',
    thinking: 'Musi está pensando',
    talking: 'Musi está hablando',
    happy: 'Musi está contenta',
  }[state]
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={label} className="size-24 shrink-0">
      <style>{`
        @keyframes musi-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes musi-talk { 0%,100% { ry: 3px } 50% { ry: 9px } }
        @media (prefers-reduced-motion: no-preference) {
          .musi-body { animation: musi-bob 3s ease-in-out infinite }
          .musi-mouth-talking { animation: musi-talk .35s ease-in-out infinite }
        }
      `}</style>
      <g className="musi-body">
        <circle cx="60" cy="62" r="48" fill="#f59e0b" stroke="#92400e" strokeWidth="4" />
        <circle cx="38" cy="30" r="10" fill="#f59e0b" stroke="#92400e" strokeWidth="4" />
        <circle cx="82" cy="30" r="10" fill="#f59e0b" stroke="#92400e" strokeWidth="4" />
        <circle cx="44" cy="55" r="7" fill="#fff" />
        <circle cx="76" cy="55" r="7" fill="#fff" />
        <circle cx={state === 'thinking' ? 47 : 44} cy={state === 'thinking' ? 51 : 56} r="3.5" fill="#1f2430" />
        <circle cx={state === 'thinking' ? 79 : 76} cy={state === 'thinking' ? 51 : 56} r="3.5" fill="#1f2430" />
        {state === 'talking' && <ellipse className="musi-mouth-talking" cx="60" cy="85" rx="10" ry="6" fill="#7f1d1d" />}
        {state === 'happy' && <path d="M42 78 Q60 102 78 78 Z" fill="#7f1d1d" />}
        {state === 'happy' && (
          <g fill="#fb7185" opacity=".6"><circle cx="32" cy="72" r="7" /><circle cx="88" cy="72" r="7" /></g>
        )}
        {state === 'idle' && <path d="M46 82 Q60 94 74 82" fill="none" stroke="#7f1d1d" strokeWidth="4" strokeLinecap="round" />}
        {state === 'thinking' && <line x1="50" y1="84" x2="70" y2="84" stroke="#7f1d1d" strokeWidth="4" strokeLinecap="round" />}
      </g>
      {state === 'thinking' && (
        <g fill="#4b5563"><circle cx="100" cy="14" r="3" /><circle cx="108" cy="8" r="4" /></g>
      )}
    </svg>
  )
}
