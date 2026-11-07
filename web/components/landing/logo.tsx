export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id="lynksy-logo" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#lynksy-logo)" />
      <g fill="#fff">
        <rect x="7" y="13" width="2.5" height="6" rx="1.25" />
        <rect x="11.5" y="9" width="2.5" height="14" rx="1.25" />
        <rect x="16" y="6.5" width="2.5" height="19" rx="1.25" />
        <rect x="20.5" y="10.5" width="2.5" height="11" rx="1.25" />
        <rect x="25" y="14" width="2" height="4" rx="1" />
      </g>
    </svg>
  );
}
