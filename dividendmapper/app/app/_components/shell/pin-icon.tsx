// Tiny map-pin SVG that matches the DividendMapper logo silhouette. Used as
// the active-nav marker on the expanded drawer row. `currentColor` so it
// inherits text-[var(--brand)] from the parent class.
//
// Day 3 brand accent #2: place marker (where the user currently is in the
// app), not a generic underline or left border.
export function PinIcon({
  className,
  ...rest
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      {...rest}
    >
      <path d="M8 1.5C5.514 1.5 3.5 3.514 3.5 6c0 3.6 3.4 7.2 4.16 7.96.18.18.5.18.68 0C9.1 13.2 12.5 9.6 12.5 6c0-2.486-2.014-4.5-4.5-4.5z" />
      <circle cx="8" cy="6" r="1.6" fill="white" />
    </svg>
  );
}
