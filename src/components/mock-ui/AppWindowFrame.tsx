import { cn } from '@/lib/utils';

type AppWindowFrameProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** When true, frame has fixed landscape aspect (screenshot style). When false, height fits content — single view, no scroll. */
  landscape?: boolean;
};

/** Mac-style window frame for mock app screenshots. No scroll inside — everything in single view. */
export function AppWindowFrame({
  title = 'ServiceWise',
  children,
  className,
  landscape = false,
}: AppWindowFrameProps) {
  return (
    <div
      className={cn(
        'w-full max-w-full min-w-0 overflow-hidden',
        'rounded-[20px] sm:rounded-[28px] md:rounded-3xl',
        'border-2 border-slate-700/80',
        'shadow-[0_8px_30px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05),0_4px_0_0_rgba(0,0,0,0.06)]',
        'bg-slate-50 flex flex-col',
        landscape && 'demo-window-landscape',
        className
      )}
      role="img"
      aria-label={`App window: ${title}`}
    >
      {/* Top bar: Mac dots + title */}
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 md:px-5 md:py-3.5 bg-slate-900/95 border-b border-slate-700/50 shrink-0">
        <div className="flex items-center gap-1.5 shrink-0" aria-hidden>
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 rounded-full bg-red-500/90" />
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 rounded-full bg-amber-500/90" />
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 rounded-full bg-emerald-500/90" />
        </div>
        <p className="text-xs sm:text-sm md:text-base font-medium text-slate-200 truncate min-w-0">{title}</p>
      </div>

      {/* Inner content: no scroll — single view only */}
      <div className="bg-white border border-t-0 border-slate-200/80 rounded-b-[18px] sm:rounded-b-[26px] md:rounded-b-[22px] overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
