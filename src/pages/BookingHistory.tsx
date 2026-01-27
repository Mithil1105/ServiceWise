import { useNavigate, useParams } from 'react-router-dom';
import { formatDateTimeFull } from '@/lib/date';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, History, Car, Calendar, DollarSign, FileText, User, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useBooking, useBookingAuditLog } from '@/hooks/use-bookings';
import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge';
import { cn } from '@/lib/utils';
import type { BookingAuditAction } from '@/types/booking';

const ACTION_LABELS: Record<BookingAuditAction, { label: string; icon: typeof History; color: string }> = {
  created: { label: 'Booking Created', icon: FileText, color: 'text-success' },
  updated: { label: 'Details Updated', icon: FileText, color: 'text-blue-500' },
  status_changed: { label: 'Status Changed', icon: History, color: 'text-purple-500' },
  vehicle_assigned: { label: 'Vehicle Assigned', icon: Car, color: 'text-success' },
  vehicle_removed: { label: 'Vehicle Removed', icon: Car, color: 'text-destructive' },
  date_changed: { label: 'Dates Changed', icon: Calendar, color: 'text-warning' },
  rate_changed: { label: 'Rate Changed', icon: DollarSign, color: 'text-blue-500' },
};

export default function BookingHistory() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: booking, isLoading: loadingBooking } = useBooking(id);
  const { data: auditLogs, isLoading: loadingLogs } = useBookingAuditLog(id);

  if (loadingBooking || loadingLogs) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Booking not found</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') {
      if ('vehicle_number' in (value as object)) {
        return (value as { vehicle_number: string }).vehicle_number;
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  const getChangeSummary = (log: typeof auditLogs extends (infer T)[] ? T : never) => {
    const action = log.action as BookingAuditAction;
    const before = log.before as Record<string, unknown> | null;
    const after = log.after as Record<string, unknown> | null;

    switch (action) {
      case 'created':
        return `Booking ${after?.booking_ref || ''} created for ${after?.customer_name}`;
      case 'status_changed':
        return `Status: ${before?.status || '?'} → ${after?.status || '?'}`;
      case 'vehicle_assigned':
        return `Assigned: ${formatValue(after)}`;
      case 'vehicle_removed':
        return `Removed: ${formatValue(before)}`;
      case 'date_changed':
        return `Dates updated`;
      case 'rate_changed':
        return 'Rate details modified';
      case 'updated':
        // Find what changed
        if (before && after) {
          const changes: string[] = [];
          for (const key of Object.keys(after)) {
            if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
              changes.push(key.replace(/_/g, ' '));
            }
          }
          return changes.length > 0 ? `Updated: ${changes.slice(0, 3).join(', ')}` : 'Details updated';
        }
        return 'Details updated';
      default:
        return action;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="page-title">Booking History</h1>
              <BookingStatusBadge status={booking.status} />
            </div>
            <p className="text-sm text-muted-foreground">{booking.booking_ref} • {booking.customer_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/bookings/${id}/edit`)}>
            Edit Booking
          </Button>
          <Button onClick={() => navigate('/bookings/new')}>
            <Plus className="h-4 w-4 mr-1" />
            New Booking
          </Button>
        </div>
      </div>

      {/* Current State Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current State</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Created By</p>
            <p className="font-medium">{booking.created_by_profile?.name || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(booking.created_at), 'dd MMM yyyy, HH:mm')}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Last Updated By</p>
            <p className="font-medium">{booking.updated_by_profile?.name || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground">{formatDateTimeFull(booking.updated_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Vehicles Assigned</p>
            <p className="font-medium">{booking.booking_vehicles?.length || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Status</p>
            <BookingStatusBadge status={booking.status} />
          </div>
        </CardContent>
      </Card>

      {/* Audit Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Change Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs && auditLogs.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              
              <div className="space-y-6">
                {auditLogs.map((log, index) => {
                  const actionConfig = ACTION_LABELS[log.action as BookingAuditAction] || ACTION_LABELS.updated;
                  const Icon = actionConfig.icon;
                  
                  return (
                    <div key={log.id} className="relative pl-10">
                      {/* Timeline dot */}
                      <div className={cn(
                        'absolute left-2 w-4 h-4 rounded-full border-2 bg-background flex items-center justify-center',
                        actionConfig.color.replace('text-', 'border-')
                      )}>
                        <div className={cn('w-2 h-2 rounded-full', actionConfig.color.replace('text-', 'bg-'))} />
                      </div>
                      
                      <div className="bg-muted/30 rounded-lg p-4 border">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon className={cn('h-4 w-4', actionConfig.color)} />
                            <span className="font-medium text-sm">{actionConfig.label}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTimeFull(log.created_at)}
                          </span>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          {getChangeSummary(log)}
                        </p>
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>by {log.actor?.name || 'System'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No changes recorded yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
