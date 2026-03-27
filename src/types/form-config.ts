/**
 * Per-organization form configuration (e.g. Fleet → New car form).
 * Stored in organization_settings.fleet_new_car_form_config.
 */

export type FleetNewCarBuiltInFieldKey =
  | 'owner_name'
  | 'vehicle_type'
  | 'vehicle_class'
  | 'vehicle_number'
  | 'brand'
  | 'model'
  | 'year'
  | 'fuel_type'
  | 'seats'
  | 'initial_odometer'
  | 'vin_chassis'
  | 'notes';

export type FleetNewCarDocumentTypeKey = 'rc' | 'puc' | 'insurance' | 'warranty' | 'permits' | 'fitness';

export type CustomFieldType = 'text' | 'number' | 'date' | 'select';

export interface FieldOverride {
  required?: boolean;
  hidden?: boolean;
  label?: string;
}

export interface FleetNewCarCustomField {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  order: number;
  options?: string[]; // for type === 'select'
}

export interface DocumentTypeConfig {
  show?: boolean;
  required?: boolean;
  label?: string;
}

export interface FleetNewCarFormConfig {
  fieldOverrides?: Partial<Record<FleetNewCarBuiltInFieldKey, FieldOverride>>;
  documentTypes?: Partial<Record<FleetNewCarDocumentTypeKey, DocumentTypeConfig>>;
  /** Category (private/commercial). */
  vehicleTypeOptions?: SelectOption[];
  /** Type of vehicle (LMV/HMV). */
  vehicleClassOptions?: SelectOption[];
  /** Fuel type dropdown. */
  fuelTypeOptions?: SelectOption[];
  /** Seats dropdown. */
  seatsOptions?: SelectOption[];
  customFields?: FleetNewCarCustomField[];
}

export const DEFAULT_VEHICLE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'private', label: 'Private' },
  { value: 'commercial', label: 'Commercial' },
];

export const DEFAULT_VEHICLE_CLASS_OPTIONS: SelectOption[] = [
  { value: 'lmv', label: 'LMV (Light Motor Vehicle)' },
  { value: 'hmv', label: 'HMV (Heavy Motor Vehicle)' },
];

export const DEFAULT_FUEL_TYPE_OPTIONS: SelectOption[] = [
  { value: 'Petrol', label: 'Petrol' },
  { value: 'Diesel', label: 'Diesel' },
  { value: 'CNG', label: 'CNG' },
  { value: 'Electric', label: 'Electric' },
  { value: 'Hybrid', label: 'Hybrid' },
];

export const DEFAULT_SEATS_OPTIONS: SelectOption[] = [
  { value: '4', label: '4 Seater' },
  { value: '5', label: '5 Seater' },
  { value: '6', label: '6 Seater' },
  { value: '7', label: '7 Seater' },
  { value: '8', label: '8 Seater' },
  { value: '9+', label: '9+ Seater' },
];

/** Default labels for built-in fields (used when no override in config). */
export const FLEET_NEW_CAR_FIELD_LABELS: Record<FleetNewCarBuiltInFieldKey, string> = {
  owner_name: 'Owner Name',
  vehicle_type: 'Category',
  vehicle_class: 'Type of Vehicle',
  vehicle_number: 'Vehicle Number',
  model: 'Model',
  brand: 'Brand',
  year: 'Year',
  fuel_type: 'Fuel Type',
  seats: 'Number of Seats',
  initial_odometer: 'Initial Odometer (km)',
  vin_chassis: 'VIN / Chassis Number',
  notes: 'Notes',
};

/** Default labels for document types. */
export const FLEET_NEW_CAR_DOC_LABELS: Record<FleetNewCarDocumentTypeKey, string> = {
  rc: 'RC Book',
  puc: 'PUC Certificate',
  insurance: 'Insurance',
  warranty: 'Warranty',
  permits: 'Permits',
  fitness: 'Fitness Certificate',
};

// ---------------------------------------------------------------------------
// Driver form config (Add/Edit Driver). Stored in organization_settings.drivers_form_config.
// ---------------------------------------------------------------------------

export type DriverFormBuiltInFieldKey =
  | 'name'
  | 'phone'
  | 'location'
  | 'region'
  | 'license_type'
  | 'license_expiry'
  | 'license_file'
  | 'driver_type'
  | 'aadhaar_file'
  | 'police_verification_file'
  | 'health_certificate_file'
  | 'notes';

export interface DriverFormConfig {
  fieldOverrides?: Partial<Record<DriverFormBuiltInFieldKey, FieldOverride>>;
  /** License type (LMV/HMV). */
  licenseTypeOptions?: SelectOption[];
  /** Driver type (Permanent/Temporary). */
  driverTypeOptions?: SelectOption[];
  customFields?: FleetNewCarCustomField[]; // same shape: id, key, label, type, required, order, options
}

export const DEFAULT_LICENSE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'lmv', label: 'LMV (Light Motor Vehicle)' },
  { value: 'hmv', label: 'HMV (Heavy Motor Vehicle)' },
];

export const DEFAULT_DRIVER_TYPE_OPTIONS: SelectOption[] = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'temporary', label: 'Temporary' },
];

export const DRIVER_FORM_FIELD_LABELS: Record<DriverFormBuiltInFieldKey, string> = {
  name: 'Name',
  phone: 'Phone',
  location: 'Location',
  region: 'Region',
  license_type: 'License Type',
  license_expiry: 'License Expiry Date',
  license_file: 'Driving License (PDF/Image)',
  driver_type: 'Driver type',
  aadhaar_file: 'Aadhaar card',
  police_verification_file: 'Police verification',
  health_certificate_file: 'Health certificate',
  notes: 'Notes',
};

// ---------------------------------------------------------------------------
// Booking form config (New Booking). Stored in organization_settings.booking_form_config.
// ---------------------------------------------------------------------------

export type BookingFormBuiltInFieldKey =
  | 'customer_name'
  | 'customer_phone'
  | 'trip_type'
  | 'start_date'
  | 'start_time'
  | 'end_date'
  | 'end_time'
  | 'pickup'
  | 'dropoff'
  | 'estimated_km'
  | 'notes'
  | 'status'
  | 'advance_amount'
  | 'advance_payment_method';

/** Option for dropdowns (value stored in DB, label shown in UI). */
export interface SelectOption {
  value: string;
  label: string;
}

export interface BookingFormConfig {
  fieldOverrides?: Partial<Record<BookingFormBuiltInFieldKey, FieldOverride>>;
  /** Customizable options for Trip Type dropdown. If empty/undefined, defaults are used. */
  tripTypeOptions?: SelectOption[];
  /** Supervisor booking assignment mode. Project mode is default; legacy keeps direct car assignment behavior. */
  supervisorAssignmentMode?: 'project' | 'legacy';
  customFields?: FleetNewCarCustomField[];
}

/** Default trip type options when none are configured. */
export const DEFAULT_TRIP_TYPE_OPTIONS: SelectOption[] = [
  { value: 'local', label: 'Local' },
  { value: 'outstation', label: 'Outstation' },
  { value: 'airport', label: 'Airport' },
  { value: 'custom', label: 'Custom' },
  { value: 'oneway_pickup_drop', label: 'Oneway/Pickup Drop' },
];

export const BOOKING_FORM_FIELD_LABELS: Record<BookingFormBuiltInFieldKey, string> = {
  customer_name: 'Customer Name',
  customer_phone: 'Customer Phone',
  trip_type: 'Trip Type',
  start_date: 'Start Date',
  start_time: 'Start Time',
  end_date: 'End Date',
  end_time: 'End Time',
  pickup: 'Pickup',
  dropoff: 'Drop-off',
  estimated_km: 'Estimated KM',
  notes: 'Notes',
  status: 'Status',
  advance_amount: 'Advance Amount',
  advance_payment_method: 'Advance Payment Method',
};

// ---------------------------------------------------------------------------
// Service Record form config (Add Service Record). Stored in organization_settings.service_record_form_config.
// ---------------------------------------------------------------------------

export type ServiceRecordFormBuiltInFieldKey =
  | 'car_id'
  | 'rule_id'
  | 'service_name'
  | 'serviced_at'
  | 'odometer_km'
  | 'cost'
  | 'vendor_name'
  | 'vendor_location'
  | 'notes';

export type ServiceRecordWarrantyFieldKey = 'warranty_part_name' | 'warranty_serial_number' | 'warranty_expiry';

export interface WarrantySectionConfig {
  show?: boolean;
  sectionLabel?: string;
  fieldOverrides?: Partial<Record<ServiceRecordWarrantyFieldKey, FieldOverride>>;
}

export interface BillsSectionConfig {
  show?: boolean;
  required?: boolean;
  label?: string;
}

export interface ServiceRecordFormConfig {
  fieldOverrides?: Partial<Record<ServiceRecordFormBuiltInFieldKey, FieldOverride>>;
  warrantySection?: WarrantySectionConfig;
  billsSection?: BillsSectionConfig;
  customFields?: FleetNewCarCustomField[];
}

export const SERVICE_RECORD_FORM_FIELD_LABELS: Record<ServiceRecordFormBuiltInFieldKey, string> = {
  car_id: 'Vehicle',
  rule_id: 'Service Type',
  service_name: 'Service Name',
  serviced_at: 'Service Date',
  odometer_km: 'Odometer at Service (km)',
  cost: 'Total Cost (₹)',
  vendor_name: 'Vendor / Garage Name',
  vendor_location: 'Vendor Location',
  notes: 'Notes',
};

export const SERVICE_RECORD_WARRANTY_FIELD_LABELS: Record<ServiceRecordWarrantyFieldKey, string> = {
  warranty_part_name: 'Part/Item Name',
  warranty_serial_number: 'Serial Number',
  warranty_expiry: 'Warranty Expiry',
};

// ---------------------------------------------------------------------------
// Downtime form config (Add Downtime). Stored in organization_settings.downtime_form_config.
// ---------------------------------------------------------------------------

export type DowntimeFormBuiltInFieldKey = 'car_id' | 'reason' | 'notes' | 'estimated_uptime_at';

/** Option for the Reason dropdown (value stored in DB, label shown in UI). */
export interface DowntimeReasonOption {
  value: string;
  label: string;
}

export interface DowntimeFormConfig {
  fieldOverrides?: Partial<Record<DowntimeFormBuiltInFieldKey, FieldOverride>>;
  /** Customizable options for the Reason dropdown. If empty/undefined, defaults are used. */
  reasonOptions?: DowntimeReasonOption[];
  customFields?: FleetNewCarCustomField[];
}

export const DOWNTIME_FORM_FIELD_LABELS: Record<DowntimeFormBuiltInFieldKey, string> = {
  car_id: 'Vehicle',
  reason: 'Reason',
  notes: 'Notes',
  estimated_uptime_at: 'Estimated return to road',
};

/** Default options for the Reason dropdown when none are configured. */
export const DEFAULT_DOWNTIME_REASON_OPTIONS: DowntimeReasonOption[] = [
  { value: 'service', label: 'Service' },
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'accident', label: 'Accident' },
  { value: 'other', label: 'Other' },
];

// ---------------------------------------------------------------------------
// Incident form config (Log Incident). Stored in organization_settings.incident_form_config.
// ---------------------------------------------------------------------------

export type IncidentFormBuiltInFieldKey =
  | 'car_id'
  | 'incident_at'
  | 'estimated_return_at'
  | 'attachment'
  | 'type'
  | 'severity'
  | 'description'
  | 'location'
  | 'cost'
  | 'driver_name';

export interface IncidentFormConfig {
  fieldOverrides?: Partial<Record<IncidentFormBuiltInFieldKey, FieldOverride>>;
  customFields?: FleetNewCarCustomField[];
}

export const INCIDENT_FORM_FIELD_LABELS: Record<IncidentFormBuiltInFieldKey, string> = {
  car_id: 'Vehicle',
  incident_at: 'Incident Date & Time',
  estimated_return_at: 'Est. Return to Road',
  attachment: 'Attachment',
  type: 'Type',
  severity: 'Severity',
  description: 'Description',
  location: 'Location',
  cost: 'Cost (₹)',
  driver_name: 'Driver Name',
};

// ---------------------------------------------------------------------------
// Fuel entry form config (Log Fuel). Stored in organization_settings.fuel_entry_form_config.
// ---------------------------------------------------------------------------

export type FuelEntryFormBuiltInFieldKey =
  | 'fuel_type'
  | 'odometer_km'
  | 'fuel_liters'
  | 'amount_inr'
  | 'is_full_tank'
  | 'notes'
  | 'bill_upload';

export interface FuelEntryFormConfig {
  fieldOverrides?: Partial<Record<FuelEntryFormBuiltInFieldKey, FieldOverride>>;
}

export const FUEL_ENTRY_FORM_FIELD_LABELS: Record<FuelEntryFormBuiltInFieldKey, string> = {
  fuel_type: 'Fuel Type',
  odometer_km: 'Odometer (km)',
  fuel_liters: 'Liters',
  amount_inr: 'Amount (INR)',
  is_full_tank: 'Full tank fill?',
  notes: 'Notes',
  bill_upload: 'Fuel bill (optional)',
};
