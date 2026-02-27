import * as React from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MAX_DOCUMENT_FILE_SIZE_BYTES, DOCUMENT_ACCEPT, isDocumentFileValid } from '@/lib/document-upload';

export interface DocumentFileInputProps {
  id: string;
  value: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  maxSizeBytes?: number;
  className?: string;
  buttonLabel?: string;
  disabled?: boolean;
}

export function DocumentFileInput({
  id,
  value,
  onChange,
  accept = DOCUMENT_ACCEPT,
  maxSizeBytes = MAX_DOCUMENT_FILE_SIZE_BYTES,
  className,
  buttonLabel = 'Choose file',
  disabled,
}: DocumentFileInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) {
      onChange(null);
      return;
    }
    const { valid, error } = isDocumentFileValid(file, maxSizeBytes);
    if (!valid) {
      toast.error(error);
      onChange(null);
      return;
    }
    onChange(file);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
        aria-hidden
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="cursor-pointer"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        <Upload className="h-4 w-4 mr-2" />
        {buttonLabel}
      </Button>
      {value && (
        <span className="text-sm text-muted-foreground truncate max-w-[180px]">
          {value.name}
        </span>
      )}
    </div>
  );
}
