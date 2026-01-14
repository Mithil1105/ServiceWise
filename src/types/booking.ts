// Booking related types

export type BookingStatus = 'inquiry' | 'tentative' | 'confirmed' | 'ongoing' | 'completed' | 'cancelled';
export type TripType = 'local' | 'outstation' | 'airport' | 'custom';
export type RateType = 'total' | 'per_day' | 'per_km' | 'hybrid';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type BookingAuditAction = 'created' | 'updated' | 'status_changed' | 'vehicle_assigned' | 'vehicle_removed' | 'date_changed' | 'rate_changed';

export interface Booking {
  id: string;
  booking_ref: string;
  status: BookingStatus;
  customer_name: string;
  customer_phone: string;
  trip_type: TripType;
  start_at: string;
  end_at: string;
  pickup: string | null;
  dropoff: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingVehicle {
  id: string;
  booking_id: string;
  car_id: string;
  driver_name: string | null;
  driver_phone: string | null;
  rate_type: RateType;
  rate_total: number | null;
  rate_per_day: number | null;
  rate_per_km: number | null;
  estimated_km: number | null;
  final_km: number | null;
  computed_total: number | null;
  advance_amount: number;
  payment_status: PaymentStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingAuditLog {
  id: string;
  booking_id: string;
  action: BookingAuditAction;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
}

export interface TentativeHold {
  id: string;
  booking_id: string;
  expires_at: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  booking_id: string;
  invoice_no: string;
  amount_total: number;
  advance_amount: number;
  amount_due: number;
  issued_at: string;
  created_by: string | null;
  created_at: string;
}

// Extended types with relations
export interface BookingWithDetails extends Booking {
  created_by_profile?: { name: string } | null;
  updated_by_profile?: { name: string } | null;
  booking_vehicles?: BookingVehicleWithCar[];
}

export interface BookingVehicleWithCar extends BookingVehicle {
  car?: { 
    id: string;
    vehicle_number: string; 
    model: string; 
  } | null;
  created_by_profile?: { name: string } | null;
  updated_by_profile?: { name: string } | null;
}

export interface AvailableCar {
  car_id: string;
  vehicle_number: string;
  model: string;
  is_available: boolean;
  conflict_booking_ref: string | null;
  conflict_start: string | null;
  conflict_end: string | null;
  conflict_booked_by: string | null;
}

// Form types
export interface BookingFormData {
  customer_name: string;
  customer_phone: string;
  trip_type: TripType;
  start_at: Date;
  end_at: Date;
  pickup: string;
  dropoff: string;
  notes: string;
}

export interface VehicleAssignmentFormData {
  car_id: string;
  driver_name: string;
  driver_phone: string;
  rate_type: RateType;
  rate_total: number | null;
  rate_per_day: number | null;
  rate_per_km: number | null;
  estimated_km: number | null;
  advance_amount: number;
}

// Calendar event type
export interface CalendarBookingEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: BookingStatus;
  booking: BookingWithDetails;
}

// Status colors mapping
export const BOOKING_STATUS_COLORS: Record<BookingStatus, { bg: string; text: string; border: string }> = {
  inquiry: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-muted-foreground/30' },
  tentative: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
  confirmed: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/30' },
  ongoing: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/30' },
  completed: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
  cancelled: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-muted-foreground/30' },
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  inquiry: 'Inquiry',
  tentative: 'Tentative',
  confirmed: 'Confirmed',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  local: 'Local',
  outstation: 'Outstation',
  airport: 'Airport',
  custom: 'Custom',
};

export const RATE_TYPE_LABELS: Record<RateType, string> = {
  total: 'Total Amount',
  per_day: 'Per Day',
  per_km: 'Per KM',
  hybrid: 'Hybrid (Per Day + Per KM)',
};
