import React, { useState, useEffect } from 'react';
import { X, Bookmark, Star, FileText, CheckCircle2, BookOpen, Lock } from 'lucide-react';
import { VaultResource } from '../../types';
import { toggleSavePdf, isPdfSaved, onSavedPdfsChange } from '../../utils/bookmarkStorage';

interface VaultDetailModalProps {
  item: VaultResource | null;
  onClose: () => void;
  onOpenUpgrade: () => void;
}

export const VaultDetailModal: React.FC<VaultDetailModalProps> = ({ item, onClose, onOpenUpgrade }) => {
  if (!item) return null;

  const [isSaved, setIsSaved] = useState(() => isPdfSaved(String(item.id)));
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setIsSaved(isPdfSaved(String(item.id)));
    sync();
    return onSavedPdfsChange(sync);
  }, [item.id]);

  const handleToggleSave = () => {
    const nextSaved = toggleSavePdf({
      id: String(item.id),
      title: item.title,
      mediaUrl: item.pdfUrl || '',
      subject: item.subject,
      courseTitle: 'High-Yield Exam Vault',
      fileSize: item.downloadSize || '48.2 MB',
      savedAt: new Date().toISOString(),
    });
    setIsSaved(nextSaved);
    setToast(nextSaved ? 'Saved bundle to "Your Saved PDF" in Bookmarks!' : 'Removed bundle from bookmarks');
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg max-h-[90vh] bg-[#EAE3DE]/95 backdrop-blur-2xl border border-[#175A67]/30 rounded-3xl p-5 sm:p-7 shadow-2xl text-[#175A67] z-10 overflow-y-auto no-scrollbar">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/60 hover:bg-white text-[#175A67] transition-colors shadow-sm"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#175A67] text-white flex items-center justify-center shadow-md">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/60 text-[#175A67] border border-[#175A67]/20 text-[10px] font-bold">
                {item.subject}
              </span>
              <span className="text-xs font-bold text-[#10B981] flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-[#10B981]" />
                {item.rating || 4.9}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#175A67] mt-0.5">{item.title}</h2>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#2A707C] leading-relaxed mb-4">
          {item.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-5">
          {item.tags.map((tag) => (
            <span key={tag} className="text-xs font-semibold bg-white/60 border border-[#175A67]/20 text-[#175A67] px-3 py-1 rounded-full">
              #{tag}
            </span>
          ))}
        </div>

        {/* Resource Details Box */}
        <div className="p-4 rounded-2xl bg-white/60 border border-[#175A67]/15 mb-5 space-y-2 text-xs">
          <div className="flex justify-between text-[#2A707C]">
            <span>Content Quantity</span>
            <span className="font-bold text-[#175A67]">{item.countLabel}</span>
          </div>
          <div className="flex justify-between text-[#2A707C]">
            <span>Package Size</span>
            <span className="font-bold text-[#175A67]">{item.downloadSize || '48.2 MB'}</span>
          </div>
          <div className="flex justify-between text-[#2A707C]">
            <span>Verified By</span>
            <span className="font-bold text-[#10B981]">IIT-JEE Top 100 Ranker Board</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleToggleSave}
            className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${
              isSaved
                ? 'bg-amber-400 text-slate-900 font-bold'
                : 'bg-[#175A67] hover:bg-[#124853] text-white'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            <span>{isSaved ? 'Saved in Your Bookmarks' : 'Save Bundle to Your Saved PDF'}</span>
          </button>

          <p className="text-[11px] text-center text-[#2A707C] flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#175A67]" />
            <span>Device download disabled • Access anytime in Bookmarks</span>
          </p>

          <button
            onClick={onOpenUpgrade}
            className="w-full py-2.5 rounded-xl bg-white/60 hover:bg-white text-[#175A67] border border-[#175A67]/25 font-bold text-xs transition-all mt-1"
          >
            Upgrade for Physical Hardcopy Delivery
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="mt-3 text-center text-xs font-bold text-emerald-800 bg-emerald-100/90 py-2 px-3 rounded-xl animate-fadeIn">
            ✓ {toast}
          </div>
        )}

      </div>
    </div>
  );
};
