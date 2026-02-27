import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Wrench, Plus, Trash2, GripVertical } from 'lucide-react';
import { useOrganizationSettings, useUpdateOrganizationSettings } from '@/hooks/use-organization-settings';
import {
  type ServiceRecordFormConfig,
  type ServiceRecordFormBuiltInFieldKey,
  type ServiceRecordWarrantyFieldKey,
  type FleetNewCarCustomField,
  type FieldOverride,
  SERVICE_RECORD_FORM_FIELD_LABELS,
  SERVICE_RECORD_WARRANTY_FIELD_LABELS,
  type CustomFieldType,
} from '@/types/form-config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const BUILT_IN_FIELDS: ServiceRecordFormBuiltInFieldKey[] = [
  'car_id',
  'rule_id',
  'service_name',
  'serviced_at',
  'odometer_km',
  'cost',
  'vendor_name',
  'vendor_location',
  'notes',
];

const WARRANTY_FIELDS: ServiceRecordWarrantyFieldKey[] = [
  'warranty_part_name',
  'warranty_serial_number',
  'warranty_expiry',
];

const CUSTOM_FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown (select)' },
];

function defaultFieldOverride(): FieldOverride {
  return { required: false, hidden: false, label: undefined };
}

interface ServiceRecordFormConfigCardProps {
  onDirtyChange?: (dirty: boolean) => void;
}

export function ServiceRecordFormConfigCard({ onDirtyChange }: ServiceRecordFormConfigCardProps = {}) {
  const { data: orgSettings } = useOrganizationSettings();
  const updateSettings = useUpdateOrganizationSettings();
  const config: ServiceRecordFormConfig = orgSettings?.service_record_form_config ?? {};

  const [fieldOverrides, setFieldOverrides] = useState<Partial<Record<ServiceRecordFormBuiltInFieldKey, FieldOverride>>>({});
  const [warrantyShow, setWarrantyShow] = useState(true);
  const [warrantySectionLabel, setWarrantySectionLabel] = useState('');
  const [warrantyFieldOverrides, setWarrantyFieldOverrides] = useState<Partial<Record<ServiceRecordWarrantyFieldKey, FieldOverride>>>({});
  const [billsShow, setBillsShow] = useState(true);
  const [billsRequired, setBillsRequired] = useState(false);
  const [billsLabel, setBillsLabel] = useState('');
  const [customFields, setCustomFields] = useState<FleetNewCarCustomField[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFieldOverrides(config.fieldOverrides ?? {});
    setWarrantyShow(config.warrantySection?.show !== false);
    setWarrantySectionLabel(config.warrantySection?.sectionLabel ?? '');
    setWarrantyFieldOverrides(config.warrantySection?.fieldOverrides ?? {});
    setBillsShow(config.billsSection?.show !== false);
    setBillsRequired(config.billsSection?.required ?? false);
    setBillsLabel(config.billsSection?.label ?? '');
    setCustomFields(config.customFields ?? []);
  }, [
    config.fieldOverrides,
    config.warrantySection,
    config.billsSection,
    config.customFields,
  ]);

  useEffect(() => {
    const saved = JSON.stringify({
      fieldOverrides: config.fieldOverrides ?? {},
      warrantySection: config.warrantySection ?? {},
      billsSection: config.billsSection ?? {},
      customFields: config.customFields ?? [],
    });
    const current = JSON.stringify({
      fieldOverrides,
      warrantySection: { show: warrantyShow, sectionLabel: warrantySectionLabel, fieldOverrides: warrantyFieldOverrides },
      billsSection: { show: billsShow, required: billsRequired, label: billsLabel },
      customFields,
    });
    onDirtyChange?.(saved !== current);
  }, [fieldOverrides, warrantyShow, warrantySectionLabel, warrantyFieldOverrides, billsShow, billsRequired, billsLabel, customFields, config, onDirtyChange]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings.mutateAsync({
        service_record_form_config: {
          fieldOverrides: Object.keys(fieldOverrides).length ? fieldOverrides : undefined,
          warrantySection: {
            show: warrantyShow,
            sectionLabel: warrantySectionLabel.trim() || undefined,
            fieldOverrides: Object.keys(warrantyFieldOverrides).length ? warrantyFieldOverrides : undefined,
          },
          billsSection: {
            show: billsShow,
            required: billsRequired,
            label: billsLabel.trim() || undefined,
          },
          customFields: customFields.length ? customFields : undefined,
        },
      });
      onDirtyChange?.(false);
    } finally {
      setSaving(false);
    }
  };

  const setFieldOverride = (key: ServiceRecordFormBuiltInFieldKey, override: FieldOverride) => {
    setFieldOverrides((prev) => ({ ...prev, [key]: { ...(prev[key] ?? defaultFieldOverride()), ...override } }));
  };

  const setWarrantyFieldOverride = (key: ServiceRecordWarrantyFieldKey, override: FieldOverride) => {
    setWarrantyFieldOverrides((prev) => ({ ...prev, [key]: { ...(prev[key] ?? defaultFieldOverride()), ...override } }));
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
          <Wrench className="h-5 w-5" />
          Add service record form
        </CardTitle>
        <CardDescription>
          Configure which fields are required or hidden, labels, warranty and bills sections, and add custom fields for the Add Service Record form.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <Label className="text-base font-medium">Built-in fields</Label>
          <p className="text-sm text-muted-foreground">Set required, hidden, or custom label for each field.</p>
          <div className="rounded-md border divide-y">
            {BUILT_IN_FIELDS.map((key) => {
              const override = fieldOverrides[key] ?? defaultFieldOverride();
              const defaultRequired = key === 'car_id' || key === 'service_name' || key === 'serviced_at' || key === 'odometer_km';
              return (
                <div key={key} className="flex flex-wrap items-center gap-4 p-3">
                  <span className="font-mono text-sm w-52 shrink-0">{SERVICE_RECORD_FORM_FIELD_LABELS[key]}</span>
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
                        checked={override.required ?? defaultRequired}
                        onCheckedChange={(checked) => setFieldOverride(key, { ...override, required: checked })}
                      />
                      <span className="text-sm">Required</span>
                    </label>
                    <Input
                      placeholder={`Label (default: ${SERVICE_RECORD_FORM_FIELD_LABELS[key]})`}
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

        <div className="space-y-4">
          <Label className="text-base font-medium">Warranty details section</Label>
          <p className="text-sm text-muted-foreground">Show or hide the section and configure warranty fields.</p>
          <div className="rounded-md border p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <Switch checked={warrantyShow} onCheckedChange={setWarrantyShow} />
                <span className="text-sm">Show warranty section</span>
              </label>
              <Input
                placeholder="Section label (default: Warranty Details (Optional))"
                value={warrantySectionLabel}
                onChange={(e) => setWarrantySectionLabel(e.target.value)}
                className="max-w-[280px]"
              />
            </div>
            {WARRANTY_FIELDS.map((key) => {
              const override = warrantyFieldOverrides[key] ?? defaultFieldOverride();
              return (
                <div key={key} className="flex flex-wrap items-center gap-4 pl-4 border-l-2 border-muted">
                  <span className="font-mono text-sm w-40 shrink-0">{SERVICE_RECORD_WARRANTY_FIELD_LABELS[key]}</span>
                  <label className="flex items-center gap-2">
                    <Switch checked={!override.hidden} onCheckedChange={(checked) => setWarrantyFieldOverride(key, { ...override, hidden: !checked })} />
                    <span className="text-sm">Show</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch checked={override.required ?? false} onCheckedChange={(checked) => setWarrantyFieldOverride(key, { ...override, required: checked })} />
                    <span className="text-sm">Required</span>
                  </label>
                  <Input
                    placeholder={`Label (default: ${SERVICE_RECORD_WARRANTY_FIELD_LABELS[key]})`}
                    value={override.label ?? ''}
                    onChange={(e) => setWarrantyFieldOverride(key, { ...override, label: e.target.value || undefined })}
                    className="max-w-[180px]"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-base font-medium">Bills / Invoices section</Label>
          <p className="text-sm text-muted-foreground">Show or hide the file upload section and optionally require at least one bill.</p>
          <div className="rounded-md border p-4 flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2">
              <Switch checked={billsShow} onCheckedChange={setBillsShow} />
              <span className="text-sm">Show bills section</span>
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={billsRequired} onCheckedChange={setBillsRequired} />
              <span className="text-sm">At least one bill required</span>
            </label>
            <Input
              placeholder="Label (default: Bills / Invoices)"
              value={billsLabel}
              onChange={(e) => setBillsLabel(e.target.value)}
              className="max-w-[220px]"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Custom fields</Label>
              <p className="text-sm text-muted-foreground">Add extra fields. They appear in the form with the rest of the fields (no separate heading).</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
              <Plus className="h-4 w-4 mr-2" />
              Add field
            </Button>
          </div>
          {customFields.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No custom fields.</p>
          ) : (
            <div className="space-y-3">
              {customFields.map((f, index) => (
                <div key={f.id} className="flex flex-wrap items-start gap-2 p-3 border rounded-md">
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveCustomField(index, -1)} disabled={index === 0}>
                      <GripVertical className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input placeholder="Key" value={f.key} onChange={(e) => updateCustomField(f.id, { key: e.target.value.replace(/\s/g, '_') })} className="w-36 font-mono" />
                  <Input placeholder="Label" value={f.label} onChange={(e) => updateCustomField(f.id, { label: e.target.value })} className="w-40" />
                  <Select value={f.type} onValueChange={(v) => updateCustomField(f.id, { type: v as CustomFieldType })}>
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
                    <Switch checked={f.required} onCheckedChange={(checked) => updateCustomField(f.id, { required: checked })} />
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
          Save Add service record form config
        </Button>
      </CardContent>
    </Card>
  );
}
