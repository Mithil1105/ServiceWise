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
  customFields?: FleetNewCarCustomField[];
  documentTypes?: Partial<Record<FleetNewCarDocumentTypeKey, DocumentTypeConfig>>;
}

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
  customFields?: FleetNewCarCustomField[]; // same shape: id, key, label, type, required, order, options
}

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

export interface BookingFormConfig {
  fieldOverrides?: Partial<Record<BookingFormBuiltInFieldKey, FieldOverride>>;
  customFields?: FleetNewCarCustomField[];
}

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
