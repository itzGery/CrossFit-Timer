export default function BrandMark({ className = 'h-6 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" fill="none" aria-hidden="true" className={`shrink-0 text-accent ${className}`}>
      <path d="M3 6v12M8 3v18M13 7v10M13 12h14M27 7v10M32 3v18M37 6v12" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    </svg>
  )
}
