import { cn } from '@/lib/utils';

const recentExpenses = [
  { title: 'Office Supplies', amount: '₱ 1,250.00', status: 'Approved', statusVariant: 'accent' as const, time: 'Today, 2:30 PM' },
  { title: 'Team Lunch', amount: '₱ 3,480.00', status: 'Under Review', statusVariant: 'warning' as const, time: 'Today, 2:30 PM' },
  { title: 'Travel Fare', amount: '₱ 890.00', status: 'Draft', statusVariant: 'muted' as const, time: 'Today, 2:30 PM' },
];

export function MockDashboardLarge({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card shadow-elevated p-4', className)}>
      {/* Header: 3 circles + bar */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-3 h-3 rounded-full bg-destructive" />
        <span className="w-3 h-3 rounded-full bg-warning" />
        <span className="w-3 h-3 rounded-full bg-accent" />
        <span className="flex-1 h-2 rounded bg-muted max-w-[80px] ml-2" />
      </div>

      {/* Grid: 3 metric cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Available Balance</p>
          <p className="text-lg font-semibold text-foreground">₱ 45,230.00</p>
          <p className="text-xs text-accent flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            +12.5% this month
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Pending Approval</p>
          <p className="text-lg font-semibold text-foreground">₱ 8,450.00</p>
          <p className="text-xs text-warning">5 expense reports</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Spent This Month</p>
          <p className="text-lg font-semibold text-foreground">₱ 23,680.00</p>
          <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary animate-progress"
              style={{ ['--progress-width' as string]: '60%' }}
            />
          </div>
        </div>
      </div>

      {/* Recent Expenses */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Recent Expenses</h3>
        <ul className="space-y-3">
          {recentExpenses.map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base" aria-hidden>📝</span>
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-medium text-foreground">{item.amount}</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs',
                    item.statusVariant === 'accent' && 'text-accent',
                    item.statusVariant === 'warning' && 'text-warning',
                    item.statusVariant === 'muted' && 'text-muted-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      item.statusVariant === 'accent' && 'bg-accent',
                      item.statusVariant === 'warning' && 'bg-warning',
                      item.statusVariant === 'muted' && 'bg-muted-foreground'
                    )}
                  />
                  {item.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
