/** SVGator slot: hero decorative floating books. */
export default function FloatingBooks({ className = '' }) {
  return (
    <svg className={`svgator-float ${className}`} viewBox="0 0 220 220" aria-hidden="true">
      <rect className="svgator-float-a" x="30" y="40" width="70" height="100" rx="4" fill="#d4a24a" opacity="0.35" />
      <rect className="svgator-float-b" x="110" y="70" width="64" height="90" rx="4" fill="#f4efe6" opacity="0.28" />
      <rect className="svgator-float-c" x="70" y="110" width="80" height="70" rx="4" fill="#d4a24a" opacity="0.2" />
    </svg>
  );
}
