import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface FormattedAiMessageProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * Stream-Safe LaTeX Buffer & AST Stabilizer
 * Holds unclosed $$ and $ tokens during active streaming to prevent raw LaTeX breakage.
 */
export function stabilizeLatexStream(raw: string, isStreaming = false): {
  cleanMarkdown: string;
  pendingEquation: string | null;
} {
  if (!raw) return { cleanMarkdown: '', pendingEquation: null };

  // Normalize legacy brackets \[ .. \] and \( .. \) to standard LaTeX delimiters
  let normalized = raw
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `\n\n$$\n${eq.trim()}\n$$\n\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => `$${eq.trim()}$`);

  if (!isStreaming) {
    return { cleanMarkdown: normalized, pendingEquation: null };
  }

  // Check unclosed block math $$
  const blockDelimiters = normalized.match(/\$\$/g) || [];
  if (blockDelimiters.length % 2 !== 0) {
    const lastIdx = normalized.lastIndexOf('$$');
    return {
      cleanMarkdown: normalized.slice(0, lastIdx),
      pendingEquation: normalized.slice(lastIdx + 2).trim() || 'Formulating equation...',
    };
  }

  // Check unclosed inline math $
  const strippedBlocks = normalized.replace(/\$\$[\s\S]*?\$\$/g, '');
  const inlineDelimiters = strippedBlocks.match(/(?<!\\)\$/g) || [];
  if (inlineDelimiters.length % 2 !== 0) {
    const lastIdx = normalized.lastIndexOf('$');
    return {
      cleanMarkdown: normalized.slice(0, lastIdx),
      pendingEquation: normalized.slice(lastIdx + 1).trim() || 'Formulating...',
    };
  }

  return { cleanMarkdown: normalized, pendingEquation: null };
}

export const FormattedAiMessage: React.FC<FormattedAiMessageProps> = ({
  content,
  isStreaming = false,
}) => {
  const { cleanMarkdown, pendingEquation } = useMemo(
    () => stabilizeLatexStream(content, isStreaming),
    [content, isStreaming]
  );

  return (
    <div className="edurain-formatted-msg space-y-2 text-slate-800 text-xs sm:text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
        components={{
          h2: ({ children }) => (
            <div className="mt-4 mb-2">
              <span className="inline-flex items-center px-3 py-1 rounded-md bg-[#175A67]/15 text-[#0E3E47] font-bold text-xs tracking-wide border border-[#175A67]/30">
                {children}
              </span>
            </div>
          ),
          h3: ({ children }) => {
            const headingStr = String(children);
            const isProTip = headingStr.toLowerCase().includes('pro-tip') || headingStr.toLowerCase().includes('tip');
            return (
              <div className="mt-3.5 mb-1.5">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md font-bold text-[11px] uppercase tracking-wider ${
                    isProTip
                      ? 'bg-amber-500/15 text-amber-900 border border-amber-500/30'
                      : 'bg-[#175A67]/10 text-[#0E3E47] border border-[#175A67]/20'
                  }`}
                >
                  {children}
                </span>
              </div>
            );
          },
          p: ({ children }) => (
            <p className="my-1.5 leading-relaxed text-slate-800 font-normal">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 space-y-1.5 pl-1 list-none">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 space-y-1.5 pl-4 list-decimal marker:text-emerald-700 marker:font-semibold">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-2 text-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
              <div className="flex-1 overflow-x-auto min-w-0">{children}</div>
            </li>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className);
            return isBlock ? (
              <div className="my-2 p-3 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs overflow-x-auto border border-emerald-950/20">
                <code className={className} {...props}>
                  {children}
                </code>
              </div>
            ) : (
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[#0E3E47] font-mono text-[11px] border border-slate-200">
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#175A67]/10 text-[#0E3E47] font-bold border-b border-slate-200">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-[11px] uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-slate-100 text-slate-700">
              {children}
            </td>
          ),
          hr: () => <hr className="my-3 border-slate-200/80" />,
          blockquote: ({ children }) => (
            <blockquote className="my-2 pl-3 border-l-3 border-emerald-600 italic text-slate-700 bg-emerald-50/50 py-1.5 pr-2 rounded-r-md">
              {children}
            </blockquote>
          ),
        }}
      >
        {cleanMarkdown}
      </ReactMarkdown>

      {/* Live Formula Compiling Shimmer Pill */}
      {pendingEquation && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#175A67]/10 border border-[#175A67]/25 text-[#0E3E47] text-[11px] font-medium animate-pulse mt-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Rendering Formula: {pendingEquation}</span>
        </div>
      )}
    </div>
  );
};

export default FormattedAiMessage;
