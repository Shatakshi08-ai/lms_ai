/** SVGator slot: Elena portrait mark. */
export default function ElenaMark({ className = '' }) {
  return (
    <svg className={`svgator-elena ${className}`} viewBox="0 0 160 160" aria-hidden="true">
      <circle cx="80" cy="80" r="70" fill="#0f2744" />
      <circle className="svgator-glow" cx="80" cy="58" r="28" fill="#d4a24a" opacity="0.28" />
      <circle cx="80" cy="58" r="22" fill="none" stroke="#f4efe6" strokeWidth="3" />
      <path d="M40 128c8-24 28-32 40-32s32 8 40 32" fill="none" stroke="#f4efe6" strokeWidth="3" />
    </svg>
  );
}
