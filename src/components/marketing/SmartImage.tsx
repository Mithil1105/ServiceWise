import { useState } from 'react';
import { cn } from '@/lib/utils';

export type SmartImageProps = {
  src: string;
  alt: string;
  fallback: React.ReactNode;
  className?: string;
  imgClassName?: string;
};

/**
 * Tries to load an image; if it fails or is missing, shows the fallback (e.g. inline SVG).
 */
export function SmartImage({ src, alt, fallback, className, imgClassName }: SmartImageProps) {
  const [errored, setErrored] = useState(false);

  const handleError = () => setErrored(true);

  if (errored) {
    return <div className={cn('flex items-center justify-center', className)}>{fallback}</div>;
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={handleError}
      className={cn('object-contain', imgClassName, className)}
    />
  );
}
