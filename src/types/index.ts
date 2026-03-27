export type AppRole = 'admin' | 'manager' | 'supervisor' | 'fuel_filler';

export interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
  company_name: string | null;
  join_code?: string;
}

export interface Profile {
  id: string;
  name: string;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  /** Phase 6: false when org admin deactivated the user */
  is_active?: boolean;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Car {
  id: string;
  vehicle_number: string;
  brand?: string;
  model: string;
  year?: number;
  fuel_type?: string;
  allowed_fuel_types?: string[] | null;
  seats?: number;
  vehicle_type?: 'private' | 'commercial';
  vehicle_class?: 'lmv' | 'hmv';
  owner_name?: string;
  status: 'active' | 'inactive';
  vin_chassis?: string;
  notes?: string;
  /** When true, vehicle is excluded from booking assignment and check availability */
  on_permanent_assignment?: boolean;
  /** Optional: who or what this vehicle is assigned to (e.g. driver name, CEO car) */
  permanent_assignment_note?: string | null;
  /** Org-defined custom field values (from fleet_new_car_form_config.customFields) */
  custom_attributes?: Record<string, string | number | boolean | null>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface OdometerEntry {
  id: string;
  car_id: string;
  odometer_km: number;
  reading_at: string;
  entered_by?: string;
  created_at: string;
}

// Fuel fills logged by fuel fillers/admins
export interface FuelEntry {
  id: string;
  organization_id: string;
  car_id: string;
  filled_at: string;
  odometer_km: number;
  fuel_liters: number;
  amount_inr: number;
  fuel_type: 'petrol' | 'diesel' | 'cng' | 'electric' | string;
  is_full_tank: boolean;
  notes?: string;
  entered_by?: string;
  created_at: string;
}

export interface FuelEntryBill {
  id: string;
  organization_id: string;
  fuel_entry_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

export interface ServiceRule {
  id: string;
  name: string;
  brand?: string | null;
  interval_km?: number;
  interval_days?: number;
  is_critical: boolean;
  due_soon_threshold_km?: number;
  due_soon_threshold_days?: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CarServiceRule {
  id: string;
  car_id: string;
  rule_id: string;
  enabled: boolean;
  last_serviced_km?: number;
  last_serviced_at?: string;
  created_at: string;
  service_rules?: ServiceRule;
}

export interface ServiceRecord {
  id: string;
  car_id: string;
  rule_id?: string;
  service_name: string;
  serviced_at: string;
  odometer_km: number;
  vendor_name?: string;
  vendor_location?: string;
  cost?: number;
  notes?: string;
  bill_path?: string;
  entered_by?: string;
  created_at: string;
}

export interface UserSnooze {
  id: string;
  user_id: string;
  snooze_until: string;
  created_at: string;
}

export interface CarWithStatus extends Car {
  current_km: number;
  next_critical_status: 'ok' | 'due-soon' | 'overdue';
  next_critical_info?: {
    service_name: string;
    due_km: number;
    remaining_km: number;
  };
}

export interface CriticalServiceItem {
  car_id: string;
  vehicle_number: string;
  model?: string | null;
  brand?: string | null;
  service_name: string;
  current_km: number;
  due_km: number;
  remaining_km: number;
  last_serviced_km?: number;
  last_serviced_at?: string;
  status: 'overdue' | 'due-soon';
}

export interface TimelineItem {
  id: string;
  type: 'odometer' | 'service' | 'expense' | 'fuel' | 'incident' | 'downtime';
  date: string;
  title: string;
  description?: string;
  details?: Record<string, any>;
  source: 'Fleet' | 'PettyCash';
}

export interface ExternalExpense {
  id: string;
  date: string;
  category: string;
  amount: number;
  vendor?: string;
  notes?: string;
  source: 'PettyCash';
}

// Downtime tracking
export interface DowntimeLog {
  id: string;
  car_id: string;
  started_at: string;
  ended_at?: string | null;
  estimated_uptime_at?: string | null;
  reason: string;
  notes?: string;
  source: 'manual' | 'system';
  created_by?: string;
  created_at: string;
}

// Incidents
export interface Incident {
  id: string;
  car_id: string;
  incident_at: string;
  estimated_return_at?: string | null;
  type: 'breakdown' | 'overheating' | 'puncture' | 'towing' | 'accident' | 'other' | 'traffic_challan';
  severity: 'low' | 'medium' | 'high';
  description?: string;
  location?: string;
  cost?: number;
  driver_name?: string;
  resolved: boolean;
  resolved_at?: string | null;
  resolved_notes?: string;
  created_by?: string;
  created_at: string;
}

// Traffic challan types (org-defined)
export interface ChallanType {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

// Traffic challan record (linked to incident when logged from incident form)
export interface TrafficChallan {
  id: string;
  organization_id: string;
  incident_id: string | null;
  car_id: string;
  driver_name: string | null;
  driver_phone: string | null;
  challan_type_id: string | null;
  amount: number;
  incident_at: string;
  location: string | null;
  description: string | null;
  created_at: string;
  created_by: string | null;
}

// Car notes
export interface CarNote {
  id: string;
  car_id: string;
  note: string;
  pinned: boolean;
  created_by?: string;
  created_at: string;
}

// System config
export interface SystemConfig {
  id: string;
  key: string;
  value: any;
  updated_at: string;
}

// Dashboard attention items
export interface AttentionItem {
  id: string;
  type: 'overdue' | 'due-soon' | 'downtime' | 'incident' | 'stale-odometer';
  title: string;
  description: string;
  car_id?: string;
  vehicle_number?: string;
  actionLabel: string;
  actionLink: string;
  priority: number;
}

// Monthly snapshot
export interface MonthlySnapshot {
  kmDriven: number;
  kmWarning?: string;
  servicesCompleted: number;
  criticalAlerts: number;
  expenses: number;
}

// Utilization data
export interface CarUtilization {
  car_id: string;
  vehicle_number: string;
  usage_30d_km: number | null;
  label: 'over-used' | 'under-used' | 'normal' | 'insufficient-data';
}

// High maintenance flag
export interface HighMaintenanceData {
  maintenance_cost_180d: number;
  downtime_days_90d: number;
  incidents_180d: number;
  isHighMaintenance: boolean;
}

// Total booking days per car (for fleet overview; only non–permanently-assigned cars)
export interface CarBookingDays {
  car_id: string;
  total_booking_days: number;
}
