/**
 * Billing layout configuration: show/hide built-in sections, labels, and custom blocks.
 * Stored in organization_settings.billing_layout_config.
 * Option "use same layout for company bills" applies one config to both customer and company bills.
 */

export type BillingBuiltInSectionKey =
  | 'header'
  | 'trip_km_details'
  | 'billed_to'
  | 'company_details'
  | 'vehicle_table'
  | 'totals'
  | 'qr_code'
  | 'terms'
  | 'footer';

export type BillingCustomBlockPosition =
  | 'after_customer_details'
  | 'after_vehicle_table'
  | 'before_totals'
  | 'after_totals'
  | 'before_terms'
  | 'before_footer';

export type BillingCustomBlockType =
  | 'short_text'
  | 'number'
  | 'date'
  | 'long_text'
  | 'checkbox';

export type BillingCustomBlockValueSource = 'org' | 'per_bill';

export interface BillingSectionOverride {
  show?: boolean;
  label?: string;
}

export interface BillingCustomBlock {
  id: string;
  key: string;
  label: string;
  type: BillingCustomBlockType;
  position: BillingCustomBlockPosition;
  valueSource: BillingCustomBlockValueSource;
  /** Used when valueSource === 'org': org-wide value shown on all bills */
  orgValue?: string | number | boolean | null;
  order: number;
}

/** Config for extra charges (toll, parking) shown when generating a bill and on the bill. */
export interface BillingExtraChargeConfig {
  show?: boolean;
  label?: string;
}

export interface BillingLayoutConfig {
  /** If true, same layout (sections + custom blocks) applies to both customer and company bills */
  useSameLayoutForCompanyBills?: boolean;
  /** Built-in sections: show/hide and optional label overrides */
  sections?: Partial<Record<BillingBuiltInSectionKey, BillingSectionOverride>>;
  /** Custom blocks (e.g. PO Number, GSTIN, payment instructions) */
  customBlocks?: BillingCustomBlock[];
  /** Extra charges added to bill total: toll tax and parking. Admin can show/hide and set labels. */
  extraCharges?: {
    toll_tax?: BillingExtraChargeConfig;
    parking_charges?: BillingExtraChargeConfig;
  };
}

/** Default labels for extra charges (used when not set in config). */
export const DEFAULT_EXTRA_CHARGE_LABELS = {
  toll_tax: 'Toll Tax',
  parking_charges: 'Parking Charges',
} as const;

/** Default labels for built-in sections (used when no override in config). */
export const BILLING_SECTION_LABELS: Record<BillingBuiltInSectionKey, string> = {
  header: 'Header',
  trip_km_details: 'Trip & KM Details',
  billed_to: 'Billed To',
  company_details: 'Company Details',
  vehicle_table: 'Vehicle & Rate Details',
  totals: 'Totals',
  qr_code: 'QR Code',
  terms: 'Terms & Conditions',
  footer: 'Footer',
};

export const BILLING_POSITION_LABELS: Record<BillingCustomBlockPosition, string> = {
  after_customer_details: 'After customer details',
  after_vehicle_table: 'After vehicle table',
  before_totals: 'Before totals',
  after_totals: 'After totals',
  before_terms: 'Before terms & conditions',
  before_footer: 'Before footer',
};

export const BILLING_CUSTOM_BLOCK_TYPES: { value: BillingCustomBlockType; label: string }[] = [
  { value: 'short_text', label: 'Short text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'long_text', label: 'Long text / paragraph' },
  { value: 'checkbox', label: 'Checkbox' },
];
