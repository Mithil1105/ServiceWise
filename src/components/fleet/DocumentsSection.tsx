import { useState } from 'react';
import { useCarDocuments, useUpsertCarDocument, useDeleteCarDocument, type DocumentType } from '@/hooks/use-car-documents';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, Upload, Download, Trash2, Loader2, AlertTriangle, Plus, Eye } from 'lucide-react';
import { formatDateDMY } from '@/lib/date';
import { differenceInDays, parseISO } from 'date-fns';

interface DocumentsSectionProps {
  carId: string;
  isAdmin: boolean;
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  rc: 'RC Book',
  puc: 'PUC Certificate',
  insurance: 'Insurance',
  warranty: 'Warranty',
};

export default function DocumentsSection({ carId, isAdmin }: DocumentsSectionProps) {
  const { data: documents, isLoading } = useCarDocuments(carId);
  const upsertDocument = useUpsertCarDocument();
  const deleteDocument = useDeleteCarDocument();

  const [editDoc, setEditDoc] = useState<DocumentType | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [viewingName, setViewingName] = useState<string>('');

  const handleSave = async () => {
    if (!editDoc) return;

    await upsertDocument.mutateAsync({
      carId,
      documentType: editDoc,
      expiryDate: expiryDate || null,
      file: selectedFile || undefined,
    });

    setEditDoc(null);
    setExpiryDate('');
    setSelectedFile(null);
  };

  const handleView = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('car-documents')
      .createSignedUrl(filePath, 3600);

    if (!error && data) {
      setViewingUrl(data.signedUrl);
      setViewingName(fileName);
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('car-documents')
      .createSignedUrl(filePath, 3600);

    if (!error && data) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return null;

    const days = differenceInDays(parseISO(expiryDate), new Date());

    if (days < 0) {
      return { variant: 'destructive' as const, label: 'Expired' };
    } else if (days <= 7) {
      return { variant: 'destructive' as const, label: `${days}d left` };
    } else if (days <= 30) {
      return { variant: 'warning' as const, label: `${days}d left` };
    }
    return { variant: 'success' as const, label: 'Valid' };
  };

  const allDocTypes: DocumentType[] = ['rc', 'puc', 'insurance', 'warranty'];
  const docMap = new Map(documents?.map((d) => [d.document_type, d]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allDocTypes.map((docType) => {
                const doc = docMap.get(docType);
                const status = doc ? getExpiryStatus(doc.expiry_date) : null;

                return (
                  <TableRow key={docType}>
                    <TableCell className="font-medium">{DOCUMENT_LABELS[docType]}</TableCell>
                    <TableCell>
                      {doc?.expiry_date ? formatDateDMY(doc.expiry_date) : '-'}
                    </TableCell>
                    <TableCell>
                      {status ? (
                        <Badge variant={status.variant}>{status.label}</Badge>
                      ) : (
                        <Badge variant="muted">Not Set</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {doc?.file_name ? (
                        <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                          {doc.file_name}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">No file</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {doc?.file_path && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleView(doc.file_path!, doc.file_name || 'Document')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDownload(doc.file_path!, doc.file_name || 'Document')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {(isAdmin || !doc) && (
                          <Dialog open={editDoc === docType} onOpenChange={(open) => {
                            if (open) {
                              setEditDoc(docType);
                              setExpiryDate(doc?.expiry_date || '');
                            } else {
                              setEditDoc(null);
                              setExpiryDate('');
                              setSelectedFile(null);
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                {doc ? <Upload className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  {doc ? 'Update' : 'Add'} {DOCUMENT_LABELS[docType]}
                                </DialogTitle>
                                <DialogDescription>
                                  Upload document and set expiry date
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Expiry Date</Label>
                                  <Input
                                    type="date"
                                    value={expiryDate}
                                    onChange={(e) => setExpiryDate(e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Document File</Label>
                                  <Input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                  />
                                  {doc?.file_name && !selectedFile && (
                                    <p className="text-xs text-muted-foreground">
                                      Current: {doc.file_name}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setEditDoc(null)}>
                                  Cancel
                                </Button>
                                <Button onClick={handleSave} disabled={upsertDocument.isPending}>
                                  {upsertDocument.isPending && (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  )}
                                  Save
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                        {doc && isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteDocument.mutate({ id: doc.id, carId })}
                            disabled={deleteDocument.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* View Document Dialog */}
        <Dialog open={!!viewingUrl} onOpenChange={(open) => !open && setViewingUrl(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{viewingName}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {viewingUrl && (
                viewingUrl.includes('.pdf') ? (
                  <iframe src={viewingUrl} className="w-full h-[70vh]" />
                ) : (
                  <img src={viewingUrl} alt={viewingName} className="max-w-full h-auto" />
                )
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => window.open(viewingUrl!, '_blank')}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" onClick={() => setViewingUrl(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
