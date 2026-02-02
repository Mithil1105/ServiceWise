import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useCars } from '@/hooks/use-cars';
import { useLatestOdometer } from '@/hooks/use-odometer';
import { useServiceRules, useServiceRecords, useCreateServiceRecord } from '@/hooks/use-services';
import { useUploadServiceBills } from '@/hooks/use-service-bills';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { ArrowLeft, Wrench, Loader2, AlertCircle, Upload, X, HelpCircle, Lightbulb, FileText, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { toLocalDateInputValue } from '@/lib/date';

interface WarrantyItem {
  itemName: string;
  serialNumber: string;
  expiryDate: string;
}

// File size limits
const MAX_TOTAL_SIZE_MB = 10;
const MAX_IMAGE_SIZE_MB = 1;
const MAX_PDF_SIZE_MB = 4;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const serviceSchema = z.object({
  car_id: z.string().min(1, 'Please select a vehicle'),
  rule_id: z.string().optional(),
  service_name: z.string().min(1, 'Service name is required').max(100),
  serviced_at: z.string().min(1, 'Service date is required'),
  odometer_km: z.number().min(0, 'Odometer must be positive'),
  vendor_name: z.string().max(100).optional(),
  vendor_location: z.string().max(200).optional(),
  cost: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
  warranty_expiry: z.string().optional(),
  serial_number: z.string().max(100).optional(),
});

const SUSPICIOUS_JUMP_KM = 8000;

export default function ServiceNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCarId = searchParams.get('car');
  const preselectedRuleId = searchParams.get('rule');
  const { toast } = useToast();

  const { data: cars, isLoading: carsLoading } = useCars();
  const { data: serviceRules } = useServiceRules();
  const createRecord = useCreateServiceRecord();
  const uploadBills = useUploadServiceBills();

  const [selectedCarId, setSelectedCarId] = useState(preselectedCarId || '');
  const { data: latestOdo } = useLatestOdometer(selectedCarId);
  const { data: carServiceRecords } = useServiceRecords(selectedCarId);

  const [formData, setFormData] = useState({
    rule_id: preselectedRuleId || '',
    service_name: '',
    serviced_at: toLocalDateInputValue(),
    odometer_km: '',
    vendor_name: '',
    vendor_location: '',
    cost: '',
    notes: '',
  });
  const [warrantyItems, setWarrantyItems] = useState<WarrantyItem[]>([
    { itemName: '', serialNumber: '', expiryDate: '' }
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [billFiles, setBillFiles] = useState<File[]>([]);
  const [warrantyFile, setWarrantyFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Validation confirmation states
  const [showOdoWarning, setShowOdoWarning] = useState(false);
  const [showSuspiciousJump, setShowSuspiciousJump] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<any>(null);

  // Smart suggestions
  const [suggestedVendor, setSuggestedVendor] = useState<string | null>(null);
  const [suggestedCost, setSuggestedCost] = useState<number | null>(null);

  // Auto-fill odometer from latest reading
  useEffect(() => {
    if (latestOdo) {
      setFormData((prev) => ({
        ...prev,
        odometer_km: latestOdo.odometer_km.toString(),
      }));
    }
  }, [latestOdo]);

  // Auto-fill service name from rule
  useEffect(() => {
    if (formData.rule_id) {
      const rule = serviceRules?.find((r) => r.id === formData.rule_id);
      if (rule) {
        setFormData((prev) => ({
          ...prev,
          service_name: rule.name,
        }));
      }
    }
  }, [formData.rule_id, serviceRules]);

  // Preselect rule from URL
  useEffect(() => {
    if (preselectedRuleId && serviceRules) {
      const rule = serviceRules.find((r) => r.id === preselectedRuleId);
      if (rule) {
        setFormData((prev) => ({
          ...prev,
          rule_id: preselectedRuleId,
          service_name: rule.name,
        }));
      }
    }
  }, [preselectedRuleId, serviceRules]);

  // Smart defaults: suggest vendor and cost from previous records
  useEffect(() => {
    if (carServiceRecords && carServiceRecords.length > 0 && formData.service_name) {
      // Find last 5 vendors for this car
      const recentVendors = carServiceRecords
        .filter((r) => r.vendor_name)
        .slice(0, 5)
        .map((r) => r.vendor_name);
      
      if (recentVendors.length > 0 && !formData.vendor_name) {
        setSuggestedVendor(recentVendors[0] || null);
      }

      // Find last cost for same service
      const sameServiceRecord = carServiceRecords.find(
        (r) => r.service_name.toLowerCase() === formData.service_name.toLowerCase() && r.cost
      );
      if (sameServiceRecord?.cost && !formData.cost) {
        setSuggestedCost(sameServiceRecord.cost);
      }
    }
  }, [carServiceRecords, formData.service_name, formData.vendor_name, formData.cost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Filter out empty warranty items
    const validWarrantyItems = warrantyItems.filter(
      w => w.itemName.trim() || w.serialNumber.trim() || w.expiryDate
    );
    
    // Combine warranty items into notes format for storage
    const warrantyNotes = validWarrantyItems.length > 0
      ? validWarrantyItems.map(w => 
          `${w.itemName || 'Item'}${w.serialNumber ? ` (S/N: ${w.serialNumber})` : ''}${w.expiryDate ? ` - Expires: ${w.expiryDate}` : ''}`
        ).join(' | ')
      : '';

    const parsed = {
      car_id: selectedCarId,
      rule_id: formData.rule_id || undefined,
      service_name: formData.service_name.trim(),
      serviced_at: formData.serviced_at,
      odometer_km: parseInt(formData.odometer_km) || 0,
      vendor_name: formData.vendor_name?.trim() || undefined,
      vendor_location: formData.vendor_location?.trim() || undefined,
      cost: formData.cost ? parseFloat(formData.cost) : undefined,
      notes: formData.notes?.trim() || undefined,
      warranty_expiry: validWarrantyItems[0]?.expiryDate || undefined,
      serial_number: validWarrantyItems.length > 0 ? warrantyNotes : undefined,
    };

    const result = serviceSchema.safeParse(parsed);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[String(err.path[0])] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    const lastKm = latestOdo?.odometer_km || 0;

    // Check if odometer is less than latest
    if (latestOdo && result.data.odometer_km < latestOdo.odometer_km) {
      const serviceDate = new Date(result.data.serviced_at);
      const lastReadingDate = new Date(latestOdo.reading_at);
      
      if (serviceDate >= lastReadingDate) {
        setErrors({ odometer_km: `Reading is lower than last recorded (${latestOdo.odometer_km.toLocaleString()} km). If this service happened before the last reading, adjust the date.` });
        return;
      }
      
      setPendingSubmit(result.data);
      setShowOdoWarning(true);
      return;
    }

    // Check for suspicious jump
    if (result.data.odometer_km - lastKm > SUSPICIOUS_JUMP_KM) {
      setPendingSubmit(result.data);
      setShowSuspiciousJump(true);
      return;
    }

    await submitRecord(result.data);
  };

  const submitRecord = async (data: typeof serviceSchema._output) => {
    setIsUploading(true);
    
    try {
      // Create the service record first
      const record = await createRecord.mutateAsync({
        car_id: data.car_id,
        rule_id: data.rule_id,
        service_name: data.service_name,
        serviced_at: data.serviced_at,
        odometer_km: data.odometer_km,
        vendor_name: data.vendor_name,
        vendor_location: data.vendor_location,
        cost: data.cost,
        notes: data.notes,
        warranty_expiry: data.warranty_expiry,
        serial_number: data.serial_number,
      });

      // Upload bill files if any
      if (billFiles.length > 0 && record?.id) {
        await uploadBills.mutateAsync({
          serviceRecordId: record.id,
          carId: data.car_id,
          files: billFiles,
        });
      }

      navigate('/app/services');
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmLowerOdo = () => {
    if (pendingSubmit) {
      submitRecord(pendingSubmit);
    }
    setShowOdoWarning(false);
    setPendingSubmit(null);
  };

  const handleConfirmSuspiciousJump = () => {
    if (pendingSubmit) {
      submitRecord(pendingSubmit);
    }
    setShowSuspiciousJump(false);
    setPendingSubmit(null);
  };

  const processFiles = useCallback((newFiles: File[]) => {
    if (newFiles.length === 0) return;

    const currentTotalSize = billFiles.reduce((sum, f) => sum + f.size, 0);
    let addedSize = 0;
    const validFiles: File[] = [];

    for (const file of newFiles) {
      // Check file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: `${file.name}: Only PDF, JPG, PNG files are allowed`,
          variant: 'destructive',
        });
        continue;
      }

      // Check individual file size
      const isPdf = file.type === 'application/pdf';
      const maxSize = isPdf ? MAX_PDF_SIZE_MB * 1024 * 1024 : MAX_IMAGE_SIZE_MB * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: `${file.name}: Max ${isPdf ? MAX_PDF_SIZE_MB : MAX_IMAGE_SIZE_MB}MB for ${isPdf ? 'PDF' : 'images'}`,
          variant: 'destructive',
        });
        continue;
      }

      // Check total size limit
      if (currentTotalSize + addedSize + file.size > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
        toast({
          title: 'Total size exceeded',
          description: `Cannot add ${file.name}: Total limit is ${MAX_TOTAL_SIZE_MB}MB`,
          variant: 'destructive',
        });
        continue;
      }

      addedSize += file.size;
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setBillFiles((prev) => [...prev, ...validFiles]);
    }
  }, [billFiles, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    processFiles(newFiles);
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if we're leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [processFiles]);

  // Paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        processFiles(files);
        toast({
          title: 'Image pasted',
          description: `${files.length} file(s) added from clipboard`,
        });
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [processFiles, toast]);

  const removeFile = (index: number) => {
    setBillFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getTotalFileSize = () => {
    return billFiles.reduce((sum, f) => sum + f.size, 0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const applySuggestedVendor = () => {
    if (suggestedVendor) {
      setFormData((prev) => ({ ...prev, vendor_name: suggestedVendor }));
      setSuggestedVendor(null);
    }
  };

  const applySuggestedCost = () => {
    if (suggestedCost) {
      setFormData((prev) => ({ ...prev, cost: suggestedCost.toString() }));
      setSuggestedCost(null);
    }
  };

  const addWarrantyItem = () => {
    setWarrantyItems(prev => [...prev, { itemName: '', serialNumber: '', expiryDate: '' }]);
  };

  const removeWarrantyItem = (index: number) => {
    setWarrantyItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateWarrantyItem = (index: number, field: keyof WarrantyItem, value: string) => {
    setWarrantyItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const carOptions = (cars?.filter((c) => c.status === 'active') || []).map((car) => ({
    value: car.id,
    label: `${car.vehicle_number} - ${car.model} ${car.fuel_type ? `(${car.fuel_type})` : ''} ${car.seats ? `• ${car.seats} seats` : ''}`,
  }));

  const serviceTypeOptions = [
    { value: 'custom', label: 'Custom Service' },
    ...(serviceRules?.map((rule) => ({
      value: rule.id,
      label: `${rule.name}${rule.is_critical ? ' (Critical)' : ''}`,
    })) || []),
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app/services">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <div>
            <h1 className="page-title">Add Service Record</h1>
            <p className="text-muted-foreground">Record a service for a vehicle</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>General Service is critical every 10,000 km. Completing it on time helps avoid warranty issues.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Service Details
          </CardTitle>
          <CardDescription>
            Enter the service information including vendor and cost
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="car">Vehicle *</Label>
                <SearchableSelect
                  id="car"
                  options={carOptions}
                  value={selectedCarId}
                  onValueChange={setSelectedCarId}
                  placeholder={carsLoading ? 'Loading...' : 'Select a vehicle'}
                  searchPlaceholder="Search vehicles..."
                  disabled={carsLoading}
                />
                {errors.car_id && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.car_id}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_type">Service Type</Label>
                <SearchableSelect
                  id="service_type"
                  options={serviceTypeOptions}
                  value={formData.rule_id || 'custom'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, rule_id: value === 'custom' ? '' : value })
                  }
                  placeholder="Select or custom"
                  searchPlaceholder="Search service types..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_name">Service Name *</Label>
                <Input
                  id="service_name"
                  placeholder="e.g., Oil Change, Brake Pad Replacement"
                  value={formData.service_name}
                  onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                />
                {errors.service_name && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.service_name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviced_at">Service Date *</Label>
                <Input
                  id="serviced_at"
                  type="date"
                  value={formData.serviced_at}
                  onChange={(e) => setFormData({ ...formData, serviced_at: e.target.value })}
                />
                {errors.serviced_at && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.serviced_at}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="odometer_km" className="flex items-center gap-1">
                  Odometer at Service (km) *
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Always enter the latest km from the car meter. If you enter a smaller number, the system blocks it to protect accuracy.</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="odometer_km"
                  type="number"
                  placeholder="e.g., 55000"
                  value={formData.odometer_km}
                  onChange={(e) => setFormData({ ...formData, odometer_km: e.target.value })}
                />
                {latestOdo && (
                  <p className="text-xs text-muted-foreground">
                    Last recorded: {latestOdo.odometer_km.toLocaleString()} km
                  </p>
                )}
                {errors.odometer_km && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.odometer_km}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost">Total Cost (₹)</Label>
                <div className="relative">
                  <Input
                    id="cost"
                    type="number"
                    placeholder="e.g., 5000"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  />
                  {suggestedCost && !formData.cost && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 text-xs text-accent"
                      onClick={applySuggestedCost}
                    >
                      <Lightbulb className="h-3 w-3 mr-1" />
                      ₹{suggestedCost.toLocaleString()}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor_name">Vendor / Garage Name</Label>
                <div className="relative">
                  <Input
                    id="vendor_name"
                    placeholder="e.g., ABC Motors"
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  />
                  {suggestedVendor && !formData.vendor_name && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 text-xs text-accent"
                      onClick={applySuggestedVendor}
                    >
                      <Lightbulb className="h-3 w-3 mr-1" />
                      {suggestedVendor}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor_location">Vendor Location</Label>
                <Input
                  id="vendor_location"
                  placeholder="e.g., Ahmedabad, Gujarat"
                  value={formData.vendor_location}
                  onChange={(e) => setFormData({ ...formData, vendor_location: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about the service..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Warranty Section */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label className="text-base font-medium">Warranty Details (Optional)</Label>
                  <p className="text-xs text-muted-foreground">Add warranty information for parts replaced</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addWarrantyItem}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Part
                </Button>
              </div>
              
              <div className="space-y-4">
                {warrantyItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/30 relative">
                    <div className="space-y-1">
                      <Label className="text-xs">Part/Item Name</Label>
                      <Input
                        placeholder="e.g., Battery, Tyres"
                        value={item.itemName}
                        onChange={(e) => updateWarrantyItem(index, 'itemName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Serial Number</Label>
                      <Input
                        placeholder="e.g., SN-12345"
                        value={item.serialNumber}
                        onChange={(e) => updateWarrantyItem(index, 'serialNumber', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Warranty Expiry</Label>
                      <Input
                        type="date"
                        value={item.expiryDate}
                        onChange={(e) => updateWarrantyItem(index, 'expiryDate', e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      {warrantyItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive"
                          onClick={() => removeWarrantyItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bills / Invoices</Label>
              <p className="text-xs text-muted-foreground">
                Max {MAX_TOTAL_SIZE_MB}MB total. Images: {MAX_IMAGE_SIZE_MB}MB each. PDFs: {MAX_PDF_SIZE_MB}MB each.
              </p>
              
              {/* File list */}
              {billFiles.length > 0 && (
                <div className="space-y-2">
                  {billFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted">
                      {file.type === 'application/pdf' ? (
                        <FileText className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                      )}
                      <span className="flex-1 text-sm truncate">{file.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {formatFileSize(file.size)}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFile(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Total: {formatFileSize(getTotalFileSize())} / {MAX_TOTAL_SIZE_MB}MB
                  </p>
                </div>
              )}

              {/* Upload area with drag-and-drop */}
              <div
                ref={dropZoneRef}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                  isDragging
                    ? 'border-primary bg-primary/5 scale-[1.02]'
                    : 'hover:border-accent hover:bg-muted/50'
                }`}
              >
                <input
                  type="file"
                  id="bill"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                  multiple
                />
                <label htmlFor="bill" className="cursor-pointer block">
                  <Upload className={`h-8 w-8 mx-auto mb-2 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className={`text-sm font-medium ${isDragging ? 'text-primary' : 'text-foreground'}`}>
                    {isDragging ? 'Drop files here' : 'Drag & drop bills here'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to browse • paste from clipboard (Ctrl+V)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, JPG, PNG accepted
                  </p>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" asChild>
                <Link to="/app/services">Cancel</Link>
              </Button>
              <Button
                type="submit"
                disabled={!selectedCarId || createRecord.isPending || isUploading}
              >
                {createRecord.isPending || isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isUploading ? 'Uploading...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Wrench className="h-4 w-4" />
                    Save Service Record
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lower Odometer Warning Dialog */}
      <AlertDialog open={showOdoWarning} onOpenChange={setShowOdoWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Lower Odometer Reading
            </AlertDialogTitle>
            <AlertDialogDescription>
              The odometer reading ({pendingSubmit?.odometer_km?.toLocaleString()} km) is lower than
              the current latest reading ({latestOdo?.odometer_km.toLocaleString()} km).
              <br /><br />
              Since the service date is older than the last reading, this is allowed but will not
              update the current odometer.
              <br /><br />
              Are you sure you want to save this record?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLowerOdo}>Yes, Save Record</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspicious Jump Dialog */}
      <AlertDialog open={showSuspiciousJump} onOpenChange={setShowSuspiciousJump}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Double-Check Required
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>The odometer jump seems unusually high:</p>
              <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
                <p><strong>Last reading:</strong> {latestOdo?.odometer_km.toLocaleString()} km</p>
                <p><strong>New reading:</strong> {pendingSubmit?.odometer_km?.toLocaleString()} km</p>
                <p><strong>Difference:</strong> {((pendingSubmit?.odometer_km || 0) - (latestOdo?.odometer_km || 0)).toLocaleString()} km</p>
              </div>
              <p className="pt-2">Please verify the reading is correct before confirming.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSuspiciousJump}>Yes, Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
