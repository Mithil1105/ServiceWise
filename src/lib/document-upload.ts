/** Max file size for all uploads: 2 MB per file, 2 MB combined where multiple files are allowed */
export const MAX_UPLOAD_MB = 2;
export const MAX_DOCUMENT_FILE_SIZE_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const MAX_COMBINED_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';

export function isDocumentFileValid(file: File, maxBytes = MAX_DOCUMENT_FILE_SIZE_BYTES): { valid: boolean; error?: string } {
  if (file.size > maxBytes) {
    return { valid: false, error: `File must be 2 MB or smaller (${(file.size / 1024 / 1024).toFixed(2)} MB).` };
  }
  return { valid: true };
}
