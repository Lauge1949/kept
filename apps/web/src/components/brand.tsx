/** Tingfinder: a magnifying glass around a storage box, in the app's amber palette.
 * Keep geometry aligned with scripts/render-icons.mjs. */
import { cn } from '@/lib/utils';

function MarkArt() {
  return <>
    <rect width="64" height="64" rx="14" fill="#F0B03A" />
    <g fill="none" stroke="#2E2100" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="28" cy="27" r="17" />
      <path d="m41 40 12 13 M19 22l9-5 9 5v11l-9 5-9-5Z M19 22l9 5 9-5 M28 27v11" />
    </g>
  </>;
}

/** Tingfinder wordmark and custom storage-search symbol. */
export function BrandLockup({ className, width = 180 }: { className?: string; width?: number }) {
  return (
    <svg
      role="img"
      aria-label="Tingfinder"
      width={width}
      height={(width * 64) / 360}
      viewBox="0 0 360 64"
      className={cn('shrink-0 text-ink', className)}
    >
      <MarkArt />
      <text
        x="76"
        y="46"
        fill="currentColor"
        fontFamily="IBM Plex Mono, monospace"
        fontSize="42"
        fontWeight="600"
        letterSpacing="1"
      >
        TINGFINDER
      </text>
    </svg>
  );
}

/** The square Tingfinder app icon. */
export function AppMark({
  size = 32,
  label,
  className,
}: {
  size?: number;
  /** Accessible name; without one the mark is decorative. */
  label?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn('shrink-0', className)}
      role="img"
      aria-label={label ?? 'Tingfinder'}
      aria-hidden={label ? undefined : true}
    >
      <MarkArt />
    </svg>
  );
}
