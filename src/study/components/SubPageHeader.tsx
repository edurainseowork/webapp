import React from 'react';
import { ArrowLeft, ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbCrumb {
  label: string;
  onClick?: () => void;
}

export interface SubPageHeaderProps {
  onBack?: () => void;
  crumbs?: BreadcrumbCrumb[];
  rightElement?: React.ReactNode;
  className?: string;
}

export const SubPageHeader: React.FC<SubPageHeaderProps> = ({
  onBack,
  crumbs = [],
  rightElement,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between flex-wrap gap-3 mb-6 ${className}`}>
      <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-2 sm:p-2.5 rounded-xl bg-white/80 hover:bg-white border border-white/80 text-[#175A67] shadow-sm flex items-center justify-center shrink-0 transition-all active:scale-95 hover:shadow cursor-pointer"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 sm:gap-2 text-xs text-[#2A707C] flex-wrap">
            {crumbs.map((crumb, idx) => {
              const isLast = idx === crumbs.length - 1;
              const isFirst = idx === 0;

              if (isLast) {
                return (
                  <div key={idx} className="flex items-center gap-1.5 sm:gap-2">
                    {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#2A707C]/40 shrink-0" />}
                    <span className="font-semibold text-[#175A67] bg-white/70 border border-white/80 backdrop-blur-md px-2.5 py-1 rounded-lg shadow-sm">
                      {crumb.label}
                    </span>
                  </div>
                );
              }

              return (
                <div key={idx} className="flex items-center gap-1.5 sm:gap-2">
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#2A707C]/40 shrink-0" />}
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    disabled={!crumb.onClick}
                    className={`flex items-center gap-1.5 py-1 px-1.5 rounded-md transition-colors ${
                      crumb.onClick
                        ? 'hover:text-[#175A67] hover:bg-white/40 cursor-pointer font-medium'
                        : 'cursor-default font-medium opacity-90'
                    }`}
                  >
                    {isFirst && <Home className="w-3.5 h-3.5 shrink-0" />}
                    <span>{crumb.label}</span>
                  </button>
                </div>
              );
            })}
          </nav>
        )}
      </div>

      {rightElement && <div className="flex items-center gap-2">{rightElement}</div>}
    </div>
  );
};

export default SubPageHeader;
