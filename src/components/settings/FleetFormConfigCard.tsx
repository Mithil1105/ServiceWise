import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Car, Plus, Trash2, GripVertical } from 'lucide-react';
import { useOrganizationSettings, useUpdateOrganizationSettings } from '@/hooks/use-organization-settings';
import {
  type FleetNewCarFormConfig,
  type FleetNewCarBuiltInFieldKey,
  type FleetNewCarDocumentTypeKey,
  type FleetNewCarCustomField,
  type FieldOverride,
  type DocumentTypeConfig,
  type SelectOption,
  FLEET_NEW_CAR_FIELD_LABELS,
  FLEET_NEW_CAR_DOC_LABELS,
  DEFAULT_VEHICLE_TYPE_OPTIONS,
  DEFAULT_VEHICLE_CLASS_OPTIONS,
  DEFAULT_FUEL_TYPE_OPTIONS,
  DEFAULT_SEATS_OPTIONS,
  type CustomFieldType,
} from '@/types/form-config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const BUILT_IN_FIELDS: FleetNewCarBuiltInFieldKey[] = [
  'owner_name',
  'vehicle_type',
  'vehicle_class',
  'vehicle_number',
  'brand',
  'model',
  'year',
  'fuel_type',
  'seats',
  'initial_odometer',
  'vin_chassis',
  'notes',
];

const DOC_TYPES: FleetNewCarDocumentTypeKey[] = ['rc', 'puc', 'insurance', 'warranty', 'permits', 'fitness'];

const CUSTOM_FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown (select)' },
];

function defaultFieldOverride(): FieldOverride {
  return { required: true, hidden: false, label: undefined };
}

function defaultDocConfig(): DocumentTypeConfig {
  return { show: true, required: false, label: undefined };
}

interface FleetFormConfigCardProps {
  onDirtyChange?: (dirty: boolean) => void;
}

export function FleetFormConfigCard({ onDirtyChange }: FleetFormConfigCardProps = {}) {
  const { data: orgSettings } = useOrganizationSettings();
  const updateSettings = useUpdateOrganizationSettings();
  const config: FleetNewCarFormConfig = orgSettings?.fleet_new_car_form_config ?? {};

  const [fieldOverrides, setFieldOverrides] = useState<Partial<Record<FleetNewCarBuiltInFieldKey, FieldOverride>>>({});
  const [documentTypes, setDocumentTypes] = useState<Partial<Record<FleetNewCarDocumentTypeKey, DocumentTypeConfig>>>({});
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState<SelectOption[]>([]);
  const [vehicleClassOptions, setVehicleClassOptions] = useState<SelectOption[]>([]);
  const [fuelTypeOptions, setFuelTypeOptions] = useState<SelectOption[]>([]);
  const [seatsOptions, setSeatsOptions] = useState<SelectOption[]>([]);
  const [customFields, setCustomFields] = useState<FleetNewCarCustomField[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFieldOverrides(config.fieldOverrides ?? {});
    setDocumentTypes(config.documentTypes ?? {});
    setVehicleTypeOptions(config.vehicleTypeOptions?.length ? [...config.vehicleTypeOptions] : [...DEFAULT_VEHICLE_TYPE_OPTIONS]);
    setVehicleClassOptions(config.vehicleClassOptions?.length ? [...config.vehicleClassOptions] : [...DEFAULT_VEHICLE_CLASS_OPTIONS]);
    setFuelTypeOptions(config.fuelTypeOptions?.length ? [...config.fuelTypeOptions] : [...DEFAULT_FUEL_TYPE_OPTIONS]);
    setSeatsOptions(config.seatsOptions?.length ? [...config.seatsOptions] : [...DEFAULT_SEATS_OPTIONS]);
    setCustomFields(config.customFields ?? []);
  }, [config.fieldOverrides, config.documentTypes, config.vehicleTypeOptions, config.vehicleClassOptions, config.fuelTypeOptions, config.seatsOptions, config.customFields]);

  useEffect(() => {
    const saved = JSON.stringify({
      fieldOverrides: config.fieldOverrides ?? {},
      documentTypes: config.documentTypes ?? {},
      vehicleTypeOptions: config.vehicleTypeOptions ?? DEFAULT_VEHICLE_TYPE_OPTIONS,
      vehicleClassOptions: config.vehicleClassOptions ?? DEFAULT_VEHICLE_CLASS_OPTIONS,
      fuelTypeOptions: config.fuelTypeOptions ?? DEFAULT_FUEL_TYPE_OPTIONS,
      seatsOptions: config.seatsOptions ?? DEFAULT_SEATS_OPTIONS,
      customFields: config.customFields ?? [],
    });
    const current = JSON.stringify({ fieldOverrides, documentTypes, vehicleTypeOptions, vehicleClassOptions, fuelTypeOptions, seatsOptions, customFields });
    onDirtyChange?.(saved !== current);
  }, [fieldOverrides, documentTypes, vehicleTypeOptions, vehicleClassOptions, fuelTypeOptions, seatsOptions, customFields, config, onDirtyChange]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const clean = (opts: SelectOption[]) => opts.filter((o) => o.value.trim() && o.label.trim());
      await updateSettings.mutateAsync({
        fleet_new_car_form_config: {
          fieldOverrides: Object.keys(fieldOverrides).length ? fieldOverrides : undefined,
          documentTypes: Object.keys(documentTypes).length ? documentTypes : undefined,
          vehicleTypeOptions: clean(vehicleTypeOptions).length > 0 ? clean(vehicleTypeOptions) : undefined,
          vehicleClassOptions: clean(vehicleClassOptions).length > 0 ? clean(vehicleClassOptions) : undefined,
          fuelTypeOptions: clean(fuelTypeOptions).length > 0 ? clean(fuelTypeOptions) : undefined,
          seatsOptions: clean(seatsOptions).length > 0 ? clean(seatsOptions) : undefined,
          customFields: customFields.length ? customFields : undefined,
        },
      });
      onDirtyChange?.(false);
    } finally {
      setSaving(false);
    }
  };

  const setFieldOverride = (key: FleetNewCarBuiltInFieldKey, override: FieldOverride) => {
    setFieldOverrides((prev) => ({ ...prev, [key]: { ...(prev[key] ?? defaultFieldOverride()), ...override } }));
  };

  const setDocConfig = (key: FleetNewCarDocumentTypeKey, docConfig: DocumentTypeConfig) => {
    setDocumentTypes((prev) => ({ ...prev, [key]: { ...(prev[key] ?? defaultDocConfig()), ...docConfig } }));
  };

  const addCustomField = () => {
    const id = `custom-${Date.now()}`;
    setCustomFields((prev) => [...prev, { id, key: `field_${prev.length + 1}`, label: 'New field', type: 'text', required: false, order: prev.length }]);
  };

  const updateCustomField = (id: string, updates: Partial<FleetNewCarCustomField>) => {
    setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const moveCustomField = (index: number, direction: 1 | -1) => {
    const next = index + direction;
    if (next < 0 || next >= customFields.length) return;
    const reordered = [...customFields];
    const [removed] = reordered.splice(index, 1);
    reordered.splice(next, 0, removed);
    setCustomFields(reordered.map((f, i) => ({ ...f, order: i })));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="h-5 w-5" />
          Add vehicle form
        </CardTitle>
        <CardDescription>
          Configure which fields are required or hidden, labels, document types, and add custom fields for the Add Vehicle form.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Built-in fields */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Built-in fields</Label>
          <p className="text-sm text-muted-foreground">Set required, hidden, or custom label for each field. Defaults match current form behaviour.</p>
          <div className="rounded-md border divide-y">
            {BUILT_IN_FIELDS.map((key) => {
              const override = fieldOverrides[key] ?? defaultFieldOverride();
              const defaultLabel = FLEET_NEW_CAR_FIELD_LABELS[key];
              return (
                <div key={key} className="flex flex-wrap items-center gap-4 p-3">
                  <span className="font-mono text-sm w-36 shrink-0">{defaultLabel}</span>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <label className="flex items-center gap-2 whitespace-nowrap">
                      <Switch
                        checked={!override.hidden}
                        onCheckedChange={(checked) => setFieldOverride(key, { ...override, hidden: !checked })}
                      />
                      <span className="text-sm">Show</span>
                    </label>
                    <label className="flex items-center gap-2 whitespace-nowrap">
                      <Switch
                        checked={override.required ?? true}
                        onCheckedChange={(checked) => setFieldOverride(key, { ...override, required: checked })}
                      />
                      <span className="text-sm">Required</span>
                    </label>
                    <Input
                      placeholder={`Label (default: ${defaultLabel})`}
                      value={override.label ?? ''}
                      onChange={(e) => setFieldOverride(key, { ...override, label: e.target.value || undefined })}
                      className="max-w-[200px]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Document types */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Document types</Label>
          <p className="text-sm text-muted-foreground">Show/hide and set required for the six document types (RC, PUC, Insurance, etc.).</p>
          <div className="rounded-md border divide-y">
            {DOC_TYPES.map((key) => {
              const doc = documentTypes[key] ?? defaultDocConfig();
              const defaultLabel = FLEET_NEW_CAR_DOC_LABELS[key];
              return (
                <div key={key} className="flex flex-wrap items-center gap-4 p-3">
                  <span className="font-mono text-sm w-40 shrink-0">{defaultLabel}</span>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <label className="flex items-center gap-2 whitespace-nowrap">
                      <Switch
                        checked={doc.show !== false}
                        onCheckedChange={(checked) => setDocConfig(key, { ...doc, show: checked })}
                      />
                      <span className="text-sm">Show</span>
                    </label>
                    <label className="flex items-center gap-2 whitespace-nowrap">
                      <Switch
                        checked={doc.required ?? false}
                        onCheckedChange={(checked) => setDocConfig(key, { ...doc, required: checked })}
                      />
                      <span className="text-sm">Required</span>
                    </label>
                    <Input
                      placeholder={`Label (default: ${defaultLabel})`}
                      value={doc.label ?? ''}
                      onChange={(e) => setDocConfig(key, { ...doc, label: e.target.value || undefined })}
                      className="max-w-[200px]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dropdown options */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Dropdown options (Category, Type of vehicle, Fuel type, Seats)</Label>
          <p className="text-sm text-muted-foreground">Customize options for Category, Type of vehicle, Fuel type, and Seats on the Add Vehicle form. Value is stored; label is what users see.</p>
          {[
            { title: 'Category (vehicle type)', options: vehicleTypeOptions, setOptions: setVehicleTypeOptions },
            { title: 'Type of vehicle (LMV/HMV)', options: vehicleClassOptions, setOptions: setVehicleClassOptions },
            { title: 'Fuel type', options: fuelTypeOptions, setOptions: setFuelTypeOptions },
            { title: 'Seats', options: seatsOptions, setOptions: setSeatsOptions },
          ].map(({ title, options, setOptions }) => (
            <div key={title} className="rounded-md border p-3 space-y-2">
              <span className="text-sm font-medium">{title}</span>
              <div className="divide-y">
                {options.map((opt, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2 py-2 first:pt-0">
                    <Input
                      placeholder="Value"
                      value={opt.value}
                      onChange={(e) => {
                        const next = [...options];
                        next[index] = { ...next[index], value: e.target.value.replace(/\s/g, '_') || opt.value };
                        setOptions(next);
                      }}
                      className="w-32 font-mono text-sm"
                    />
                    <Input
                      placeholder="Label"
                      value={opt.label}
                      onChange={(e) => {
                        const next = [...options];
                        next[index] = { ...next[index], label: e.target.value };
                        setOptions(next);
                      }}
                      className="flex-1 min-w-[100px] text-sm"
                    />
                    <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0 h-8 w-8" onClick={() => setOptions(options.filter((_, i) => i !== index))} disabled={options.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...options, { value: '', label: '' }])}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add option
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Custom fields */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Custom fields</Label>
              <p className="text-sm text-muted-foreground">Add extra fields (text, number, date, or dropdown). Values are stored per vehicle.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
              <Plus className="h-4 w-4 mr-2" />
              Add field
            </Button>
          </div>
          {customFields.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No custom fields. Click &quot;Add field&quot; to add one.</p>
          ) : (
            <div className="space-y-3">
              {customFields.map((f, index) => (
                <div key={f.id} className="flex flex-wrap items-start gap-2 p-3 border rounded-md">
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveCustomField(index, -1)} disabled={index === 0}>
                      <GripVertical className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Key (e.g. engine_no)"
                    value={f.key}
                    onChange={(e) => updateCustomField(f.id, { key: e.target.value.replace(/\s/g, '_') })}
                    className="w-36 font-mono"
                  />
                  <Input
                    placeholder="Label"
                    value={f.label}
                    onChange={(e) => updateCustomField(f.id, { label: e.target.value })}
                    className="w-40"
                  />
                  <Select
                    value={f.type}
                    onValueChange={(v) => updateCustomField(f.id, { type: v as CustomFieldType })}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTOM_FIELD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 whitespace-nowrap">
                    <Switch
                      checked={f.required}
                      onCheckedChange={(checked) => updateCustomField(f.id, { required: checked })}
                    />
                    <span className="text-sm">Required</span>
                  </label>
                  {f.type === 'select' && (
                    <Input
                      placeholder="Options (comma-separated)"
                      value={f.options?.join(', ') ?? ''}
                      onChange={(e) => updateCustomField(f.id, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                      className="min-w-[180px] flex-1"
                    />
                  )}
                  <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeCustomField(f.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving} data-settings-save>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Add vehicle form config
        </Button>
      </CardContent>
    </Card>
  );
}
