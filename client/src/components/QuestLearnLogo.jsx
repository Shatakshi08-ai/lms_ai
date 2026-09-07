/**
 * QuestLearn mark: open book + compass/quest path.
 * SVGator: replace the inner artwork in `.ql-logo-art` with an exported
 * SVGator SVG (keep width/height and aria-label).
 */
export default function QuestLearnLogo({ className = '', animated = true, title = 'QuestLearn' }) {
  return (
    <svg
      className={`ql-logo ${animated ? 'ql-logo-animated' : ''} ${className}`}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <g className="ql-logo-art">
        <rect x="4" y="8" width="56" height="48" rx="12" fill="currentColor" opacity="0.12" />
        <path
          className="ql-logo-book"
          d="M12 16h16c6 0 8 4 8 4s2-4 8-4h16v32H44s-4 4-8 4-8-4-8-4H12V16z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path className="ql-logo-spine" d="M32 20v28" stroke="currentColor" strokeWidth="2.2" />
        <circle className="ql-logo-glow" cx="32" cy="18" r="5" fill="#d4a24a" opacity="0.9" />
        <path
          className="ql-logo-path"
          d="M22 44c6-8 9-8 20-4"
          fill="none"
          stroke="#d4a24a"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="42" cy="40" r="2.2" fill="#d4a24a" />
      </g>
    </svg>
  );
}
