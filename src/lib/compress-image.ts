import imageCompression from 'browser-image-compression';

export async function compressImage(file: File): Promise<File> {
  try {
    const compressedFile = await imageCompression(file, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    });

    if (import.meta.env.DEV) {
      console.log('Original size:', file.size);
      console.log('Compressed size:', compressedFile.size);
    }

    return compressedFile;
  } catch {
    return file;
  }
}

/**
 * Compress image first, but only use the compressed output if it fits within maxBytes.
 * Otherwise falls back to the original file (so callers can show the same validation errors).
 */
export async function compressImageIfWithinLimit(file: File, maxBytes: number): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  const compressed = await compressImage(file);
  return compressed.size <= maxBytes ? compressed : file;
}
