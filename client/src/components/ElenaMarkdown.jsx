import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function CodeBlock({ className, children }) {
  const lang = /language-(\w+)/.exec(className || '')?.[1] || 'code';
  const text = String(children ?? '').replace(/\n$/, '');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <div className="elena-code">
      <div className="elena-code-bar">
        <span>{lang}</span>
        <button type="button" onClick={copy}>
          Copy
        </button>
      </div>
      <pre>
        <code className={className}>{text}</code>
      </pre>
    </div>
  );
}

export default function ElenaMarkdown({ content }) {
  return (
    <div className="elena-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const isBlock = String(className || '').includes('language-') || String(children).includes('\n');
            if (!isBlock) {
              return (
                <code className="elena-inline-code" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}
