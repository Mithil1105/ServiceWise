import { useState, useEffect } from 'react';
import { useDrivers, useCreateDriver, useUpdateDriver, useDeleteDriver, useDownloadLicense, Driver, type DriverType } from '@/hooks/use-drivers';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Plus,
  Search,
  Loader2,
  Phone,
  MapPin,
  FileText,
  Download,
  Pencil,
  Trash2,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDateDMY } from '@/lib/date';
import { differenceInDays, parseISO } from 'date-fns';
import { useOrganizationSettings } from '@/hooks/use-organization-settings';
import {
  type DriverFormBuiltInFieldKey,
  DRIVER_FORM_FIELD_LABELS,
} from '@/types/form-config';
import { DocumentFileInput } from '@/components/ui/document-file-input';
import { DocumentViewerDialog } from '@/components/ui/document-viewer-dialog';
import { supabase } from '@/integrations/supabase/client';

function LicenseExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  if (!expiryDate) return <Badge variant="muted">No expiry set</Badge>;

  const daysUntilExpiry = differenceInDays(parseISO(expiryDate), new Date());

  if (daysUntilExpiry < 0) {
    return <Badge variant="error">Expired {Math.abs(daysUntilExpiry)} days ago</Badge>;
  }
  if (daysUntilExpiry <= 30) {
    return <Badge variant="warning">Expires in {daysUntilExpiry} days</Badge>;
  }
  return <Badge variant="success">Valid</Badge>;
}

function DriverFormDialog({
  open,
  onOpenChange,
  driver,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver?: Driver;
  onSuccess?: () => void;
}) {
  const { data: orgSettings } = useOrganizationSettings();
  const formConfig = orgSettings?.drivers_form_config ?? null;
  const fieldOverrides = formConfig?.fieldOverrides ?? {};
  const customFields = (formConfig?.customFields ?? []).sort((a, b) => a.order - b.order);
  const getFieldLabel = (key: DriverFormBuiltInFieldKey) => fieldOverrides[key]?.label ?? DRIVER_FORM_FIELD_LABELS[key];
  const isFieldHidden = (key: DriverFormBuiltInFieldKey) => fieldOverrides[key]?.hidden === true;
  const isFieldRequired = (key: DriverFormBuiltInFieldKey) => fieldOverrides[key]?.required ?? (key === 'name' || key === 'phone');

  const createDriver = useCreateDriver();
  const updateDriver = useUpdateDriver();
  const [formData, setFormData] = useState({
    name: driver?.name || '',
    phone: driver?.phone || '',
    location: driver?.location || '',
    region: driver?.region || '',
    license_type: (driver?.license_type as 'lmv' | 'hmv') || 'lmv',
    license_expiry: driver?.license_expiry || '',
    driver_type: (driver?.driver_type as DriverType) || 'temporary',
    notes: driver?.notes || '',
  });
  const [customValues, setCustomValues] = useState<Record<string, string | number>>({});
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [policeVerificationFile, setPoliceVerificationFile] = useState<File | null>(null);
  const [healthCertificateFile, setHealthCertificateFile] = useState<File | null>(null);
  const [viewDocUrl, setViewDocUrl] = useState<string | null>(null);
  const [viewDocName, setViewDocName] = useState<string>('');

  const isEditing = !!driver;
  const isPending = createDriver.isPending || updateDriver.isPending;

  useEffect(() => {
    if (driver?.custom_attributes && typeof driver.custom_attributes === 'object') {
      const attrs: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(driver.custom_attributes)) {
        if (v !== null && v !== undefined) attrs[k] = v as string | number;
      }
      setCustomValues(attrs);
    } else {
      setCustomValues({});
    }
  }, [driver?.custom_attributes]);

  // Sync form when driver prop changes (e.g. switch from one edit to another or to add)
  useEffect(() => {
    if (driver) {
      setFormData({
        name: driver.name,
        phone: driver.phone,
        location: driver.location || '',
        region: driver.region || '',
        license_type: (driver.license_type as 'lmv' | 'hmv') || 'lmv',
        license_expiry: driver.license_expiry || '',
        driver_type: (driver.driver_type as DriverType) || 'temporary',
        notes: driver.notes || '',
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        location: '',
        region: '',
        license_type: 'lmv',
        license_expiry: '',
        driver_type: 'temporary',
        notes: '',
      });
    }
  }, [driver]);

  // Reset file selections when dialog opens so we don't carry over from previous driver
  useEffect(() => {
    if (open) {
      setLicenseFile(null);
      setAadhaarFile(null);
      setPoliceVerificationFile(null);
      setHealthCertificateFile(null);
    }
  }, [open]);

  const openViewForFile = (file: File) => {
    setViewDocUrl(URL.createObjectURL(file));
    setViewDocName(file.name);
  };
  const openViewForPath = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from('driver-licenses').createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) {
      setViewDocUrl(data.signedUrl);
      setViewDocName(name || 'Document');
    }
  };
  const closeViewer = () => {
    if (viewDocUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(viewDocUrl);
    }
    setViewDocUrl(null);
    setViewDocName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const customAttrs: Record<string, string | number | boolean | null> = {};
    for (const f of customFields) {
      const val = customValues[f.key];
      if (f.required && (val === undefined || val === '')) {
        return; // could set error state
      }
      if (val !== undefined && val !== '') customAttrs[f.key] = typeof val === 'number' ? val : String(val);
    }
    try {
      if (isEditing) {
        await updateDriver.mutateAsync({
          id: driver.id,
          ...formData,
          license_type: formData.license_type,
          licenseFile: licenseFile || undefined,
          driver_type: formData.driver_type,
          aadhaarFile: aadhaarFile || undefined,
          policeVerificationFile: policeVerificationFile || undefined,
          healthCertificateFile: healthCertificateFile || undefined,
          custom_attributes: Object.keys(customAttrs).length ? customAttrs : undefined,
        });
      } else {
        await createDriver.mutateAsync({
          ...formData,
          license_type: formData.license_type,
          licenseFile: licenseFile || undefined,
          driver_type: formData.driver_type,
          aadhaarFile: aadhaarFile || undefined,
          policeVerificationFile: policeVerificationFile || undefined,
          healthCertificateFile: healthCertificateFile || undefined,
          custom_attributes: Object.keys(customAttrs).length ? customAttrs : undefined,
        });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isEditing ? 'Edit Driver' : 'Add Driver'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update driver information' : 'Add a new driver to your team'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal details */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Personal details</h4>
            <div className="grid grid-cols-2 gap-4">
              {!isFieldHidden('name') && (
                <div className="space-y-2">
                  <Label htmlFor="name">{getFieldLabel('name')}{isFieldRequired('name') ? ' *' : ''}</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Driver name" required={isFieldRequired('name')} />
                </div>
              )}
              {!isFieldHidden('phone') && (
                <div className="space-y-2">
                  <Label htmlFor="phone">{getFieldLabel('phone')}{isFieldRequired('phone') ? ' *' : ''}</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Phone number" required={isFieldRequired('phone')} />
                </div>
              )}
              {!isFieldHidden('location') && (
                <div className="space-y-2">
                  <Label htmlFor="location">{getFieldLabel('location')}{isFieldRequired('location') ? ' *' : ''}</Label>
                  <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="City/Area" />
                </div>
              )}
              {!isFieldHidden('region') && (
                <div className="space-y-2">
                  <Label htmlFor="region">{getFieldLabel('region')}{isFieldRequired('region') ? ' *' : ''}</Label>
                  <Input id="region" value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value })} placeholder="State/Region" />
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* License & employment type */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">License & employment type</h4>
            <div className="grid grid-cols-2 gap-4">
              {!isFieldHidden('license_type') && (
            <div className="space-y-2">
              <Label htmlFor="license_type">{getFieldLabel('license_type')}{isFieldRequired('license_type') ? ' *' : ''}</Label>
              <Select
                value={formData.license_type}
                onValueChange={(value: 'lmv' | 'hmv') => setFormData({ ...formData, license_type: value })}
                required={isFieldRequired('license_type')}
              >
                <SelectTrigger id="license_type">
                  <SelectValue placeholder="LMV or HMV" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lmv">LMV (Light Motor Vehicle)</SelectItem>
                  <SelectItem value="hmv">HMV (Heavy Motor Vehicle)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            )}

              {!isFieldHidden('license_expiry') && (
                <div className="space-y-2">
                  <Label htmlFor="license_expiry">{getFieldLabel('license_expiry')}{isFieldRequired('license_expiry') ? ' *' : ''}</Label>
                  <Input id="license_expiry" type="date" value={formData.license_expiry} onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })} />
                </div>
              )}
              {!isFieldHidden('driver_type') && (
                <div className="space-y-2 sm:col-span-2 max-w-[240px]">
                  <Label htmlFor="driver_type">{getFieldLabel('driver_type')}{isFieldRequired('driver_type') ? ' *' : ''}</Label>
                  <Select value={formData.driver_type} onValueChange={(v: DriverType) => setFormData({ ...formData, driver_type: v })} required={isFieldRequired('driver_type')}>
                    <SelectTrigger id="driver_type"><SelectValue placeholder="Permanent or Temporary" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Documents — single block with 2x2 grid */}
          {(isFieldHidden('license_file') && isFieldHidden('aadhaar_file') && isFieldHidden('police_verification_file') && isFieldHidden('health_certificate_file')) ? null : (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Documents</h4>
              <p className="text-xs text-muted-foreground">PDF or image (JPG, PNG). Max 2 MB per file. Replace by choosing a new file.</p>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {!isFieldHidden('license_file') && (
                    <div className="space-y-1.5">
                      <Label htmlFor="license_file" className="text-xs font-medium text-muted-foreground">{getFieldLabel('license_file')}{isFieldRequired('license_file') ? ' *' : ''}</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <DocumentFileInput id="license_file" value={licenseFile} onChange={setLicenseFile} buttonLabel="Choose file" />
                        {(licenseFile || driver?.license_file_path) && (
                          <Button type="button" variant="ghost" size="sm" className="cursor-pointer h-8" onClick={() => licenseFile ? openViewForFile(licenseFile) : driver?.license_file_path && openViewForPath(driver.license_file_path, driver?.license_file_name || 'License')}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {!isFieldHidden('aadhaar_file') && (
                    <div className="space-y-1.5">
                      <Label htmlFor="aadhaar_file" className="text-xs font-medium text-muted-foreground">{getFieldLabel('aadhaar_file')}{isFieldRequired('aadhaar_file') ? ' *' : ''}</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <DocumentFileInput id="aadhaar_file" value={aadhaarFile} onChange={setAadhaarFile} buttonLabel="Choose file" />
                        {(aadhaarFile || driver?.aadhaar_file_path) && (
                          <Button type="button" variant="ghost" size="sm" className="cursor-pointer h-8" onClick={() => aadhaarFile ? openViewForFile(aadhaarFile) : driver?.aadhaar_file_path && openViewForPath(driver.aadhaar_file_path, driver?.aadhaar_file_name || 'Aadhaar')}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {!isFieldHidden('police_verification_file') && (
                    <div className="space-y-1.5">
                      <Label htmlFor="police_verification_file" className="text-xs font-medium text-muted-foreground">{getFieldLabel('police_verification_file')}{isFieldRequired('police_verification_file') ? ' *' : ''}</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <DocumentFileInput id="police_verification_file" value={policeVerificationFile} onChange={setPoliceVerificationFile} buttonLabel="Choose file" />
                        {(policeVerificationFile || driver?.police_verification_file_path) && (
                          <Button type="button" variant="ghost" size="sm" className="cursor-pointer h-8" onClick={() => policeVerificationFile ? openViewForFile(policeVerificationFile) : driver?.police_verification_file_path && openViewForPath(driver.police_verification_file_path, driver?.police_verification_file_name || 'Police verification')}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {!isFieldHidden('health_certificate_file') && (
                    <div className="space-y-1.5">
                      <Label htmlFor="health_certificate_file" className="text-xs font-medium text-muted-foreground">{getFieldLabel('health_certificate_file')}{isFieldRequired('health_certificate_file') ? ' *' : ''}</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <DocumentFileInput id="health_certificate_file" value={healthCertificateFile} onChange={setHealthCertificateFile} buttonLabel="Choose file" />
                        {(healthCertificateFile || driver?.health_certificate_file_path) && (
                          <Button type="button" variant="ghost" size="sm" className="cursor-pointer h-8" onClick={() => healthCertificateFile ? openViewForFile(healthCertificateFile) : driver?.health_certificate_file_path && openViewForPath(driver.health_certificate_file_path, driver?.health_certificate_file_name || 'Health certificate')}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!isFieldHidden('notes') && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Notes</h4>
                <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Any additional notes..." rows={2} className="resize-none" />
              </div>
            </>
          )}

          {customFields.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                {customFields.map((f) => (
                  <div key={f.id} className="space-y-2">
                    <Label htmlFor={`custom-${f.key}`}>{f.label}{f.required ? ' *' : ''}</Label>
                    {f.type === 'text' && (
                      <Input
                        id={`custom-${f.key}`}
                        value={String(customValues[f.key] ?? '')}
                        onChange={(e) => setCustomValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    )}
                    {f.type === 'number' && (
                      <Input
                        id={`custom-${f.key}`}
                        type="number"
                        value={customValues[f.key] !== undefined && customValues[f.key] !== '' ? Number(customValues[f.key]) : ''}
                        onChange={(e) => setCustomValues((prev) => ({ ...prev, [f.key]: e.target.value === '' ? '' : Number(e.target.value) }))}
                      />
                    )}
                    {f.type === 'date' && (
                      <Input
                        id={`custom-${f.key}`}
                        type="date"
                        value={typeof customValues[f.key] === 'string' ? customValues[f.key] : ''}
                        onChange={(e) => setCustomValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    )}
                    {f.type === 'select' && (
                      <Select value={String(customValues[f.key] ?? '')} onValueChange={(v) => setCustomValues((prev) => ({ ...prev, [f.key]: v }))}>
                        <SelectTrigger id={`custom-${f.key}`}><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{(f.options ?? []).map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
                </div>
              </div>
            </>
          )}

          <DocumentViewerDialog open={!!viewDocUrl} onOpenChange={(open) => !open && closeViewer()} url={viewDocUrl} fileName={viewDocName} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEditing ? 'Update' : 'Add'} Driver
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DownloadLicenseButton({ filePath, fileName }: { filePath: string | null; fileName: string | null }) {
  const { data: url, isLoading } = useDownloadLicense(filePath);

  if (!filePath) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => url && window.open(url, '_blank')}
      disabled={isLoading}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </Button>
  );
}

export default function Drivers() {
  const { isAdmin } = useAuth();
  const { data: drivers, isLoading } = useDrivers();
  const deleteDriver = useDeleteDriver();

  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredDrivers = drivers?.filter((driver) => {
    const matchesSearch =
      driver.name.toLowerCase().includes(search.toLowerCase()) ||
      driver.phone.includes(search) ||
      driver.location?.toLowerCase().includes(search.toLowerCase()) ||
      driver.region?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  }) || [];

  const handleDelete = () => {
    if (deleteId) {
      deleteDriver.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Drivers</h1>
          <p className="text-muted-foreground">Manage your driver team</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Driver
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Drivers Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Drivers ({filteredDrivers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDrivers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>License Expiry</TableHead>
                    <TableHead>License File</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {driver.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={(driver.driver_type ?? 'temporary') === 'permanent' ? 'default' : 'secondary'} className="font-normal">
                          {(driver.driver_type ?? 'temporary') === 'permanent' ? 'Permanent' : 'Temporary'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {driver.license_type === 'hmv' ? 'HMV' : 'LMV'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {driver.location ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {driver.location}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{driver.region || '-'}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <LicenseExpiryBadge expiryDate={driver.license_expiry} />
                          {driver.license_expiry && (
                            <p className="text-xs text-muted-foreground">
                              {formatDateDMY(driver.license_expiry)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {driver.license_file_path ? (
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <DownloadLicenseButton
                              filePath={driver.license_file_path}
                              fileName={driver.license_file_name}
                            />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {driver.aadhaar_file_path && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span><DownloadLicenseButton filePath={driver.aadhaar_file_path} fileName={driver.aadhaar_file_name} /></span>
                              </TooltipTrigger>
                              <TooltipContent>Aadhaar card</TooltipContent>
                            </Tooltip>
                          )}
                          {driver.police_verification_file_path && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span><DownloadLicenseButton filePath={driver.police_verification_file_path} fileName={driver.police_verification_file_name} /></span>
                              </TooltipTrigger>
                              <TooltipContent>Police verification</TooltipContent>
                            </Tooltip>
                          )}
                          {driver.health_certificate_file_path && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span><DownloadLicenseButton filePath={driver.health_certificate_file_path} fileName={driver.health_certificate_file_name} /></span>
                              </TooltipTrigger>
                              <TooltipContent>Health certificate</TooltipContent>
                            </Tooltip>
                          )}
                          {!driver.aadhaar_file_path && !driver.police_verification_file_path && !driver.health_certificate_file_path && (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setEditDriver(driver)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(driver.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No drivers found</h3>
              <p className="text-muted-foreground mb-4">
                {search ? 'Try adjusting your search' : 'Get started by adding your first driver'}
              </p>
              {!search && (
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Driver
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <DriverFormDialog open={addOpen} onOpenChange={setAddOpen} />

      {/* Edit Dialog */}
      {editDriver && (
        <DriverFormDialog
          open={!!editDriver}
          onOpenChange={(open) => !open && setEditDriver(null)}
          driver={editDriver}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Driver
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this driver? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
