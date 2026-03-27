/**
 * Normalized object key builders for R2 bucket (app-uploads).
 * All keys use a single bucket with prefixes; no bucket name in key.
 */

export const STORAGE_PREFIX = {
  ORGANIZATION_LOGOS: 'organization-logos/',
  BILLS: 'bills/',
  DRIVER_LICENSES: 'driver-licenses/',
  CAR_DOCUMENTS: 'car-documents/',
  SERVICE_BILLS: 'service-bills/',
  INCIDENT_ATTACHMENTS: 'incident-attachments/',
  FUEL_BILLS: 'fuel-bills/',
} as const;

export type StorageDomain = keyof typeof STORAGE_PREFIX;
export type StorageBucket = 'organization-logos' | 'bills' | 'driver-licenses' | 'car-documents' | 'service-bills';

const DOMAIN_TO_BUCKET: Record<StorageDomain, StorageBucket> = {
  ORGANIZATION_LOGOS: 'organization-logos',
  BILLS: 'bills',
  DRIVER_LICENSES: 'driver-licenses',
  CAR_DOCUMENTS: 'car-documents',
  SERVICE_BILLS: 'service-bills',
  // There is currently no dedicated Supabase storage bucket for incidents.
  // This only matters if the code falls back to Supabase Storage, which should not happen for R2-prefixed keys.
  INCIDENT_ATTACHMENTS: 'car-documents',
  // Fuel bills are stored in R2 under `fuel-bills/`.
  // Legacy fallback is not expected to be used, but keep mapping for completeness.
  FUEL_BILLS: 'service-bills',
};

export const KNOWN_R2_PREFIXES = Object.values(STORAGE_PREFIX);

export function organizationLogoKey(orgId: string, fileName: string): string {
  return `${STORAGE_PREFIX.ORGANIZATION_LOGOS}${orgId}/${fileName}`;
}

export function billKey(billId: string, fileName: string): string {
  return `${STORAGE_PREFIX.BILLS}${billId}/${fileName}`;
}

export function companyBillKey(billId: string, fileName: string): string {
  return `${STORAGE_PREFIX.BILLS}company-bills/${billId}/${fileName}`;
}

export function driverLicenseKey(prefix: string, ext: string): string {
  const safe = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  return `${STORAGE_PREFIX.DRIVER_LICENSES}${safe}`;
}

export function carDocumentKey(carId: string, documentType: string, ext: string): string {
  return `${STORAGE_PREFIX.CAR_DOCUMENTS}${carId}/${documentType}-${Date.now()}.${ext}`;
}

export function serviceBillKey(carId: string, serviceRecordId: string, ext: string): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  return `${STORAGE_PREFIX.SERVICE_BILLS}${carId}/${serviceRecordId}/${suffix}`;
}

export function incidentAttachmentKey(carId: string, ext: string): string {
  const safeExt = (ext || 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
  return `${STORAGE_PREFIX.INCIDENT_ATTACHMENTS}${carId}/${suffix}`;
}

export function fuelBillKey(fuelEntryId: string, fileName: string): string {
  const ext = (fileName.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
  const safeBase = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-');
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeBase}.${ext}`;
  return `${STORAGE_PREFIX.FUEL_BILLS}${fuelEntryId}/${suffix}`;
}

export function isFullUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith('http://') || value.startsWith('https://');
}

/** True when the path is already an R2 key with a known prefix. */
export function isR2PrefixedKey(path: string | null | undefined): boolean {
  if (!path) return false;
  return KNOWN_R2_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function bucketFromDomain(domain: StorageDomain): StorageBucket {
  return DOMAIN_TO_BUCKET[domain];
}

/** Strip "<bucket>/" from start when present, else return unchanged. */
export function stripBucketPrefix(bucket: StorageBucket, path: string): string {
  const prefix = `${bucket}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/**
 * Keep DB paths unchanged unless already full R2 key.
 * This avoids incorrectly forcing legacy Supabase paths into R2 prefixes.
 */
export function toFullKey(domain: StorageDomain, path: string | null): string | null {
  if (!path) return null;
  if (isFullUrl(path)) return path;
  if (isR2PrefixedKey(path)) return path;
  void domain;
  return path;
}
