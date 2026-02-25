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
import { ArrowLeft, Car, Loader2, AlertCircle, Upload, X, FileText, Image as ImageIcon, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationSettings } from '@/hooks/use-organization-settings';
import {
  type FleetNewCarFormConfig,
  type FleetNewCarBuiltInFieldKey,
  type FleetNewCarDocumentTypeKey,
  FLEET_NEW_CAR_FIELD_LABELS,
  FLEET_NEW_CAR_DOC_LABELS,
} from '@/types/form-config';

/** Build zod schema from org form config (current behaviour when config is empty). */
function buildCarSchema(config: FleetNewCarFormConfig | null | undefined) {
  const overrides = config?.fieldOverrides ?? {};
  const defaultRequired = (key: FleetNewCarBuiltInFieldKey) => (key === 'notes' ? false : true);
  const isHidden = (key: FleetNewCarBuiltInFieldKey) => overrides[key]?.hidden === true;
  const isRequired = (key: FleetNewCarBuiltInFieldKey) => overrides[key]?.required ?? defaultRequired(key);

  const shape: Record<string, z.ZodTypeAny> = {};
  if (!isHidden('vehicle_number')) {
    shape.vehicle_number = isRequired('vehicle_number')
      ? z.string().min(1, 'Vehicle number is required').max(20, 'Vehicle number too long')
      : z.string().max(20).optional().or(z.literal(''));
  }
  if (!isHidden('brand')) {
    shape.brand = isRequired('brand') ? z.string().min(1, 'Brand is required').max(50) : z.string().max(50).optional().or(z.literal(''));
  }
  if (!isHidden('model')) {
    shape.model = isRequired('model') ? z.string().min(1, 'Model is required').max(100) : z.string().max(100).optional().or(z.literal(''));
  }
  if (!isHidden('year')) {
    shape.year = isRequired('year')
      ? z.number().min(1900).max(new Date().getFullYear() + 1)
      : z.number().min(1900).max(new Date().getFullYear() + 1).optional();
  }
  if (!isHidden('fuel_type')) {
    shape.fuel_type = isRequired('fuel_type') ? z.string().min(1, 'Fuel type is required') : z.string().optional().or(z.literal(''));
  }
  if (!isHidden('seats')) {
    shape.seats = z.number().min(2, 'Minimum 2 seats').max(50, 'Maximum 50 seats');
  }
  if (!isHidden('vehicle_type')) {
    shape.vehicle_type = isRequired('vehicle_type')
      ? z.enum(['private', 'commercial'], { required_error: 'Vehicle type is required' })
      : z.enum(['private', 'commercial']).optional();
  }
  if (!isHidden('vehicle_class')) {
    shape.vehicle_class = isRequired('vehicle_class')
      ? z.enum(['lmv', 'hmv'], { required_error: 'Vehicle class is required' })
      : z.enum(['lmv', 'hmv']).optional();
  }
  if (!isHidden('owner_name')) {
    shape.owner_name = isRequired('owner_name') ? z.string().min(1, 'Owner name is required').max(100) : z.string().max(100).optional().or(z.literal(''));
  }
  if (!isHidden('initial_odometer')) {
    shape.initial_odometer = isRequired('initial_odometer') ? z.number().min(0, 'Odometer must be positive') : z.number().min(0).optional();
  }
  if (!isHidden('vin_chassis')) {
    shape.vin_chassis = isRequired('vin_chassis') ? z.string().min(1, 'VIN/Chassis is required').max(50) : z.string().max(50).optional().or(z.literal(''));
  }
  if (!isHidden('notes')) {
    shape.notes = z.string().max(500).optional();
  }
  return z.object(shape);
}

type CarFormData = z.infer<ReturnType<typeof buildCarSchema>>;

interface DocumentUpload {
  file: File | null;
  expiryDate: string;
}

export default function FleetNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: orgSettings } = useOrganizationSettings();
  const formConfig = orgSettings?.fleet_new_car_form_config ?? null;
  const createCar = useCreateCar();
  const upsertDocument = useUpsertCarDocument();

  const fieldOverrides = formConfig?.fieldOverrides ?? {};
  const docTypesConfig = formConfig?.documentTypes ?? {};
  const customFields = (formConfig?.customFields ?? []).sort((a, b) => a.order - b.order);
  const getFieldLabel = (key: FleetNewCarBuiltInFieldKey) => fieldOverrides[key]?.label ?? FLEET_NEW_CAR_FIELD_LABELS[key];
  const isFieldHidden = (key: FleetNewCarBuiltInFieldKey) => fieldOverrides[key]?.hidden === true;
  const isFieldRequired = (key: FleetNewCarBuiltInFieldKey) => fieldOverrides[key]?.required ?? (key !== 'notes');
  const getDocLabel = (key: FleetNewCarDocumentTypeKey) => docTypesConfig[key]?.label ?? FLEET_NEW_CAR_DOC_LABELS[key];
  const isDocShown = (key: FleetNewCarDocumentTypeKey) => docTypesConfig[key]?.show !== false;
  const isDocRequired = (key: FleetNewCarDocumentTypeKey) => docTypesConfig[key]?.required === true;
  const carSchema = buildCarSchema(formConfig);

  const [formData, setFormData] = useState({
    vehicle_number: '',
    brand: '',
    model: '',
    year: '',
    fuel_type: '',
    seats: '5',
    customSeats: '',
    vehicle_type: '',
    vehicle_class: '',
    owner_name: '',
    initial_odometer: '',
    vin_chassis: '',
    notes: '',
    on_permanent_assignment: false,
    permanent_assignment_note: '',
  });
  const [customValues, setCustomValues] = useState<Record<string, string | number>>({});
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

    const seatCount = formData.seats === '9+' ? (parseInt(formData.customSeats) || 9) : (parseInt(formData.seats) || 5);

    const parsed: Record<string, unknown> = {};
    if (!isFieldHidden('vehicle_number')) parsed.vehicle_number = formData.vehicle_number.trim();
    if (!isFieldHidden('brand')) parsed.brand = formData.brand.trim();
    if (!isFieldHidden('model')) parsed.model = formData.model.trim();
    if (!isFieldHidden('year')) parsed.year = formData.year ? parseInt(formData.year) : undefined;
    if (!isFieldHidden('fuel_type')) parsed.fuel_type = formData.fuel_type;
    if (!isFieldHidden('seats')) parsed.seats = seatCount;
    if (!isFieldHidden('vehicle_type')) parsed.vehicle_type = formData.vehicle_type || undefined;
    if (!isFieldHidden('vehicle_class')) parsed.vehicle_class = formData.vehicle_class || undefined;
    if (!isFieldHidden('owner_name')) parsed.owner_name = formData.owner_name.trim();
    if (!isFieldHidden('initial_odometer')) parsed.initial_odometer = parseInt(formData.initial_odometer) || 0;
    if (!isFieldHidden('vin_chassis')) parsed.vin_chassis = formData.vin_chassis.trim();
    if (!isFieldHidden('notes')) parsed.notes = formData.notes?.trim() || undefined;

    const result = carSchema.safeParse(parsed);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    const data = result.data as Record<string, unknown>;
    const customAttrs: Record<string, string | number | boolean | null> = {};
    for (const f of customFields) {
      const val = customValues[f.key];
      if (f.required && (val === undefined || val === '')) {
        setErrors((prev) => ({ ...prev, [f.key]: `${f.label} is required` }));
        return;
      }
      if (val !== undefined && val !== '') customAttrs[f.key] = typeof val === 'number' ? val : String(val);
    }

    const docTypesAll: FleetNewCarDocumentTypeKey[] = ['rc', 'puc', 'insurance', 'warranty', 'permits', 'fitness'];
    for (const docType of docTypesAll) {
      if (!isDocShown(docType)) continue;
      if (isDocRequired(docType)) {
        const doc = documents[docType];
        if (!doc.file && !doc.expiryDate) {
          setErrors((prev) => ({ ...prev, [`doc_${docType}`]: `${getDocLabel(docType)} is required` }));
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const newCar = await createCar.mutateAsync({
        vehicle_number: (data.vehicle_number as string) ?? '',
        brand: (data.brand as string) ?? undefined,
        model: (data.model as string) ?? '',
        year: data.year as number | undefined,
        fuel_type: (data.fuel_type as string) ?? undefined,
        seats: (data.seats as number) ?? 5,
        vehicle_type: (data.vehicle_type as 'private' | 'commercial') ?? undefined,
        vehicle_class: (data.vehicle_class as 'lmv' | 'hmv') ?? 'lmv',
        owner_name: (data.owner_name as string) ?? undefined,
        vin_chassis: (data.vin_chassis as string) ?? undefined,
        notes: (data.notes as string) ?? undefined,
        initial_odometer: (data.initial_odometer as number) ?? 0,
        custom_attributes: Object.keys(customAttrs).length ? customAttrs : undefined,
        on_permanent_assignment: formData.on_permanent_assignment,
        permanent_assignment_note: formData.permanent_assignment_note?.trim() || null,
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

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-center gap-4">
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

      <Card className="mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Car className="h-5 w-5" />
            Vehicle Details
          </CardTitle>
          <CardDescription className="text-center">
            Enter the vehicle information. Initial odometer creates the first reading automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isFieldHidden('owner_name') && (
              <div className="space-y-2">
                <Label htmlFor="owner_name">{getFieldLabel('owner_name')}{isFieldRequired('owner_name') ? ' *' : ''}</Label>
                <Input
                  id="owner_name"
                  placeholder="e.g., John Doe"
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  required={isFieldRequired('owner_name')}
                />
                {errors.owner_name && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.owner_name}
                  </p>
                )}
              </div>
              )}

              {!isFieldHidden('vehicle_type') && (
              <div className="space-y-2">
                <Label htmlFor="vehicle_type">{getFieldLabel('vehicle_type')}{isFieldRequired('vehicle_type') ? ' *' : ''}</Label>
                <Select
                  value={formData.vehicle_type}
                  onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}
                  required={isFieldRequired('vehicle_type')}
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
              )}

              {!isFieldHidden('vehicle_class') && (
              <div className="space-y-2">
                <Label htmlFor="vehicle_class">{getFieldLabel('vehicle_class')}{isFieldRequired('vehicle_class') ? ' *' : ''}</Label>
                <Select
                  value={formData.vehicle_class}
                  onValueChange={(value) => setFormData({ ...formData, vehicle_class: value })}
                  required={isFieldRequired('vehicle_class')}
                >
                  <SelectTrigger id="vehicle_class">
                    <SelectValue placeholder="LMV or HMV" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lmv">LMV (Light Motor Vehicle)</SelectItem>
                    <SelectItem value="hmv">HMV (Heavy Motor Vehicle)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.vehicle_class && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.vehicle_class}
                  </p>
                )}
              </div>
              )}

              {!isFieldHidden('vehicle_number') && (
              <div className="space-y-2">
                <Label htmlFor="vehicle_number">{getFieldLabel('vehicle_number')}{isFieldRequired('vehicle_number') ? ' *' : ''}</Label>
                <Input
                  id="vehicle_number"
                  placeholder="e.g., GJ-01-AB-1234"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })}
                  required={isFieldRequired('vehicle_number')}
                />
                {errors.vehicle_number && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.vehicle_number}
                  </p>
                )}
              </div>
              )}

              {!isFieldHidden('brand') && (
              <div className="space-y-2">
                <BrandAutocomplete
                  brand={formData.brand}
                  onBrandChange={(brand) => setFormData({ ...formData, brand })}
                  required={isFieldRequired('brand')}
                />
                {errors.brand && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.brand}
                  </p>
                )}
              </div>
              )}

              {!isFieldHidden('model') && (
              <div className="space-y-2">
                <Label htmlFor="model">{getFieldLabel('model')}{isFieldRequired('model') ? ' *' : ''}</Label>
                <Input
                  id="model"
                  placeholder="e.g., Innova"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  required={isFieldRequired('model')}
                />
                {errors.model && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.model}
                  </p>
                )}
              </div>
              )}

              {!isFieldHidden('year') && (
              <div className="space-y-2">
                <Label htmlFor="year">{getFieldLabel('year')}{isFieldRequired('year') ? ' *' : ''}</Label>
                <Input
                  id="year"
                  type="number"
                  placeholder="e.g., 2022"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  required={isFieldRequired('year')}
                />
                {errors.year && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.year}
                  </p>
                )}
              </div>
              )}

              {!isFieldHidden('fuel_type') && (
              <div className="space-y-2">
                <Label htmlFor="fuel_type">{getFieldLabel('fuel_type')}{isFieldRequired('fuel_type') ? ' *' : ''}</Label>
                <Select
                  value={formData.fuel_type}
                  onValueChange={(value) => setFormData({ ...formData, fuel_type: value })}
                  required={isFieldRequired('fuel_type')}
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
              )}

              {!isFieldHidden('seats') && (
              <div className="space-y-2">
                <Label htmlFor="seats">{getFieldLabel('seats')}{isFieldRequired('seats') ? ' *' : ''}</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.seats}
                    onValueChange={(value) => setFormData({ ...formData, seats: value, customSeats: '' })}
                    required={isFieldRequired('seats')}
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
              )}

              {!isFieldHidden('initial_odometer') && (
              <div className="space-y-2">
                <Label htmlFor="initial_odometer">{getFieldLabel('initial_odometer')}{isFieldRequired('initial_odometer') ? ' *' : ''}</Label>
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
              )}

              {!isFieldHidden('vin_chassis') && (
              <div className="space-y-2">
                <Label htmlFor="vin_chassis">{getFieldLabel('vin_chassis')}{isFieldRequired('vin_chassis') ? ' *' : ''}</Label>
                <Input
                  id="vin_chassis"
                  placeholder="e.g., ABC123456789"
                  value={formData.vin_chassis}
                  onChange={(e) => setFormData({ ...formData, vin_chassis: e.target.value })}
                  required={isFieldRequired('vin_chassis')}
                />
                {errors.vin_chassis && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.vin_chassis}
                  </p>
                )}
              </div>
              )}
            </div>

            {!isFieldHidden('notes') && (
            <div className="space-y-2">
              <Label htmlFor="notes">{getFieldLabel('notes')}{isFieldRequired('notes') ? ' *' : ''}</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about the vehicle..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            )}

            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-medium">Permanent assignment</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                When on, this vehicle will not appear in booking assignment or check availability.
              </p>
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.on_permanent_assignment}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, on_permanent_assignment: checked })
                  }
                />
                <span className="text-sm">
                  {formData.on_permanent_assignment ? 'On assignment (excluded from bookings)' : 'Available for bookings'}
                </span>
              </div>
              {formData.on_permanent_assignment && (
                <div className="space-y-2">
                  <Label htmlFor="permanent_assignment_note">Assigned to (optional)</Label>
                  <Input
                    id="permanent_assignment_note"
                    placeholder="e.g. Driver name, CEO car"
                    value={formData.permanent_assignment_note}
                    onChange={(e) =>
                      setFormData({ ...formData, permanent_assignment_note: e.target.value })
                    }
                  />
                </div>
              )}
            </div>

            {customFields.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <Label className="text-base font-medium">Custom fields</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <Select
                        value={String(customValues[f.key] ?? '')}
                        onValueChange={(v) => setCustomValues((prev) => ({ ...prev, [f.key]: v }))}
                      >
                        <SelectTrigger id={`custom-${f.key}`}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {errors[f.key] && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors[f.key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* Document Uploads */}
            <div className="border-t pt-4">
              <Label className="text-base font-medium">Vehicle Documents</Label>
              <p className="text-xs text-muted-foreground mb-4">Upload vehicle documents with expiry dates</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['rc', 'puc', 'insurance', 'warranty', 'permits', 'fitness'] as DocumentType[]).map((docType) => {
                  if (!isDocShown(docType)) return null;
                  if (docType === 'fitness' && formData.vehicle_type !== 'commercial') return null;
                  return (
                  <div key={docType} className="border rounded-lg p-4 space-y-3">
                    <Label className="font-medium">{getDocLabel(docType)}{isDocRequired(docType) ? ' *' : ''}</Label>
                    
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
