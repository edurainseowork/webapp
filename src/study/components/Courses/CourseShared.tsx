import React, { useEffect, useState } from 'react';
import { ChevronRight, CheckCircle2, SearchX, AlertTriangle, RefreshCw, BookOpen, Star } from 'lucide-react';
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

export function BatchCard({ batch, onOpen, onBuy, owned = false }: { batch: Batch; onOpen: () => void; onBuy: () => void; owned?: boolean }) {
  const tone = HEADER_TONES[batch.tone];
  const off = discountPct(batch.price, batch.mrp);
  const paidPlans = (batch.plans ?? []).filter((p) => p.id !== 'basic');
  // Small outlined tag on the right (like a language tag): the course length, else lesson count
  const tag = batch.duration ?? (batch.totalLessons ? `${batch.totalLessons} lessons` : null);
  const meta = batch.features[0];
  // A thumbnail that fails to load falls back to the course name on the tone colour
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!batch.thumbnail && !imgFailed;
  return (
    <article
      onClick={onOpen}
      className="group bg-white rounded-2xl overflow-hidden border border-slate-200/80 hover:border-slate-300 shadow-[0_4px_18px_rgb(0,0,0,0.04)] hover:shadow-[0_14px_36px_rgb(0,0,0,0.10)] transition-all duration-300 cursor-pointer flex flex-col"
    >
      {/* Banner: CMS thumbnail rendered at 184px x 137px */}
      <div className={`relative flex items-center justify-center p-3.5 overflow-hidden ${showImage ? 'bg-gradient-to-b from-[#FFF9F2] to-[#FFF3E3]/60' : tone.header}`}>
        {showImage ? (
          <div className="w-[184px] h-[137px] rounded-xl overflow-hidden shadow-sm relative shrink-0">
            <img
              src={batch.thumbnail!}
              alt={batch.title}
              loading="lazy"
              style={{ width: '184px', height: '137px' }}
              className="w-[184px] h-[137px] object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              onError={() => setImgFailed(true)}
            />
          </div>
        ) : (
          <div className="w-[184px] h-[137px] rounded-xl flex flex-col justify-end p-3 relative">
            <span className={`self-start text-[9px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full ${tone.label}`}>{batch.label}</span>
            <h3 className="text-white font-bold text-base mt-1.5 leading-snug line-clamp-2">{batch.name}</h3>
          </div>
        )}
        {paidPlans.length > 0 && (
          <span className="absolute top-0 inset-x-0 flex items-center justify-center gap-1.5 bg-white/85 backdrop-blur-sm text-[11px] text-[#0B1C30] py-1">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            Multiple plans inside: <span className="font-semibold">{paidPlans.map((p) => p.name).join(', ')}</span>
          </span>
        )}
      </div>

      <div className="px-5 pt-4 pb-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-[#E8590C] truncate">{batch.category}</span>
          {tag && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#40484B] border border-slate-300 rounded-md px-2 py-0.5">{tag}</span>
          )}
        </div>

        <h3 className="text-[17px] font-semibold text-[#0B1C30] mt-1.5 truncate" title={batch.title}>
          {batch.title}
        </h3>

        {meta && (
          <p className="flex items-center gap-2 text-[12px] text-slate-600 mt-2.5 min-w-0">
            <BookOpen className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="truncate">{meta.text}</span>
          </p>
        )}
        <p className="flex items-center gap-2 text-[12px] text-slate-600 mt-1.5">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ring-4 ring-slate-100 ${STATUS_DOTS[batch.status.tone]}`} />
          {batch.status.text}
        </p>

        {/* Price never shrinks under the buttons: when the card is narrow the buttons move to their own line */}
        <div className="mt-auto pt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
          <div className="shrink-0">
            <p className="text-xl font-bold text-[#0B1C30] whitespace-nowrap">{batch.price === 0 ? 'Free' : formatINR(batch.price)}</p>
            {batch.mrp > batch.price && (
              <p className="flex items-baseline gap-1.5 mt-0.5 whitespace-nowrap">
                <span className="text-xs text-slate-400 line-through">{formatINR(batch.mrp)}</span>
                {off > 0 && <span className="text-[12px] font-semibold text-emerald-600">{off}% OFF</span>}
              </p>
            )}
          </div>
          <div className="flex items-stretch gap-1.5 shrink-0 ml-auto">
            {owned ? (
              // Already purchased: no Buy Now; opens the course
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                title="You are enrolled in this course"
                className="flex items-center gap-1.5 whitespace-nowrap bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[13px] font-semibold px-3 py-2 rounded-lg transition-all active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                Enrolled
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBuy();
                }}
                className="whitespace-nowrap bg-[#0B1C20] hover:bg-[#15302F] text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-all active:scale-95"
              >
                Buy Now
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              title="View course details"
              aria-label="View course details"
              className="w-9 shrink-0 rounded-lg border border-slate-300 hover:bg-slate-50 text-[#0B1C30] flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {batch.mrp > batch.price && batch.price > 0 && (
          <p className="relative mt-4 flex items-center gap-2 bg-[#FFF1E6] rounded-lg px-2.5 py-2 text-[12px] text-[#0B1C30] min-w-0">
            <span className="absolute -top-1.5 left-6 w-3 h-3 bg-[#FFF1E6] rotate-45" aria-hidden />
            <span className="relative shrink-0 bg-[#F97316] text-white text-[11px] font-semibold px-2 py-0.5 rounded">Offer</span>
            <span className="relative truncate">Save {formatINR(batch.mrp - batch.price)} on this batch</span>
          </p>
        )}
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
  /** Courses the student already bought show "Enrolled" instead of "Buy Now" */
  isOwned?: (batchId: string) => boolean;
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
  isOwned,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {visible.map((batch) => (
            <BatchCard key={batch.id} batch={batch} owned={isOwned?.(batch.id) ?? false} onOpen={() => onOpenBatch(batch.id)} onBuy={() => onBuyBatch(batch.id)} />
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
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5" aria-busy="true" role="status" aria-label="Loading courses">
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