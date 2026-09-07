/** SVGator slot: reviews. */
export default function ReviewStar({ className = '' }) {
  return (
    <svg className={`svgator-star ${className}`} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 8l4 10h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
