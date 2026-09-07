/** SVGator slot: search motion. */
export default function SearchGlow({ className = '' }) {
  return (
    <svg className={`svgator-search ${className}`} viewBox="0 0 48 48" aria-hidden="true">
      <circle className="svgator-lens" cx="20" cy="20" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M28 28l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
