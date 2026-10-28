import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useCatalog } from './courseData';

const ROTATE_INTERVAL_MS = 5000;

export interface BannerItem {
  id: number;
  imageUrl: string;
  placement: string;
  courseId: number | null;
  title: string | null;
  linkUrl: string | null;
  sortOrder: number;
  createdAt: string;
}

interface BannerCarouselProps {
  placement: 'web_home' | 'courses' | 'purchases';
  onOpenBatch?: (batchId: string) => void;
  className?: string;
}

export function BannerCarousel({ placement, onOpenBatch, className = '' }: BannerCarouselProps) {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const { batches } = useCatalog();

  useEffect(() => {
    let isMounted = true;
    apiFetch<{ success: boolean; data: BannerItem[] }>(`/banners?placement=${placement}`)
      .then((res) => {
        if (isMounted && res.success && Array.isArray(res.data)) {
          setBanners(res.data);
          setActiveIndex(0);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [placement]);

  // Auto-rotate when multiple banners are uploaded
  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % banners.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (!banners.length) return null;

  const currentBanner = banners[activeIndex % banners.length];
  const bannerCourse = currentBanner.courseId
    ? batches.find(
        (b) =>
          Number(b.courseId) === Number(currentBanner.courseId) ||
          String(b.id) === String(currentBanner.courseId)
      )
    : null;

  const handleBannerClick = () => {
    if (bannerCourse && onOpenBatch) {
      onOpenBatch(String(bannerCourse.id));
    } else if (currentBanner.courseId && onOpenBatch) {
      onOpenBatch(String(currentBanner.courseId));
    } else if (currentBanner.linkUrl) {
      window.open(currentBanner.linkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const isClickable = Boolean(bannerCourse || currentBanner.courseId || currentBanner.linkUrl);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-3xl shadow-[0_12px_40px_rgba(15,59,66,0.18)] border border-white/30 group animate-fadeIn ${className}`}
      style={{ aspectRatio: '1200 / 375' }}
    >
      <div
        onClick={handleBannerClick}
        className={`relative w-full h-full ${isClickable ? 'cursor-pointer hover:opacity-95 transition-opacity' : ''}`}
      >
        <img
          src={currentBanner.imageUrl}
          alt={bannerCourse?.title || currentBanner.title || 'EduRain Banner'}
          className="w-full h-full object-cover rounded-3xl block"
        />

        {/* Bottom Glassmorphism Action Bar */}
        {(bannerCourse || currentBanner.title) && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4 sm:p-6 text-white rounded-b-3xl flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              {currentBanner.title && (
                <h2 className="text-lg sm:text-2xl font-bold leading-snug drop-shadow-sm">
                  {currentBanner.title}
                </h2>
              )}
              {bannerCourse && (
                <p className="text-xs sm:text-sm text-white/90 mt-1 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  Target Course: <strong>{bannerCourse.title}</strong>
                </p>
              )}
            </div>

            {bannerCourse && (
              <span className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs bg-[#FAD9B5] hover:bg-[#f8cb9c] text-[#0B1C30] font-bold px-4 py-2 rounded-xl shadow-md transition-all">
                Explore Course &rarr;
              </span>
            )}
          </div>
        )}
      </div>

      {/* Slide Indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-3 right-4 flex items-center gap-1.5 z-10 bg-black/40 backdrop-blur-md px-2.5 py-1.5 rounded-full">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(idx);
              }}
              className={`h-1.5 rounded-full transition-all ${
                idx === activeIndex % banners.length ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
              }`}
              title={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
