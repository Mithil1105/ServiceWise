// Booking related types

export type BookingStatus = 'inquiry' | 'tentative' | 'confirmed' | 'ongoing' | 'completed' | 'cancelled';
export type TripType = 'local' | 'outstation' | 'airport' | 'custom' | 'oneway_pickup_drop';
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
  start_odometer_reading?: number | null;
  end_odometer_reading?: number | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingRequestedVehicle {
  id: string;
  booking_id: string;
  brand: string;
  model: string;
  rate_type: RateType;
  rate_total: number | null;
  rate_per_day: number | null;
  rate_per_km: number | null;
  estimated_km: number | null;
  driver_allowance_per_day: number | null;
  advance_amount: number;
  advance_payment_method: 'cash' | 'online' | null;
  advance_collected_by: string | null;
  advance_account_type: 'company' | 'personal' | null;
  advance_account_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingVehicle {
  id: string;
  booking_id: string;
  car_id: string;
  requested_vehicle_id: string | null;
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

export type BillStatus = 'draft' | 'sent' | 'paid';

export interface VehicleBillDetail {
  vehicle_number: string;
  driver_name: string | null;
  driver_phone: string | null;
  rate_type: RateType;
  rate_breakdown: {
    rate_total?: number;
    rate_per_day?: number;
    rate_per_km?: number;
    days?: number;
    km_driven?: number;
    base_amount?: number;
    km_amount?: number;
    final_amount: number;
  };
  final_amount: number;
}

export interface Bill {
  id: string;
  booking_id: string;
  bill_number: string;
  status: BillStatus;
  customer_name: string;
  customer_phone: string;
  start_at: string;
  end_at: string;
  pickup: string | null;
  dropoff: string | null;
  start_odometer_reading: number | null;
  end_odometer_reading: number | null;
  total_km_driven: number;
  km_calculation_method: 'odometer' | 'manual';
  vehicle_details: VehicleBillDetail[];
  total_amount: number;
  advance_amount: number;
  balance_amount: number;
  threshold_note: string | null;
  pdf_file_path: string | null;
  pdf_file_name: string | null;
  created_by: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BillStatus = 'draft' | 'sent' | 'paid';

export interface VehicleBillDetail {
  vehicle_number: string;
  driver_name: string | null;
  driver_phone: string | null;
  rate_type: RateType;
  rate_breakdown: {
    rate_total?: number;
    rate_per_day?: number;
    rate_per_km?: number;
    days?: number;
    km_driven?: number;
    base_amount?: number;
    km_amount?: number;
    final_amount: number;
  };
  final_amount: number;
}

export interface Bill {
  id: string;
  booking_id: string;
  bill_number: string;
  status: BillStatus;
  customer_name: string;
  customer_phone: string;
  start_at: string;
  end_at: string;
  pickup: string | null;
  dropoff: string | null;
  start_odometer_reading: number | null;
  end_odometer_reading: number | null;
  total_km_driven: number;
  km_calculation_method: 'odometer' | 'manual';
  vehicle_details: VehicleBillDetail[];
  total_amount: number;
  advance_amount: number;
  balance_amount: number;
  threshold_note: string | null;
  pdf_file_path: string | null;
  pdf_file_name: string | null;
  created_by: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

// Extended types with relations
export interface BookingWithDetails extends Booking {
  created_by_profile?: { name: string } | null;
  updated_by_profile?: { name: string } | null;
  booking_vehicles?: BookingVehicleWithCar[];
  booking_requested_vehicles?: BookingRequestedVehicle[];
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
  oneway_pickup_drop: 'Oneway/Pickup Drop',
};

export const RATE_TYPE_LABELS: Record<RateType, string> = {
  total: 'Total Amount',
  per_day: 'Per Day',
  per_km: 'Per KM',
  hybrid: 'Hybrid (Per Day + Per KM)',
};

export interface Transfer {
  id: string;
  booking_id: string;
  bill_id: string | null;
  amount: number;
  from_account_type: 'personal' | 'cash';
  from_account_id: string | null;
  collected_by_user_id: string | null;
  collected_by_name: string;
  status: 'pending' | 'completed';
  transfer_date: string | null;
  completed_by_user_id: string | null;
  completed_at: string | null;
  cash_given_to_cashier: boolean;
  cashier_name: string | null;
  reminder_sent_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyBill {
  id: string;
  booking_id: string;
  customer_bill_id: string;
  bill_number: string;
  customer_name: string;
  customer_phone: string;
  start_at: string;
  end_at: string;
  pickup: string | null;
  dropoff: string | null;
  start_odometer_reading: number | null;
  end_odometer_reading: number | null;
  total_km_driven: number;
  km_calculation_method: 'odometer' | 'manual';
  vehicle_details: VehicleBillDetail[];
  total_amount: number;
  total_driver_allowance: number;
  advance_amount: number;
  advance_payment_method: 'cash' | 'online' | null;
  advance_account_type: 'company' | 'personal' | null;
  advance_account_id: string | null;
  advance_collected_by: string | null;
  transfer_requirements: TransferRequirement[];
  internal_notes: string | null;
  threshold_note: string | null;
  pdf_file_path: string | null;
  pdf_file_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferRequirement {
  transfer_id: string;
  amount: number;
  from_account_type: 'personal' | 'cash';
  from_account_name?: string;
  collected_by_name: string;
  status: 'pending' | 'completed';
  transfer_date?: string | null;
  cashier_name?: string | null;
}
