/** Max file size for document uploads (PDF/images): 2 MB */
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';

export function isDocumentFileValid(file: File, maxBytes = MAX_DOCUMENT_FILE_SIZE_BYTES): { valid: boolean; error?: string } {
  if (file.size > maxBytes) {
    return { valid: false, error: `File must be 2 MB or smaller (${(file.size / 1024 / 1024).toFixed(2)} MB).` };
  }
  return { valid: true };
}
