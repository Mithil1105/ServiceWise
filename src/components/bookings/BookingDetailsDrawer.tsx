import { formatDateTimeFull, formatDateOnly } from '@/lib/date';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  Phone, 
  MapPin, 
  User, 
  Car, 
  Clock,
  Edit,
  FileText,
  History,
  Users,
  Gauge,
  AlertTriangle,
  Receipt,
  Calculator
} from 'lucide-react';
import { BookingStatusBadge } from './BookingStatusBadge';
import { GenerateBillDialog } from './GenerateBillDialog';
import { 
  type BookingWithDetails, 
  TRIP_TYPE_LABELS,
  RATE_TYPE_LABELS 
} from '@/types/booking';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

interface BookingDetailsDrawerProps {
  booking: BookingWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  onViewInvoice?: () => void;
  onViewHistory?: () => void;
}

export function BookingDetailsDrawer({ 
  booking, 
  open, 
  onOpenChange,
  onEdit,
  onViewInvoice,
  onViewHistory 
}: BookingDetailsDrawerProps) {
  const [generateBillOpen, setGenerateBillOpen] = useState(false);
  
  // Fetch incidents for cars in this booking during the trip period
  const { data: incidents } = useQuery({
    queryKey: ['booking-incidents', booking?.id],
    queryFn: async () => {
      if (!booking || !booking.booking_vehicles?.length) return [];
      
      const carIds = booking.booking_vehicles.map(v => v.car_id);
      
      const { data, error } = await supabase
        .from('incidents')
        .select('*, car:cars(vehicle_number)')
        .in('car_id', carIds)
        .gte('incident_at', booking.start_at)
        .lte('incident_at', booking.end_at);
      
      if (error) return [];
      return data;
    },
    enabled: !!booking?.id && open,
  });

  if (!booking) return null;

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (date: string) => {
    return formatDateTimeFull(date);
  };

  const totalAmount = booking.booking_vehicles?.reduce(
    (sum, v) => sum + (v.computed_total || v.rate_total || 0), 
    0
  ) || 0;

  const totalAdvance = booking.booking_vehicles?.reduce(
    (sum, v) => sum + (v.advance_amount || 0), 
    0
  ) || 0;

  const totalEstimatedKm = booking.booking_vehicles?.reduce(
    (sum, v) => sum + (v.estimated_km || 0),
    0
  ) || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-1">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-lg">{booking.booking_ref}</SheetTitle>
            <BookingStatusBadge status={booking.status} />
          </div>
          <SheetDescription>
            {TRIP_TYPE_LABELS[booking.trip_type]} Trip
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Customer Info */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Customer</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{booking.customer_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${booking.customer_phone}`} className="text-primary hover:underline">
                  {booking.customer_phone}
                </a>
              </div>
            </div>
          </div>

          <Separator />

          {/* Trip Details */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Trip Details</h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm">{formatDateTime(booking.start_at)}</p>
                  <p className="text-xs text-muted-foreground">to</p>
                  <p className="text-sm">{formatDateTime(booking.end_at)}</p>
                </div>
              </div>
              {booking.pickup && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-success" />
                  <span className="text-sm">Pickup: {booking.pickup}</span>
                </div>
              )}
              {booking.dropoff && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-destructive" />
                  <span className="text-sm">Drop: {booking.dropoff}</span>
                </div>
              )}
              {totalEstimatedKm > 0 && (
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Estimated: {totalEstimatedKm.toLocaleString()} KM</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Assigned Vehicles */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">
              Assigned Vehicles ({booking.booking_vehicles?.length || 0})
            </h4>
            {booking.booking_vehicles && booking.booking_vehicles.length > 0 ? (
              <div className="space-y-3">
                {booking.booking_vehicles.map((vehicle) => (
                  <div 
                    key={vehicle.id} 
                    className="p-3 bg-muted/30 rounded-lg border space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {vehicle.car?.vehicle_number || 'Unknown'}
                        </span>
                        {(vehicle.car as any)?.seats && (
                          <span className="inline-flex items-center gap-0.5 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            <Users className="h-3 w-3" /> {(vehicle.car as any).seats}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-primary">
                        {formatCurrency(vehicle.computed_total || vehicle.rate_total)}
                      </span>
                    </div>
                    {vehicle.car?.model && (
                      <p className="text-xs text-muted-foreground">{vehicle.car.model}</p>
                    )}
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Rate: {RATE_TYPE_LABELS[vehicle.rate_type]}</p>
                      {vehicle.driver_name && <p>Driver: {vehicle.driver_name}</p>}
                      {vehicle.estimated_km && vehicle.estimated_km > 0 && (
                        <p>Est. KM: {vehicle.estimated_km.toLocaleString()}</p>
                      )}
                      <p>Advance: {formatCurrency(vehicle.advance_amount)}</p>
                    </div>
                    {vehicle.created_by_profile && (
                      <p className="text-xs text-muted-foreground">
                        Assigned by: {vehicle.created_by_profile.name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No vehicles assigned yet</p>
            )}
          </div>

          {/* Incidents during trip */}
          {incidents && incidents.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Incidents During Trip ({incidents.length})
                </h4>
                <div className="space-y-2">
                  {incidents.map((incident) => (
                    <div key={incident.id} className="p-2 bg-destructive/10 rounded-lg border border-destructive/20 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{incident.type}</span>
                        <Badge variant={incident.severity === 'high' ? 'destructive' : 'outline'} className="text-xs">
                          {incident.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(incident.car as any)?.vehicle_number} • {formatDateOnly(incident.incident_at)}
                      </p>
                      {incident.description && (
                        <p className="text-xs mt-1">{incident.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Rate Summary */}
          {booking.booking_vehicles && booking.booking_vehicles.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2 p-3 bg-primary/5 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Total Amount</span>
                  <span className="font-medium">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Advance Paid</span>
                  <span className="font-medium text-success">{formatCurrency(totalAdvance)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Due Amount</span>
                  <span className="text-primary">{formatCurrency(totalAmount - totalAdvance)}</span>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Traceability Info */}
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>
                Booked by: {booking.created_by_profile?.name || 'Unknown'} on{' '}
                {formatDateTimeFull(booking.created_at)}
              </span>
            </div>
            {booking.updated_by_profile && (
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>
                  Last updated by: {booking.updated_by_profile.name} on{' '}
                  {formatDateTimeFull(booking.updated_at)}
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          {booking.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Notes</h4>
                <p className="text-sm whitespace-pre-wrap">{booking.notes}</p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            {onEdit && (
              <Button onClick={onEdit} className="flex-1">
                <Edit className="h-4 w-4 mr-2" />
                Edit Booking
              </Button>
            )}
            {['ongoing', 'completed'].includes(booking.status) && (
              <Button variant="outline" onClick={() => setGenerateBillOpen(true)}>
                <Calculator className="h-4 w-4 mr-2" />
                Generate Bill
              </Button>
            )}
            {onViewInvoice && ['confirmed', 'ongoing', 'completed'].includes(booking.status) && (
              <Button variant="outline" onClick={onViewInvoice}>
                <Receipt className="h-4 w-4 mr-2" />
                Bills
              </Button>
            )}
            {onViewHistory && (
              <Button variant="ghost" size="icon" onClick={onViewHistory}>
                <History className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>

      {/* Generate Bill Dialog */}
      {booking && (
        <GenerateBillDialog
          bookingId={booking.id}
          open={generateBillOpen}
          onOpenChange={setGenerateBillOpen}
          onSuccess={() => {
            setGenerateBillOpen(false);
            onViewInvoice?.();
          }}
        />
      )}
    </Sheet>
  );
}
