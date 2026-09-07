/**
 * SVGator slot: replace this component with an exported Open Book animation.
 * Keep the same className and viewBox so landing styles continue to work.
 */
export default function OpenBook({ className = '' }) {
  return (
    <svg className={`svgator-book ${className}`} viewBox="0 0 80 64" aria-hidden="true">
      <path className="svgator-book-left" d="M8 12h24c8 0 8 8 8 8v32H16c-4 0-8-4-8-8V12z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path className="svgator-book-right" d="M72 12H48c-8 0-8 8-8 8v32h24c4 0 8-4 8-8V12z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path className="svgator-book-page" d="M40 20v32" stroke="currentColor" strokeWidth="2" />
      <circle className="svgator-glow" cx="40" cy="16" r="4" fill="#d4a24a" />
    </svg>
  );
}
