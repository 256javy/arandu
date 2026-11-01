import manifest from '../../public/illustrations/manifest.json'

type Entry = { id: string; file: string; alt: string }

const BY_ID = new Map<string, Entry>((manifest as Entry[]).map((e) => [e.id, e]))

/**
 * Mission illustration (generated once with Muse Image, cached under
 * public/illustrations). Fixed size avoids layout shift; renders nothing
 * when there is no image for the id.
 */
export function MissionArt({
  id,
  size = 192,
  className = '',
}: {
  id: string
  size?: number
  className?: string
}) {
  const entry = BY_ID.get(id)
  if (!entry) return null
  return (
    <img
      src={`/illustrations/${entry.file}`}
      alt={entry.alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`shrink-0 rounded-2xl object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
