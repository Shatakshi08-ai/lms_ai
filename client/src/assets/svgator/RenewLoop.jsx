/** SVGator slot: return & renew. */
export default function RenewLoop({ className = '' }) {
  return (
    <svg className={`svgator-renew ${className}`} viewBox="0 0 48 48" aria-hidden="true">
      <path className="svgator-arc" d="M12 24a12 12 0 102.4-7.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 12v8h8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
