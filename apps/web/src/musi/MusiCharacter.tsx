import { useId } from 'react'

/**
 * Musi: hand-made SVG character, animated with CSS only (no library).
 * A single <svg>; the state lives in `data-mood` and parts cross-fade with
 * opacity/transform, so changing mood never remounts the DOM.
 * Only transform and opacity animate (compositor-friendly on mid-range phones).
 */
export type MusiMood = 'idle' | 'looking' | 'thinking' | 'happy' | 'cheer' | 'encourage' | 'hmm'

const LABEL: Record<MusiMood, string> = {
  idle: 'Musi está atenta',
  looking: 'Musi mira el ejercicio',
  thinking: 'Musi está pensando',
  happy: 'Musi está contenta',
  cheer: 'Musi celebra',
  encourage: 'Musi te anima',
  hmm: 'Musi duda, hmm',
}

// Contrast-checked palette: outline 9.1:1 on white; mouth 4.2:1 on the body; pupil 15.5:1 on the eye.
const C = { body: '#f59e0b', line: '#78350f', mouth: '#7f1d1d', ink: '#1f2430', cheek: '#fb7185', white: '#ffffff', spark: '#facc15' }

const CSS = `
.musi{--ease-out:cubic-bezier(.22,1,.36,1);--ease-spring:cubic-bezier(.34,1.56,.64,1);overflow:visible}
.musi *{transform-box:fill-box;transform-origin:center}
.musi .fade{transition:opacity .18s ease-out}
.musi .pose{transition:transform .35s var(--ease-out)}

/* parts shown only in some moods */
.musi .m-smile,.musi .m-open,.musi .m-flat,.musi .m-wavy,.musi .m-o,.musi .m-soft,
.musi .e-round,.musi .e-happy,.musi .e-side,
.musi .cheeks,.musi .brows,.musi .brows-hmm,.musi .dots,.musi .qmark,.musi .sparks,.musi .heart{opacity:0}

.musi[data-mood=idle] .m-smile,.musi[data-mood=looking] .m-smile{opacity:1}
.musi[data-mood=idle] .e-round,.musi[data-mood=looking] .e-round,.musi[data-mood=thinking] .e-round,
.musi[data-mood=encourage] .e-round{opacity:1}
.musi[data-mood=thinking] .m-o{opacity:1}
.musi[data-mood=happy] .m-open,.musi[data-mood=cheer] .m-open{opacity:1}
.musi[data-mood=happy] .e-round{opacity:1}
.musi[data-mood=cheer] .e-happy{opacity:1}
.musi[data-mood=encourage] .m-soft{opacity:1}
.musi[data-mood=hmm] .m-wavy{opacity:1}
.musi[data-mood=hmm] .e-side{opacity:1}
.musi[data-mood=happy] .cheeks,.musi[data-mood=cheer] .cheeks,.musi[data-mood=encourage] .cheeks{opacity:.6}
.musi[data-mood=encourage] .brows{opacity:1}
.musi[data-mood=hmm] .brows-hmm{opacity:1}
.musi[data-mood=thinking] .dots{opacity:1}
.musi[data-mood=hmm] .qmark{opacity:1}
.musi[data-mood=cheer] .sparks{opacity:1}
.musi[data-mood=encourage] .heart{opacity:1}

/* gaze: the pupil moves with transform, not cx/cy */
.musi .pupils{transition:transform .3s var(--ease-out)}
.musi[data-mood=looking] .pupils{transform:translate(4px,1px)}
.musi[data-mood=thinking] .pupils{transform:translate(-3px,-4px)}
.musi[data-mood=hmm] .pupils{transform:translate(-4px,1px)}
.musi[data-mood=encourage] .pupils{transform:translate(0,1px)}
.musi .pupils{transition:transform .3s var(--ease-out),opacity .18s}
.musi[data-mood=cheer] .pupils,.musi[data-mood=hmm] .pupils{opacity:0}

/* head: tilt per mood */
.musi[data-mood=looking] .head{transform:rotate(5deg)}
.musi[data-mood=thinking] .head{transform:rotate(-6deg)}
.musi[data-mood=hmm] .head{transform:rotate(-9deg) translateY(1px)}
.musi[data-mood=encourage] .head{transform:rotate(2deg)}
.musi[data-mood=looking] .ear-l,.musi[data-mood=looking] .ear-r{transform:translateY(-3px)}
.musi[data-mood=encourage] .ear-l,.musi[data-mood=encourage] .ear-r{transform:translateY(2px) rotate(0deg)}

/* blink: the lid is a body-colored shape that scales down (scaleY) */
@keyframes musi-blink{0%,92%,100%{transform:scaleY(0)}95%,97%{transform:scaleY(1)}}
@keyframes musi-bob{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-3px) scale(1.01,.99)}}
@keyframes musi-hop{0%{transform:translateY(0) scale(1.08,.9)}35%{transform:translateY(-14px) scale(.94,1.08)}70%{transform:translateY(0) scale(1.06,.93)}100%{transform:translateY(0) scale(1,1)}}
@keyframes musi-cheer{0%,100%{transform:translateY(0) scale(1.06,.92)}30%{transform:translateY(-20px) scale(.93,1.1) rotate(-4deg)}60%{transform:translateY(-20px) scale(.93,1.1) rotate(4deg)}85%{transform:translateY(0) scale(1.06,.92)}}
@keyframes musi-nod{0%,100%{transform:translateY(0)}40%{transform:translateY(5px)}}
@keyframes musi-wobble{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
@keyframes musi-dot{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
@keyframes musi-spark{0%{opacity:0;transform:scale(.2) rotate(0)}40%{opacity:1;transform:scale(1) rotate(30deg)}100%{opacity:0;transform:scale(.6) rotate(60deg)}}
@keyframes musi-talk{0%,100%{transform:scaleY(.45)}50%{transform:scaleY(1.1)}}
@keyframes musi-heart{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}

@media (prefers-reduced-motion:no-preference){
  .musi .lids{animation:musi-blink 4.2s infinite}
  .musi .body-anim{animation:musi-bob 3.2s ease-in-out infinite}
  .musi[data-mood=happy] .body-anim{animation:musi-hop .6s var(--ease-spring) 1}
  .musi[data-mood=cheer] .body-anim{animation:musi-cheer .9s ease-in-out 2}
  .musi[data-mood=thinking] .body-anim{animation:musi-bob 2.4s ease-in-out infinite}
  .musi[data-mood=encourage] .head{animation:musi-nod 1.4s ease-in-out 2}
  .musi[data-mood=encourage] .body-anim{animation:none}
  .musi[data-mood=hmm] .brows-hmm{animation:musi-nod 2s ease-in-out infinite}
  .musi[data-mood=hmm] .qmark{animation:musi-wobble 1.1s ease-in-out infinite}
  .musi[data-mood=hmm] .body-anim{animation:none}
  .musi[data-mood=thinking] .dots circle:nth-child(1){animation:musi-dot 1.2s infinite}
  .musi[data-mood=thinking] .dots circle:nth-child(2){animation:musi-dot 1.2s .2s infinite}
  .musi[data-mood=thinking] .dots circle:nth-child(3){animation:musi-dot 1.2s .4s infinite}
  .musi[data-mood=cheer] .sparks path{animation:musi-spark 1s ease-out infinite}
  .musi[data-mood=cheer] .sparks path:nth-child(2){animation-delay:.25s}
  .musi[data-mood=cheer] .sparks path:nth-child(3){animation-delay:.5s}
  .musi[data-mood=encourage] .heart{animation:musi-heart 1s ease-in-out infinite}
  .musi[data-talking=true] .m-open,.musi[data-talking=true] .m-smile{opacity:0}
  .musi[data-talking=true] .m-talk{opacity:1;animation:musi-talk .32s ease-in-out infinite}
}
.musi .m-talk{opacity:0}
/* reduced motion: no movement; the mood still reads from the face, the tilt and the symbols */
@media (prefers-reduced-motion:reduce){
  .musi *{animation:none!important;transition:none!important}
  .musi[data-talking=true] .m-talk{opacity:1}
  .musi[data-talking=true] .m-open,.musi[data-talking=true] .m-smile{opacity:0}
  .musi .dots circle{opacity:1}
  .musi[data-mood=cheer] .sparks path{opacity:1}
}
`

export function MusiCharacter({
  mood,
  talking = false,
  className = 'size-32',
}: {
  mood: MusiMood
  /** Talking mouth (while a bubble appears or the voice plays); overrides any mood. */
  talking?: boolean
  className?: string
}) {
  const uid = useId()
  return (
    <svg
      viewBox="0 0 140 140"
      role="img"
      aria-label={LABEL[mood]}
      className={`musi ${className}`}
      data-mood={mood}
      data-talking={talking}
    >
      <style>{CSS}</style>
      <ellipse cx="70" cy="132" rx="34" ry="5" fill={C.line} opacity=".12" />
      <g className="body-anim">
        <g className="head pose">
          <g className="ear-l pose"><circle cx="40" cy="34" r="12" fill={C.body} stroke={C.line} strokeWidth="4" /></g>
          <g className="ear-r pose"><circle cx="100" cy="34" r="12" fill={C.body} stroke={C.line} strokeWidth="4" /></g>
          <circle cx="70" cy="76" r="52" fill={C.body} stroke={C.line} strokeWidth="4" />
          <clipPath id={`${uid}-eyes`}>
            <circle cx="50" cy="66" r="10" />
            <circle cx="90" cy="66" r="10" />
          </clipPath>

          {/* round eyes + pupils + lid (blink) */}
          <g className="e-round fade">
            <circle cx="50" cy="66" r="10" fill={C.white} />
            <circle cx="90" cy="66" r="10" fill={C.white} />
          </g>
          <g className="pupils">
            <circle cx="50" cy="67" r="5" fill={C.ink} />
            <circle cx="90" cy="67" r="5" fill={C.ink} />
            <circle cx="52" cy="64.5" r="1.6" fill={C.white} />
            <circle cx="92" cy="64.5" r="1.6" fill={C.white} />
          </g>
          <g clipPath={`url(#${uid}-eyes)`}>
            <rect className="lids" x="36" y="54" width="68" height="24" fill={C.body} style={{ transformOrigin: '50% 0%', transform: 'scaleY(0)' }} />
          </g>
          {/* happy eyes ^ ^ (cheer) */}
          <g className="e-happy fade" fill="none" stroke={C.ink} strokeWidth="4.5" strokeLinecap="round">
            <path d="M40 70 Q50 56 60 70" />
            <path d="M80 70 Q90 56 100 70" />
          </g>
          {/* sideways, squinting eyes (hmm) */}
          <g className="e-side fade">
            <ellipse cx="50" cy="67" rx="10" ry="6.5" fill={C.white} />
            <ellipse cx="90" cy="67" rx="10" ry="6.5" fill={C.white} />
            <circle cx="45" cy="67" r="4.2" fill={C.ink} />
            <circle cx="85" cy="67" r="4.2" fill={C.ink} />
          </g>

          {/* brows */}
          <g className="brows fade" fill="none" stroke={C.line} strokeWidth="4" strokeLinecap="round">
            <path d="M40 50 L58 44" />
            <path d="M100 50 L82 44" />
          </g>
          <g className="brows-hmm fade" fill="none" stroke={C.line} strokeWidth="4" strokeLinecap="round">
            <path d="M40 52 L58 52" />
            <path d="M82 46 L100 52" />
          </g>

          <g className="cheeks fade" fill={C.cheek}>
            <circle cx="32" cy="88" r="8" />
            <circle cx="108" cy="88" r="8" />
          </g>

          {/* mouths: all mounted, cross-faded with opacity */}
          <path className="m-smile fade" d="M56 96 Q70 108 84 96" fill="none" stroke={C.mouth} strokeWidth="4.5" strokeLinecap="round" />
          <path className="m-open fade" d="M52 92 Q70 120 88 92 Z" fill={C.mouth} stroke={C.mouth} strokeWidth="3" strokeLinejoin="round" />
          <path className="m-soft fade" d="M58 98 Q70 104 82 98" fill="none" stroke={C.mouth} strokeWidth="4.5" strokeLinecap="round" />
          <ellipse className="m-o fade" cx="70" cy="100" rx="5" ry="6" fill={C.mouth} />
          <path className="m-wavy fade" d="M54 100 q5 -6 10 0 t10 0 t10 0" fill="none" stroke={C.mouth} strokeWidth="4.5" strokeLinecap="round" />
          <ellipse className="m-talk" cx="70" cy="100" rx="11" ry="8" fill={C.mouth} style={{ transformOrigin: '50% 40%' }} />
        </g>
      </g>

      {/* symbols outside the body: tell the mood without text */}
      <g className="dots fade" fill="#4b5563">
        <circle cx="112" cy="26" r="4" />
        <circle cx="122" cy="16" r="5" />
        <circle cx="134" cy="8" r="6" />
      </g>
      <g className="qmark fade">
        <circle cx="118" cy="22" r="14" fill={C.white} stroke={C.line} strokeWidth="3" />
        <text x="118" y="29" textAnchor="middle" fontSize="20" fontWeight="800" fill={C.line} fontFamily="system-ui,sans-serif">?</text>
      </g>
      <g className="sparks fade" fill={C.spark} stroke={C.line} strokeWidth="1.5" strokeLinejoin="round">
        <path d="M20 30 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" />
        <path d="M120 20 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" />
        <path d="M126 70 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" />
      </g>
      <g className="heart fade">
        <path d="M118 30 c-10 -10 -18 0 -9 8 l9 8 9 -8 c9 -8 1 -18 -9 -8z" fill={C.cheek} stroke={C.mouth} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
