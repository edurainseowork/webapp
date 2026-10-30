import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { fetchCourseFaqs, type CourseFaq } from '../../lib/courses';
import { onCatalogUpdated } from '../../lib/catalogSync';

// Frequently Asked Questions at the end of the course page (CMS → FAQs).
// Answers are Markdown; react-markdown never renders raw HTML, and only the formats the CMS
// toolbar writes are allowed (paragraphs, bold, italic, lists, links).
const ALLOWED = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br'];

export function CourseFaqs({ courseId }: { courseId: number }) {
  const [faqs, setFaqs] = useState<CourseFaq[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFaqs([]);
    setOpenId(null);
    const load = (keepOpen: boolean) =>
      fetchCourseFaqs(courseId)
        .then((list) => {
          if (cancelled) return;
          setFaqs(list);
          // first answer open on load; a CMS refresh keeps the one the student is reading
          setOpenId((open) => (keepOpen && list.some((f) => f.id === open) ? open : list[0]?.id ?? null));
        })
        .catch(() => undefined); // FAQs are extra: the course page works without them
    void load(false);
    const offCms = onCatalogUpdated(() => void load(true));
    return () => {
      cancelled = true;
      offCms();
    };
  }, [courseId]);

  if (faqs.length === 0) return null;

  return (
    <section aria-labelledby="course-faqs-title" className="scroll-mt-16">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#175A67]">Have questions?</p>
      <h2 id="course-faqs-title" className="text-xl sm:text-2xl font-bold tracking-tight mt-1 mb-5">
        Frequently Asked Questions
      </h2>
      <div className="bg-white rounded-2xl shadow-[0_6px_24px_rgb(0,0,0,0.04)] divide-y divide-slate-100">
        {faqs.map((faq) => {
          const open = openId === faq.id;
          return (
            <div key={faq.id}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : faq.id)}
                aria-expanded={open}
                aria-controls={`faq-answer-${faq.id}`}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50/70 transition-colors"
              >
                <span className="flex items-start gap-2.5 min-w-0">
                  <HelpCircle className="w-4 h-4 text-[#175A67] shrink-0 mt-0.5" />
                  <span className="text-sm font-semibold text-[#0B1C30]">{faq.question}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <div id={`faq-answer-${faq.id}`} className="px-5 pb-4 pl-11 text-[13px] leading-relaxed text-slate-600 space-y-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-[#175A67] [&_a]:font-semibold [&_a]:underline">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    allowedElements={ALLOWED}
                    unwrapDisallowed
                    components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}
                  >
                    {faq.answer}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default CourseFaqs;