import React from 'react';
import { MessageCircle, PhoneCall } from 'lucide-react';
import { formatSupportPhone, telHref, whatsappHref, type SupportContact } from '../../lib/support';

/** Every support number from the CMS, each with Call (and WhatsApp when enabled). */
export function SupportContactList({ contacts, compact = false }: { contacts: SupportContact[]; compact?: boolean }) {
  return (
    <ul className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
      {contacts.map((c) => (
        <li
          key={c.id}
          className={compact ? 'flex items-center justify-between gap-2' : 'flex items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200/80 px-4 py-3'}
        >
          <a href={telHref(c.phone)} className="min-w-0 group" title={`Call ${c.label}`}>
            <span className={`block font-semibold text-[#175A67] group-hover:underline truncate ${compact ? 'text-[11px]' : 'text-sm'}`}>
              {formatSupportPhone(c.phone)}
            </span>
            <span className={`block text-slate-500 truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>{c.label}</span>
          </a>
          <span className="flex items-center gap-1.5 shrink-0">
            {c.whatsapp && (
              <a
                href={whatsappHref(c.phone)}
                target="_blank"
                rel="noopener noreferrer"
                title={`WhatsApp ${c.label}`}
                aria-label={`WhatsApp ${c.label}`}
                className={`rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors ${compact ? 'w-7 h-7' : 'w-9 h-9'}`}
              >
                <MessageCircle className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              </a>
            )}
            <a
              href={telHref(c.phone)}
              title={`Call ${c.label}`}
              aria-label={`Call ${c.label}`}
              className={`rounded-full bg-sky-50 text-[#175A67] hover:bg-sky-100 flex items-center justify-center transition-colors ${compact ? 'w-7 h-7' : 'w-9 h-9'}`}
            >
              <PhoneCall className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}