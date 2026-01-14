import { useState } from 'react';
import { useDrivers, useCreateDriver, useUpdateDriver, useDeleteDriver, useDownloadLicense, Driver } from '@/hooks/use-drivers';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Calendar,
  FileText,
  Upload,
  Download,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { formatDateDMY } from '@/lib/date';
import { differenceInDays, parseISO } from 'date-fns';

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
  const createDriver = useCreateDriver();
  const updateDriver = useUpdateDriver();
  const [formData, setFormData] = useState({
    name: driver?.name || '',
    phone: driver?.phone || '',
    location: driver?.location || '',
    region: driver?.region || '',
    license_expiry: driver?.license_expiry || '',
    notes: driver?.notes || '',
  });
  const [licenseFile, setLicenseFile] = useState<File | null>(null);

  const isEditing = !!driver;
  const isPending = createDriver.isPending || updateDriver.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEditing) {
        await updateDriver.mutateAsync({
          id: driver.id,
          ...formData,
          licenseFile: licenseFile || undefined,
        });
      } else {
        await createDriver.mutateAsync({
          ...formData,
          licenseFile: licenseFile || undefined,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isEditing ? 'Edit Driver' : 'Add Driver'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update driver information' : 'Add a new driver to your team'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Driver name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone number"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="City/Area"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="State/Region"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="license_expiry">License Expiry Date</Label>
              <Input
                id="license_expiry"
                type="date"
                value={formData.license_expiry}
                onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="license_file">Driving License (PDF/Image)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="license_file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {licenseFile && (
                  <Badge variant="muted" className="shrink-0">
                    {licenseFile.name}
                  </Badge>
                )}
              </div>
              {driver?.license_file_name && !licenseFile && (
                <p className="text-sm text-muted-foreground">
                  Current: {driver.license_file_name}
                </p>
              )}
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
          </div>

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
                    <TableHead>Location</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>License Expiry</TableHead>
                    <TableHead>License File</TableHead>
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
