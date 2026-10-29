import React from 'react';
import { X, Bell, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { NotificationItem } from '../../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onMarkRead?: (id: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onMarkRead,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-[#EAE3DE]/95 backdrop-blur-2xl border-l border-[#175A67]/25 shadow-2xl p-5 sm:p-6 flex flex-col justify-between z-10">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#175A67]/15 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#175A67] text-white">
                <Bell className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#175A67]">Intel Notifications</h2>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/60 hover:bg-white text-[#175A67] transition-colors shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="text-[#2A707C] font-semibold">{notifications.length} updates</span>
            <button
              onClick={onMarkAllRead}
              className="text-[#175A67] font-bold hover:underline"
            >
              Mark all as read
            </button>
          </div>

          {/* List */}
          <div className="space-y-3 overflow-y-auto max-h-[72vh] no-scrollbar pr-1">
            {notifications.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/40 border border-[#175A67]/15 text-center text-xs text-[#2A707C]">
                No notifications yet. Important updates from your courses and mentors will appear here.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => onMarkRead?.(n.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    n.read
                      ? 'bg-white/40 border-[#175A67]/15 opacity-80'
                      : 'bg-white/75 border-[#175A67]/35 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {!n.read && <span className="w-2 h-2 rounded-full bg-[#10B981] shrink-0" />}
                      <h4 className="font-bold text-[#175A67] text-xs sm:text-sm leading-tight">{n.title}</h4>
                    </div>
                    <span className="text-[10px] text-[#2A707C] shrink-0">{n.time}</span>
                  </div>
                  <p className="text-xs text-[#2A707C] mt-1.5 leading-normal whitespace-pre-line">{n.description}</p>
                  {n.imageUrl && (
                    <img
                      src={n.imageUrl}
                      alt=""
                      className="mt-2.5 w-full max-h-40 object-cover rounded-xl border border-[#175A67]/15"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  {n.link && (
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-[#175A67] hover:underline"
                    >
                      {n.linkLabel ?? 'Open Link'} &rarr;
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-[#175A67] text-white font-bold text-xs hover:bg-[#124853] transition-all"
        >
          Close Notifications
        </button>
      </div>
    </div>
  );
};
