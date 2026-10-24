import React, { useEffect, useState } from 'react';
import { ChevronRight, CheckCircle2, SearchX, AlertTriangle, RefreshCw, BookOpen } from 'lucide-react';
import { Batch, CatalogFilter, HeaderTone, StatusTone } from './courseData';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export const formatINR = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

export const discountPct = (price: number, mrp: number) => (mrp > 0 ? Math.round((1 - price / mrp) * 100) : 0);

/** Live countdown to a deadline fixed when the component mounts. */
export function useCountdown(durationMs: number) {
  const [deadline] = useState(() => Date.now() + durationMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = Math.max(0, deadline - now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    days: pad(Math.floor(left / 86_400_000)),
    hours: pad(Math.floor((left / 3_600_000) % 24)),
    minutes: pad(Math.floor((left / 60_000) % 60)),
  };
}

export const daysHoursMinutes = (d: number, h: number, m: number) => ((d * 24 + h) * 60 + m) * 60_000;

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  return [toast, setToast] as const;
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] bg-[#175A67] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-fadeIn max-w-[90vw]">
      <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
      <span className="truncate">{message}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Batch card                                                          */
/* ------------------------------------------------------------------ */

const HEADER_TONES: Record<HeaderTone, { header: string; label: string }> = {
  deep: {
    header: 'bg-gradient-to-br from-[#123A44] to-[#0D2C33]',
    label: 'bg-amber-400/15 text-amber-300 border-amber-300/40',
  },
  teal: {
    header: 'bg-gradient-to-br from-[#1B5868] to-[#134653]',
    label: 'bg-sky-200/15 text-sky-100 border-sky-100/40',
  },
  brown: {
    header: 'bg-gradient-to-br from-[#352A29] to-[#241C1C]',
    label: 'bg-[#F3D9C4]/15 text-[#F3D9C4] border-[#F3D9C4]/40',
  },
};

const STATUS_DOTS: Record<StatusTone, string> = {
  live: 'bg-red-500',
  new: 'bg-[#175A67]',
  flash: 'bg-amber-400',
};

export function BatchCard({ batch, onOpen, onBuy }: { batch: Batch; onOpen: () => void; onBuy: () => void }) {
  const tone = HEADER_TONES[batch.tone];
  return (
    <article
      onClick={onOpen}
      className="group bg-white rounded-2xl overflow-hidden border border-white shadow-[0_6px_24px_rgb(0,0,0,0.05)] hover:shadow-[0_14px_36px_rgb(0,0,0,0.10)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col"
    >
      <div className={`relative px-5 pt-4 pb-5 min-h-[96px] ${tone.header}`}>
        {/* CMS thumbnail behind the tone gradient, so the card keeps its look */}
        {batch.thumbnail && (
          <>
            <img src={batch.thumbnail} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <div className={`absolute inset-0 opacity-75 ${tone.header}`} />
          </>
        )}
        <div className="relative">
          <span className={`inline-block text-[9px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full ${tone.label}`}>
            {batch.label}
          </span>
          <h3 className="text-white font-semibold text-[15px] mt-2 leading-snug">{batch.name}</h3>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex flex-wrap gap-1.5">
          {batch.chips.map((chip) => (
            <span key={chip} className="text-[10px] font-semibold text-[#40484B] bg-[#F6EFE9] px-2 py-0.5 rounded">
              {chip}
            </span>
          ))}
        </div>

        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0B1C30] mt-3">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOTS[batch.status.tone]}`} />
          {batch.status.text}
        </p>

        <ul className="mt-3 space-y-2">
          {batch.features.map((feature) => (
            <li key={feature.text} className="flex items-center gap-2 text-[11px] text-slate-500">
              <feature.icon className="w-3.5 h-3.5 text-[#2A707C] shrink-0" />
              {feature.text}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-4">
          <div className="border-t border-slate-100 pt-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-[#0B1C30]">{batch.price === 0 ? 'Free' : formatINR(batch.price)}</span>
                {batch.mrp > batch.price && <span className="text-xs text-slate-400 line-through">{formatINR(batch.mrp)}</span>}
              </p>
              {batch.offerText && <p className="text-[10px] font-bold text-[#175A67] mt-0.5">{batch.offerText}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                title="View course details"
                className="w-8 h-8 rounded-full bg-[#F6EFE9] hover:bg-[#EEE2D8] text-[#0B1C30] flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBuy();
                }}
                className="bg-[#0B1C20] hover:bg-[#15302F] text-white text-xs font-semibold px-4 py-2 rounded-full transition-all active:scale-95"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Catalogue grid with optional category filters                       */
/* ------------------------------------------------------------------ */
interface BatchCatalogProps {
  batches: Batch[];
  /** Category chips (from the CMS); shown when showFilters is set */
  filters?: CatalogFilter[];
  query?: string;
  showFilters?: boolean;
  /** Selected tab when the parent controls it (e.g. set from the student's goal) */
  activeFilter?: string;
  onFilterChange?: (filterId: string) => void;
  onOpenBatch: (batchId: string) => void;
  onBuyBatch: (batchId: string) => void;
}

export function BatchCatalog({
  batches,
  filters = [],
  query = '',
  showFilters = false,
  activeFilter: controlledFilter,
  onFilterChange,
  onOpenBatch,
  onBuyBatch,
}: BatchCatalogProps) {
  const [ownFilter, setOwnFilter] = useState('all');
  const filter = controlledFilter ?? ownFilter;
  const setFilter = (id: string) => (onFilterChange ? onFilterChange(id) : setOwnFilter(id));
  // A category can disappear when admins edit courses; fall back to "all"
  const activeFilter = filters.some((f) => f.id === filter) ? filter : 'all';
  const activeLabel = filters.find((f) => f.id === activeFilter)?.label;
  const q = query.trim().toLowerCase();

  const visible = batches.filter((batch) => {
    const matchesFilter = activeFilter === 'all' || batch.categories.includes(activeFilter);
    const matchesQuery =
      !q ||
      batch.name.toLowerCase().includes(q) ||
      batch.title.toLowerCase().includes(q) ||
      batch.description.toLowerCase().includes(q) ||
      batch.chips.some((chip) => chip.toLowerCase().includes(q));
    return matchesFilter && matchesQuery;
  });

  return (
    <div>
      {showFilters && (filters.length > 2 || activeFilter !== 'all') && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 mb-5">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activeFilter === f.id ? 'bg-[#0B1C20] text-white shadow-sm' : 'bg-white text-[#0B1C30] hover:bg-white/70'
              }`}
            >
              {f.id === 'all' ? `${f.label} (${batches.length})` : f.label}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl py-12 px-6 flex flex-col items-center text-center">
          <SearchX className="w-6 h-6 text-slate-400 mb-2" />
          {!q && activeFilter !== 'all' ? (
            <>
              <p className="font-semibold text-[#0B1C30]">No {activeLabel} courses yet</p>
              <p className="text-xs text-slate-500 mt-1">New courses for this goal will appear here as soon as they are published.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-[#0B1C30]">No courses match your search</p>
              <p className="text-xs text-slate-500 mt-1">Try another course name or category.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((batch) => (
            <BatchCard key={batch.id} batch={batch} onOpen={() => onOpenBatch(batch.id)} onBuy={() => onBuyBatch(batch.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading / error / empty states for CMS data                         */
/* ------------------------------------------------------------------ */

export function CatalogSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true" role="status" aria-label="Loading courses">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-[0_6px_24px_rgb(0,0,0,0.05)] border border-slate-100 flex flex-col">
          <div className="h-[96px] skeleton-shimmer-dark" />
          <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-3 w-1/3 rounded-full skeleton-shimmer" />
              <div className="h-4 w-4/5 rounded skeleton-shimmer" />
              <div className="h-3 w-1/2 rounded skeleton-shimmer" />
            </div>
            <div className="pt-4 space-y-2">
              <div className="flex justify-between items-center">
                <div className="h-4 w-1/4 rounded skeleton-shimmer" />
                <div className="h-3 w-1/4 rounded skeleton-shimmer" />
              </div>
              <div className="h-9 w-full rounded-xl skeleton-shimmer" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CatalogError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-2xl py-12 px-6 flex flex-col items-center text-center">
      <AlertTriangle className="w-6 h-6 text-amber-500 mb-2" />
      <p className="font-semibold text-[#0B1C30]">Couldn't load courses</p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{message || 'Something went wrong. Please try again.'}</p>
      <button
        onClick={onRetry}
        className="mt-4 flex items-center gap-1.5 bg-[#0B1C20] hover:bg-[#15302F] text-white text-xs font-semibold px-4 py-2 rounded-full transition-all active:scale-95"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Try again
      </button>
    </div>
  );
}

export function CatalogEmpty({ title = 'No courses yet', hint = 'New courses will appear here as soon as they are published.' }: { title?: string; hint?: string }) {
  return (
    <div className="bg-white rounded-2xl py-12 px-6 flex flex-col items-center text-center">
      <BookOpen className="w-6 h-6 text-slate-400 mb-2" />
      <p className="font-semibold text-[#0B1C30]">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </div>
  );
}

/** Catalogue grid with loading / error / empty handling around it. */
export function LiveBatchCatalog({
  status,
  error,
  onRetry,
  ...props
}: BatchCatalogProps & { status: 'loading' | 'ready' | 'error'; error: string | null; onRetry: () => void }) {
  if (status === 'loading' && props.batches.length === 0) return <CatalogSkeleton />;
  if (status === 'error' && props.batches.length === 0) return <CatalogError message={error} onRetry={onRetry} />;
  if (props.batches.length === 0) return <CatalogEmpty />;
  return <BatchCatalog {...props} />;
}

/** Ctrl/Cmd + K focuses the given input. */
export function useSearchShortcut(ref: React.RefObject<HTMLInputElement>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ref]);
}