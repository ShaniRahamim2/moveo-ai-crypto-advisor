interface IconProps {
  className?: string;
  filled?: boolean;
}

export function ThumbsUpIcon({ className = 'h-4 w-4', filled = false }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" strokeWidth="1.8">
      <path
        d="M7 10.5V20H4.5A1.5 1.5 0 0 1 3 18.5v-6.5A1.5 1.5 0 0 1 4.5 10.5H7Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path
        d="M7 10.5 11.2 3.6a1.4 1.4 0 0 1 2.6.7v4.2h4.6a2 2 0 0 1 2 2.4l-1.3 6.6a2 2 0 0 1-2 1.5H7"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThumbsDownIcon({ className = 'h-4 w-4', filled = false }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" strokeWidth="1.8">
      <path
        d="M7 13.5V4H4.5A1.5 1.5 0 0 0 3 5.5V12a1.5 1.5 0 0 0 1.5 1.5H7Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path
        d="M7 13.5l4.2 6.9a1.4 1.4 0 0 0 2.6-.7v-4.2h4.6a2 2 0 0 0 2-2.4l-1.3-6.6a2 2 0 0 0-2-1.5H7"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" strokeWidth="1.8">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" />
    </svg>
  );
}

export function EyeOffIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" strokeWidth="1.8">
      <path d="M4 4l16 16" stroke="currentColor" strokeLinecap="round" />
      <path
        d="M9.9 5.9A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 4.1M6.6 7.8A17 17 0 0 0 2.5 12S6 18.5 12 18.5c.9 0 1.7-.1 2.5-.4"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path d="M9.9 10.2a3.2 3.2 0 0 0 4.2 4.3" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export function ExternalLinkIcon({ className = 'h-3 w-3' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" strokeWidth="2">
      <path d="M14 4h6v6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 4l-8.5 8.5" stroke="currentColor" strokeLinecap="round" />
      <path
        d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChevronLeftIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" strokeWidth="2">
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" strokeWidth="2">
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RefreshIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" strokeWidth="1.9">
      <path
        d="M20 12a8 8 0 1 1-2.3-5.6"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path d="M20 3.5V8h-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
