// The Earmark mark, built from three parts that each mean something:
//   the page   — a hospital bill (the only thing a donation can pay)
//   the fold   — its corner turned down: "earmarked", set aside for one purpose
//   the check  — cut out of the page: verified before a cent moves
// Drawn on a 48-unit grid; see the construction lines in Splash.tsx.

export const MARK = {
  page: "M13 4H30L42 16V37a7 7 0 0 1-7 7H13a7 7 0 0 1-7-7V11a7 7 0 0 1 7-7Z",
  fold: "M30 4V12.5a3.5 3.5 0 0 0 3.5 3.5H42Z",
  check: "M15 28.5l6.2 6.2L33.5 22",
};

export default function Logo({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <path d={MARK.page} fill="var(--mark-page, var(--ink))" />
      <path d={MARK.fold} fill="var(--mark-fold, var(--never-fill))" />
      <path d={MARK.check} fill="none" stroke="var(--mark-cut, var(--paper))" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
