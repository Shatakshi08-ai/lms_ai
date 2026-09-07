/** SVGator slot: compass / quest path. */
export default function CompassQuest({ className = '' }) {
  return (
    <svg className={`svgator-compass ${className}`} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
      <path className="svgator-needle" d="M32 16l6 16-6 16-6-16z" fill="#d4a24a" opacity="0.85" />
      <circle cx="32" cy="32" r="3" fill="currentColor" />
    </svg>
  );
}
