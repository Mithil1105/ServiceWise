import { cn } from '@/lib/utils';

type AppWindowFrameProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

/** Mac-style window frame for mock app screenshots: title bar with 3 dots, inner content area. */
export function AppWindowFrame({
  title = 'ServiceWise',
  children,
  className,
}: AppWindowFrameProps) {
  return (
    <div
      className={cn(
        'w-full max-w-full overflow-hidden',
        'rounded-[28px] sm:rounded-3xl',
        'border-2 border-slate-700/80',
        'shadow-[0_8px_30px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05),0_4px_0_0_rgba(0,0,0,0.06)]',
        'bg-slate-50',
        className
      )}
      role="img"
      aria-label={`App window: ${title}`}
    >
      {/* Top bar: Mac dots + title */}
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-900/95 border-b border-slate-700/50">
        <div className="flex items-center gap-1.5 shrink-0" aria-hidden>
          <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-red-500/90" />
          <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-amber-500/90" />
          <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-500/90" />
        </div>
        <p className="text-sm sm:text-base font-medium text-slate-200 truncate">{title}</p>
      </div>

      {/* Inner content: white area */}
      <div className="bg-white border border-t-0 border-slate-200/80 rounded-b-[26px] sm:rounded-b-[22px] overflow-hidden min-w-0">
        {children}
      </div>
    </div>
  );
}
