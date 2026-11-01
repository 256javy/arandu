import { getStoredLearnerId, getToken, HttpError } from '@/api/client'

/** What POST /api/vision/portions returns: SAM masks still encoded, cropped to their box. */
export interface SamPortion {
  id: number
  /** [x1, y1, x2, y2] in image pixels; the mask raster starts at (x1, y1). */
  box: [number, number, number, number]
  confidence: number | null
  mask: { width: number; height: number; encoding: 'one_bit' | 'lossless'; payload: string }
}
export interface SamPortions { width: number | null; height: number | null; prompt: string; portions: SamPortion[] }

/** A portion ready to draw: pixel area and a simplified outline in image coordinates. */
export interface PhotoPortion {
  id: string
  area: number
  path: string
  cx: number
  cy: number
  confidence: number | null
  box?: [number, number, number, number]
}

/** Below this SAM confidence a match is dropped. */
export const MIN_CONFIDENCE = 0.5
/** Every match at or above this makes the equal-parts evidence high confidence. */
export const HIGH_CONFIDENCE = 0.9
/** A match covering half of all matched pixels is the whole dish, not a portion. */
export const MAX_SHARE = 0.5

/**
 * Drops low-confidence matches and "whole dish" matches: half or more of all matched pixels AND a
 * box that contains another match's center. The second condition keeps a legitimately big piece
 * (a chocolate bar next to a small chunk is a real, unequal portion).
 */
export function keepPortions(ps: PhotoPortion[]): PhotoPortion[] {
  const confident = ps.filter((p) => p.confidence === null || p.confidence >= MIN_CONFIDENCE)
  const total = confident.reduce((s, p) => s + p.area, 0)
  const contains = (p: PhotoPortion, q: PhotoPortion) =>
    !!p.box && q.cx >= p.box[0] && q.cx <= p.box[2] && q.cy >= p.box[1] && q.cy <= p.box[3]
  return confident.filter((p) => !(p.area >= total * MAX_SHARE && confident.some((q) => q !== p && contains(p, q))))
}

export const allConfident = (ps: PhotoPortion[]) =>
  ps.length > 0 && ps.every((p) => p.confidence !== null && p.confidence >= HIGH_CONFIDENCE)

export type Hint = 'pizza' | 'chocolate' | 'cake'

/**
 * Minimum smallest/largest area ratio to call the portions "equal". Measured on a real pizza cut in
 * 8 (one slice bitten): areas 11.0-15.0% of the total, min/max 0.73, because perspective, crust
 * overlap and shadows skew pixel areas by up to ±20%. Three visibly unequal sponge-cake pieces gave
 * 0.59. 0.70 accepts the first and rejects the second; a photo from above shrinks the perspective error.
 */
export const EQUAL_RATIO = 0.7

export const MAX_SIDE = 1280

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

type Pt = [number, number]

/** Parses an SVG path made of M/L/Z commands into closed rings. */
export function parseRings(d: string): Pt[][] {
  const rings: Pt[][] = []
  let cur: Pt[] | null = null
  for (const m of d.matchAll(/([MLZmlz])\s*([-\d.eE]+)?[\s,]*([-\d.eE]+)?/g)) {
    const cmd = m[1].toUpperCase()
    if (cmd === 'Z') {
      cur = null
      continue
    }
    const p: Pt = [Number(m[2]), Number(m[3])]
    if (cmd === 'M' || !cur) {
      cur = [p]
      rings.push(cur)
    } else cur.push(p)
  }
  return rings
}

export function ringArea(r: Pt[]): number {
  let a = 0
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i]
    const [x2, y2] = r[(i + 1) % r.length]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}

/** Ramer-Douglas-Peucker on a closed ring. */
export function simplify(r: Pt[], eps: number): Pt[] {
  if (r.length < 4) return r
  const rdp = (pts: Pt[]): Pt[] => {
    if (pts.length < 3) return pts
    const [ax, ay] = pts[0]
    const [bx, by] = pts[pts.length - 1]
    const len = Math.hypot(bx - ax, by - ay) || 1
    let best = 0
    let idx = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, py] = pts[i]
      const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len
      if (d > best) {
        best = d
        idx = i
      }
    }
    if (best <= eps) return [pts[0], pts[pts.length - 1]]
    return [...rdp(pts.slice(0, idx + 1)).slice(0, -1), ...rdp(pts.slice(idx))]
  }
  // Split at the farthest point from the start so both halves are open polylines.
  let far = 0
  let fd = -1
  for (let i = 1; i < r.length; i++) {
    const d = Math.hypot(r[i][0] - r[0][0], r[i][1] - r[0][1])
    if (d > fd) {
      fd = d
      far = i
    }
  }
  const a = rdp(r.slice(0, far + 1))
  const b = rdp([...r.slice(far), r[0]])
  return [...a.slice(0, -1), ...b.slice(0, -1)]
}

/** Drops specks (rings under 2% of the biggest), simplifies and moves the outline to (dx, dy). */
export function outline(d: string, dx: number, dy: number, eps = 1.5): string {
  const rings = parseRings(d)
  const big = Math.max(0, ...rings.map(ringArea))
  return rings
    .filter((r) => ringArea(r) >= big * 0.02)
    .map((r) => simplify(r, eps))
    .filter((r) => r.length >= 3)
    .map((r) => 'M' + r.map(([x, y]) => `${Math.round((x + dx) * 10) / 10} ${Math.round((y + dy) * 10) / 10}`).join('L') + 'Z')
    .join('')
}

/** Decodes the masks in the browser; the parser (~20 KB) loads only when a photo is used. */
export async function decodePortions(res: SamPortions): Promise<PhotoPortion[]> {
  const { decodeMaskToRaster, decodeMaskToSVGPath } = await import('@meta-sam/parser')
  return res.portions.map((p) => {
    const raster = decodeMaskToRaster(p.mask)
    let area = 0
    let sx = 0
    let sy = 0
    for (let i = 0; i < raster.length; i++) {
      if (raster[i]) {
        area++
        sx += i % p.mask.width
        sy += Math.floor(i / p.mask.width)
      }
    }
    const [x1, y1] = p.box
    return {
      id: String(p.id),
      area,
      path: outline(decodeMaskToSVGPath(p.mask), x1, y1),
      cx: area ? x1 + sx / area : (p.box[0] + p.box[2]) / 2,
      cy: area ? y1 + sy / area : (p.box[1] + p.box[3]) / 2,
      confidence: p.confidence ?? null,
      box: p.box,
    }
  }).filter((p) => p.area > 0)
}

export function areaRatio(portions: Pick<PhotoPortion, 'area'>[]): number {
  if (portions.length < 2) return 1
  const areas = portions.map((p) => p.area)
  return Math.min(...areas) / Math.max(...areas)
}

export const looksEqual = (portions: Pick<PhotoPortion, 'area'>[]) => areaRatio(portions) >= EQUAL_RATIO

/**
 * Joins portions SAM split by mistake (e.g. one slice cut by a shadow). The joined area is the sum
 * of the parts, not the raster union: SAM's masks for one image don't overlap (measured: 0 shared
 * pixels among the 8 pizza masks), so the sum equals the union.
 */
export function merge(portions: PhotoPortion[], ids: string[]): PhotoPortion[] {
  const picked = portions.filter((p) => ids.includes(p.id))
  if (picked.length < 2) return portions
  const area = picked.reduce((s, p) => s + p.area, 0)
  const joined: PhotoPortion = {
    id: picked.map((p) => p.id).join('+'),
    area,
    path: picked.map((p) => p.path).join(''),
    cx: picked.reduce((s, p) => s + p.cx * p.area, 0) / area,
    cy: picked.reduce((s, p) => s + p.cy * p.area, 0) / area,
    confidence: picked.some((p) => p.confidence === null) ? null : Math.min(...picked.map((p) => p.confidence!)),
  }
  const first = portions.findIndex((p) => ids.includes(p.id))
  const rest = portions.filter((p) => !ids.includes(p.id))
  rest.splice(first, 0, joined)
  return rest
}

/**
 * Downscales to at most 1280 px and re-encodes as JPEG through a canvas: this drops EXIF (GPS,
 * camera) and applies the orientation, so SAM sees the photo as the kid does.
 */
export async function prepareImage(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.85),
  )
}

/** Sends the photo once; it is never stored by Arandu nor by Meta. */
export async function findPortions(image: Blob, hint?: Hint, fetcher: typeof fetch = fetch): Promise<SamPortions> {
  const send = async () => {
    const body = new FormData()
    body.append('image', image, 'photo.jpg')
    body.append('learnerId', getStoredLearnerId() ?? '')
    if (hint) body.append('hint', hint)
    const token = getToken()
    const res = await fetcher(`${BASE}/api/vision/portions`, {
      method: 'POST',
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new HttpError(res.status)
    return (await res.json()) as SamPortions
  }
  try {
    return await send()
  } catch (e) {
    // One retry for transient failures (SAM 5xx/timeout surfaces as 502; network errors as TypeError).
    const transient = e instanceof HttpError ? e.status >= 500 : e instanceof TypeError
    if (!transient) throw e
    return send()
  }
}
