import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCreateCar } from '@/hooks/use-cars';
import { useUpsertCarDocument, DocumentType } from '@/hooks/use-car-documents';
import { BrandAutocomplete } from '@/components/fleet/BrandAutocomplete';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Car, Loader2, AlertCircle, Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

const carSchema = z.object({
  vehicle_number: z.string().min(1, 'Vehicle number is required').max(20, 'Vehicle number too long'),
  brand: z.string().min(1, 'Brand is required').max(50, 'Brand name too long'),
  model: z.string().min(1, 'Model is required').max(100, 'Model name too long'),
  year: z.number().min(1900, 'Year must be valid').max(new Date().getFullYear() + 1, 'Year cannot be in the future'),
  fuel_type: z.string().min(1, 'Fuel type is required'),
  seats: z.number().min(2, 'Minimum 2 seats').max(50, 'Maximum 50 seats'),
  vehicle_type: z.enum(['private', 'commercial'], { required_error: 'Vehicle type is required' }),
  owner_name: z.string().min(1, 'Owner name is required').max(100, 'Owner name too long'),
  initial_odometer: z.number().min(0, 'Odometer must be positive'),
  vin_chassis: z.string().min(1, 'VIN/Chassis number is required').max(50, 'VIN/Chassis number too long'),
  notes: z.string().max(500).optional(),
});

type CarFormData = z.infer<typeof carSchema>;

interface DocumentUpload {
  file: File | null;
  expiryDate: string;
}

export default function FleetNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createCar = useCreateCar();
  const upsertDocument = useUpsertCarDocument();
  
  const [formData, setFormData] = useState({
    vehicle_number: '',
    brand: '',
    model: '',
    year: '',
    fuel_type: '',
    seats: '5',
    customSeats: '',
    vehicle_type: '',
    owner_name: '',
    initial_odometer: '',
    vin_chassis: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Document uploads
  const [documents, setDocuments] = useState<Record<DocumentType, DocumentUpload & { insuranceProviderName?: string }>>({
    rc: { file: null, expiryDate: '' },
    puc: { file: null, expiryDate: '' },
    insurance: { file: null, expiryDate: '', insuranceProviderName: '' },
    warranty: { file: null, expiryDate: '' },
    permits: { file: null, expiryDate: '' },
    fitness: { file: null, expiryDate: '' },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Handle custom seats for 9+ option
    const seatCount = formData.seats === '9+' 
      ? (parseInt(formData.customSeats) || 9)
      : (parseInt(formData.seats) || 5);

    const parsed: CarFormData = {
      vehicle_number: formData.vehicle_number.trim(),
      brand: formData.brand.trim(),
      model: formData.model.trim(),
      year: parseInt(formData.year),
      fuel_type: formData.fuel_type,
      seats: seatCount,
      vehicle_type: formData.vehicle_type as 'private' | 'commercial',
      owner_name: formData.owner_name.trim(),
      initial_odometer: parseInt(formData.initial_odometer) || 0,
      vin_chassis: formData.vin_chassis.trim(),
      notes: formData.notes?.trim() || undefined,
    };

    const result = carSchema.safeParse(parsed);
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

    setIsSubmitting(true);
    try {
      const newCar = await createCar.mutateAsync({
        vehicle_number: result.data.vehicle_number,
        brand: result.data.brand,
        model: result.data.model,
        year: result.data.year ?? undefined,
        fuel_type: result.data.fuel_type,
        seats: result.data.seats ?? 5,
        vehicle_type: result.data.vehicle_type,
        owner_name: result.data.owner_name,
        vin_chassis: result.data.vin_chassis,
        notes: result.data.notes,
        initial_odometer: result.data.initial_odometer,
      });

      // Upload documents after car is created
      if (newCar?.id) {
        const docTypes: DocumentType[] = ['rc', 'puc', 'insurance', 'warranty', 'permits', 'fitness'];
        for (const docType of docTypes) {
          const doc = documents[docType];
          // Only upload fitness if vehicle is commercial
          if (docType === 'fitness' && formData.vehicle_type !== 'commercial') {
            continue;
          }
          if (doc.file || doc.expiryDate || (docType === 'insurance' && doc.insuranceProviderName)) {
            await upsertDocument.mutateAsync({
              carId: newCar.id,
              documentType: docType,
              expiryDate: doc.expiryDate || null,
              file: doc.file || undefined,
              insuranceProviderName: docType === 'insurance' ? (doc.insuranceProviderName || null) : null,
            });
          }
        }
      }

      toast({
        title: 'Vehicle added',
        description: 'Vehicle and documents saved successfully.',
      });
      navigate('/app/fleet');
    } catch (error) {
      // Error is handled by the mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDocumentFile = (docType: DocumentType, file: File | null) => {
    setDocuments(prev => ({
      ...prev,
      [docType]: { ...prev[docType], file },
    }));
  };

  const handleDocumentExpiry = (docType: DocumentType, expiryDate: string) => {
    setDocuments(prev => ({
      ...prev,
      [docType]: { ...prev[docType], expiryDate },
    }));
  };

  const handleInsuranceProviderName = (providerName: string) => {
    setDocuments(prev => ({
      ...prev,
      insurance: { ...prev.insurance, insuranceProviderName: providerName },
    }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const documentLabels: Record<DocumentType, string> = {
    rc: 'RC Book',
    puc: 'PUC Certificate',
    insurance: 'Insurance',
    warranty: 'Warranty',
    permits: 'Permits',
    fitness: 'Fitness Certificate',
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app/fleet">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="page-title">Add Vehicle</h1>
          <p className="text-muted-foreground">Add a new vehicle to your fleet</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Vehicle Details
          </CardTitle>
          <CardDescription>
            Enter the vehicle information. Initial odometer creates the first reading automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner_name">Owner Name *</Label>
                <Input
                  id="owner_name"
                  placeholder="e.g., John Doe"
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  required
                />
                {errors.owner_name && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.owner_name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_type">Category *</Label>
                <Select
                  value={formData.vehicle_type}
                  onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}
                  required
                >
                  <SelectTrigger id="vehicle_type">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
                {errors.vehicle_type && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.vehicle_type}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_number">Vehicle Number *</Label>
                <Input
                  id="vehicle_number"
                  placeholder="e.g., GJ-01-AB-1234"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })}
                  required
                />
                {errors.vehicle_number && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.vehicle_number}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <BrandAutocomplete
                  brand={formData.brand}
                  onBrandChange={(brand) => setFormData({ ...formData, brand })}
                  required
                />
                {errors.brand && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.brand}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  placeholder="e.g., Innova"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  required
                />
                {errors.model && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.model}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Year *</Label>
                <Input
                  id="year"
                  type="number"
                  placeholder="e.g., 2022"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  required
                />
                {errors.year && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.year}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuel_type">Fuel Type *</Label>
                <Select
                  value={formData.fuel_type}
                  onValueChange={(value) => setFormData({ ...formData, fuel_type: value })}
                  required
                >
                  <SelectTrigger id="fuel_type">
                    <SelectValue placeholder="Select fuel type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Petrol">Petrol</SelectItem>
                    <SelectItem value="Diesel">Diesel</SelectItem>
                    <SelectItem value="CNG">CNG</SelectItem>
                    <SelectItem value="Electric">Electric</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
                {errors.fuel_type && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.fuel_type}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="seats">Number of Seats *</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.seats}
                    onValueChange={(value) => setFormData({ ...formData, seats: value, customSeats: '' })}
                    required
                  >
                    <SelectTrigger id="seats" className={formData.seats === '9+' ? 'w-[120px]' : 'w-full'}>
                      <SelectValue placeholder="Select seats" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 Seater</SelectItem>
                      <SelectItem value="5">5 Seater</SelectItem>
                      <SelectItem value="6">6 Seater</SelectItem>
                      <SelectItem value="7">7 Seater</SelectItem>
                      <SelectItem value="8">8 Seater</SelectItem>
                      <SelectItem value="9+">9+ Seater</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.seats === '9+' && (
                    <Input
                      type="number"
                      placeholder="e.g., 22"
                      value={formData.customSeats}
                      onChange={(e) => setFormData({ ...formData, customSeats: e.target.value })}
                      min={9}
                      max={50}
                      className="w-24"
                      required
                    />
                  )}
                </div>
                {errors.seats && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.seats}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="initial_odometer">Initial Odometer (km) *</Label>
                <Input
                  id="initial_odometer"
                  type="number"
                  placeholder="e.g., 50000"
                  value={formData.initial_odometer}
                  onChange={(e) => setFormData({ ...formData, initial_odometer: e.target.value })}
                />
                {errors.initial_odometer && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.initial_odometer}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="vin_chassis">VIN / Chassis Number *</Label>
                <Input
                  id="vin_chassis"
                  placeholder="e.g., ABC123456789"
                  value={formData.vin_chassis}
                  onChange={(e) => setFormData({ ...formData, vin_chassis: e.target.value })}
                  required
                />
                {errors.vin_chassis && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.vin_chassis}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about the vehicle..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Document Uploads */}
            <div className="border-t pt-4">
              <Label className="text-base font-medium">Vehicle Documents</Label>
              <p className="text-xs text-muted-foreground mb-4">Upload vehicle documents with expiry dates</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['rc', 'puc', 'insurance', 'warranty', 'permits', 'fitness'] as DocumentType[]).map((docType) => {
                  // Hide fitness if vehicle is not commercial
                  if (docType === 'fitness' && formData.vehicle_type !== 'commercial') {
                    return null;
                  }
                  
                  return (
                  <div key={docType} className="border rounded-lg p-4 space-y-3">
                    <Label className="font-medium">{documentLabels[docType]}</Label>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`${docType}-expiry`} className="text-xs text-muted-foreground">Expiry Date</Label>
                      <Input
                        id={`${docType}-expiry`}
                        type="date"
                        value={documents[docType].expiryDate}
                        onChange={(e) => handleDocumentExpiry(docType, e.target.value)}
                      />
                    </div>
                    
                    {/* Insurance Provider Name - only for insurance */}
                    {docType === 'insurance' && (
                      <div className="space-y-2">
                        <Label htmlFor="insurance-provider" className="text-xs text-muted-foreground">Insurance Provider Name</Label>
                        <Input
                          id="insurance-provider"
                          placeholder="e.g., HDFC Ergo, ICICI Lombard"
                          value={documents.insurance.insuranceProviderName || ''}
                          onChange={(e) => handleInsuranceProviderName(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Upload Document</Label>
                      {documents[docType].file ? (
                        <div className="flex items-center gap-2 p-2 rounded bg-muted">
                          {documents[docType].file!.type === 'application/pdf' ? (
                            <FileText className="h-4 w-4 text-destructive shrink-0" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                          )}
                          <span className="flex-1 text-sm truncate">{documents[docType].file!.name}</span>
                          <span className="text-xs text-muted-foreground">{formatFileSize(documents[docType].file!.size)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleDocumentFile(docType, null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <label
                          htmlFor={`${docType}-file`}
                          className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-accent hover:bg-muted/50 transition-colors"
                        >
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Upload PDF or Image</span>
                          <input
                            id={`${docType}-file`}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              handleDocumentFile(docType, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" asChild>
                <Link to="/app/fleet">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Car className="h-4 w-4" />
                    Add Vehicle
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
