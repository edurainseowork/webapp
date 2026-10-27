import React from 'react';
import { X, Headphones, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useSupportContacts } from '../../lib/support';
import { SupportContactList } from '../Support/SupportContactList';

/** Help & Support: every support number added in CMS → Support Contacts. */
export function SupportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return <SupportModalBody onClose={onClose} />;
}

function SupportModalBody({ onClose }: { onClose: () => void }) {
  const { status, contacts, reload } = useSupportContacts();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Help and Support">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md max-h-[88vh] bg-[#F8FAFC] rounded-3xl shadow-2xl border border-white/80 flex flex-col overflow-hidden">
        <div className="bg-gradient-to-br from-[#175A67] to-[#2A707C] p-6 relative shrink-0">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 text-white/90 hover:text-white p-1.5 rounded-full hover:bg-white/15 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 text-white">
            <Headphones className="w-5 h-5" />
            <h2 className="text-lg font-bold">Help &amp; Support</h2>
          </div>
          <p className="text-xs text-white/80 mt-2">Questions about courses, payments or your account? Call or WhatsApp our team.</p>
        </div>

        <div className="p-5 overflow-y-auto">
          {status === 'loading' && contacts.length === 0 ? (
            <p className="flex items-center justify-center gap-2 text-sm text-slate-500 py-8">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading support numbers…
            </p>
          ) : status === 'error' ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600">Couldn&apos;t load the support numbers.</p>
              <button onClick={reload} className="mt-3 inline-flex items-center gap-1.5 bg-[#0F3B42] text-white text-xs font-bold px-4 py-2 rounded-xl">
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Support numbers will appear here soon.</p>
          ) : (
            <SupportContactList contacts={contacts} />
          )}
        </div>
      </div>
    </div>
  );
}

export default SupportModal;