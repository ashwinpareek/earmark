// The Earmark mark: a page with its corner folded down — an earmark.
export default function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 3h14l7 7v19H6z" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M20 3v7h7" fill="var(--never-fill)" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M10.5 18.5l3.6 3.6 7.4-7.6" fill="none" stroke="var(--paid)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
