export type AppRole = 'admin' | 'manager' | 'supervisor';

export interface Profile {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
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
  model: string;
  year?: number;
  fuel_type?: string;
  seats?: number;
  status: 'active' | 'inactive';
  vin_chassis?: string;
  notes?: string;
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

export interface ServiceRule {
  id: string;
  name: string;
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
  type: 'odometer' | 'service' | 'expense' | 'incident' | 'downtime';
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
  reason: 'service' | 'breakdown' | 'accident' | 'other';
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
  type: 'breakdown' | 'overheating' | 'puncture' | 'towing' | 'accident' | 'other';
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
