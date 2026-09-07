export function FadeIn({ children, className = '', delay = 0 }) {
  return (
    <div className={`anim-fade-in ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function SlideIn({ children, className = '', delay = 0 }) {
  return (
    <div className={`anim-slide-in ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function ScaleIn({ children, className = '', delay = 0 }) {
  return (
    <div className={`anim-scale-in ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function StaggerContainer({ children, className = '' }) {
  return <div className={`stagger-container ${className}`}>{children}</div>;
}

export function HoverCard({ children, className = '' }) {
  return <div className={`hover-card ${className}`}>{children}</div>;
}

export function AnimatedButton({ children, className = '', ...props }) {
  return (
    <button type="button" className={`anim-btn ${className}`} {...props}>
      {children}
    </button>
  );
}

export function PageTransition({ children, className = '' }) {
  return <div className={`page-fade ${className}`}>{children}</div>;
}
