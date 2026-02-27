import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export interface DocumentViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URL to display (signed URL or object URL). */
  url: string | null;
  /** Display name for title and download. */
  fileName?: string;
}

export function DocumentViewerDialog({
  open,
  onOpenChange,
  url,
  fileName = 'Document',
}: DocumentViewerDialogProps) {
  const isPdf = (url?.toLowerCase().includes('.pdf') || fileName?.toLowerCase().endsWith('.pdf')) ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{fileName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto">
          {url && (
            isPdf ? (
              <iframe src={url} title={fileName} className="w-full h-[70vh] min-h-[400px] rounded border" />
            ) : (
              <img src={url} alt={fileName} className="max-w-full h-auto max-h-[70vh] object-contain" />
            )
          )}
        </div>
        <DialogFooter>
          {url && (
            <Button onClick={() => window.open(url, '_blank')}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
