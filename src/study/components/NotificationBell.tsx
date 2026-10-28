import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

interface NotificationBellProps {
  userId?: string;
  batchIds?: string[];
  onNavigate?: (link: string) => void;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  TEST: { bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-700 dark:text-emerald-400', label: 'Test' },
  MOCK: { bg: 'bg-purple-100 dark:bg-purple-950/60', text: 'text-purple-700 dark:text-purple-400', label: 'Mock Test' },
  CONTENT: { bg: 'bg-blue-100 dark:bg-blue-950/60', text: 'text-blue-700 dark:text-blue-400', label: 'Content' },
  DOUBT: { bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-400', label: 'Doubt' },
};

export const NotificationBell: React.FC<NotificationBellProps> = ({
  userId,
  batchIds = [],
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(userId, batchIds);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleItemClick = async (n: (typeof notifications)[0]) => {
    if (userId && !n.readBy?.includes(userId)) {
      await markRead(n.id);
    }
    if (n.link) {
      if (onNavigate) {
        onNavigate(n.link);
      } else {
        window.location.href = n.link;
      }
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-neutral-900 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl backdrop-blur-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead()}
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors flex items-center gap-1 font-medium"
              >
                <Check className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500">No notifications yet</div>
            ) : (
              notifications.map((n) => {
                const isUnread = !userId || !n.readBy?.includes(userId);
                const badge = TYPE_STYLES[n.type] || { bg: 'bg-neutral-100', text: 'text-neutral-600', label: n.type };
                return (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`p-3.5 transition-colors cursor-pointer flex gap-3 ${
                      isUnread
                        ? 'bg-neutral-50/80 dark:bg-neutral-800/40 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/70'
                        : 'hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 opacity-75'
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full ${
                        isUnread ? 'bg-rose-500 ring-2 ring-rose-200 dark:ring-rose-900' : 'bg-transparent'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-800 dark:text-neutral-200 font-medium leading-snug line-clamp-2">
                        {n.message}
                      </p>
                    </div>
                    {n.link && (
                      <ExternalLink className="w-3.5 h-3.5 text-neutral-400 self-center shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
