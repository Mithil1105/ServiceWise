import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, PauseCircle, Plus, Trash2, GripVertical } from 'lucide-react';
import { useOrganizationSettings, useUpdateOrganizationSettings } from '@/hooks/use-organization-settings';
import {
  type DowntimeFormConfig,
  type DowntimeFormBuiltInFieldKey,
  type FleetNewCarCustomField,
  type FieldOverride,
  type DowntimeReasonOption,
  DOWNTIME_FORM_FIELD_LABELS,
  DEFAULT_DOWNTIME_REASON_OPTIONS,
  type CustomFieldType,
} from '@/types/form-config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const BUILT_IN_FIELDS: DowntimeFormBuiltInFieldKey[] = ['car_id', 'reason', 'notes', 'estimated_uptime_at'];

const CUSTOM_FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown (select)' },
];

function defaultFieldOverride(): FieldOverride {
  return { required: false, hidden: false, label: undefined };
}

interface DowntimeFormConfigCardProps {
  onDirtyChange?: (dirty: boolean) => void;
}

export function DowntimeFormConfigCard({ onDirtyChange }: DowntimeFormConfigCardProps = {}) {
  const { data: orgSettings } = useOrganizationSettings();
  const updateSettings = useUpdateOrganizationSettings();
  const config: DowntimeFormConfig = orgSettings?.downtime_form_config ?? {};

  const [fieldOverrides, setFieldOverrides] = useState<Partial<Record<DowntimeFormBuiltInFieldKey, FieldOverride>>>({});
  const [reasonOptions, setReasonOptions] = useState<DowntimeReasonOption[]>([]);
  const [customFields, setCustomFields] = useState<FleetNewCarCustomField[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFieldOverrides(config.fieldOverrides ?? {});
    setReasonOptions(config.reasonOptions?.length ? [...config.reasonOptions] : [...DEFAULT_DOWNTIME_REASON_OPTIONS]);
    setCustomFields(config.customFields ?? []);
  }, [config.fieldOverrides, config.reasonOptions, config.customFields]);

  useEffect(() => {
    const saved = JSON.stringify({
      fieldOverrides: config.fieldOverrides ?? {},
      reasonOptions: config.reasonOptions?.length ? config.reasonOptions : DEFAULT_DOWNTIME_REASON_OPTIONS,
      customFields: config.customFields ?? [],
    });
    const current = JSON.stringify({ fieldOverrides, reasonOptions, customFields });
    onDirtyChange?.(saved !== current);
  }, [fieldOverrides, reasonOptions, customFields, config, onDirtyChange]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanedReasonOptions = reasonOptions.filter((o) => o.value.trim() && o.label.trim());
      await updateSettings.mutateAsync({
        downtime_form_config: {
          fieldOverrides: Object.keys(fieldOverrides).length ? fieldOverrides : undefined,
          reasonOptions: cleanedReasonOptions.length > 0 ? cleanedReasonOptions : undefined,
          customFields: customFields.length ? customFields : undefined,
        },
      });
      onDirtyChange?.(false);
    } finally {
      setSaving(false);
    }
  };

  const setFieldOverride = (key: DowntimeFormBuiltInFieldKey, override: FieldOverride) => {
    setFieldOverrides((prev) => ({ ...prev, [key]: { ...(prev[key] ?? defaultFieldOverride()), ...override } }));
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
          <PauseCircle className="h-5 w-5" />
          Add downtime form
        </CardTitle>
        <CardDescription>
          Configure which fields are required or hidden, labels, and add custom fields for the Add Downtime form. Custom fields appear in the form with no separate heading.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <Label className="text-base font-medium">Built-in fields</Label>
          <p className="text-sm text-muted-foreground">Set required, hidden, or custom label for each field.</p>
          <div className="rounded-md border divide-y">
            {BUILT_IN_FIELDS.map((key) => {
              const override = fieldOverrides[key] ?? defaultFieldOverride();
              const defaultRequired = key === 'car_id' || key === 'reason';
              return (
                <div key={key} className="flex flex-wrap items-center gap-4 p-3">
                  <span className="font-mono text-sm w-52 shrink-0">{DOWNTIME_FORM_FIELD_LABELS[key]}</span>
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
                      placeholder={`Label (default: ${DOWNTIME_FORM_FIELD_LABELS[key]})`}
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
          <Label className="text-base font-medium">Reason dropdown options</Label>
          <p className="text-sm text-muted-foreground">Customize the options shown in the Reason dropdown on the Add Downtime form. Value is stored in the database; label is what users see.</p>
          <div className="rounded-md border divide-y">
            {reasonOptions.map((opt, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 p-2">
                <Input
                  placeholder="Value (e.g. service)"
                  value={opt.value}
                  onChange={(e) => {
                    const next = [...reasonOptions];
                    next[index] = { ...next[index], value: e.target.value.replace(/\s/g, '_').toLowerCase() || opt.value };
                    setReasonOptions(next);
                  }}
                  className="w-36 font-mono"
                />
                <Input
                  placeholder="Label (e.g. Service)"
                  value={opt.label}
                  onChange={(e) => {
                    const next = [...reasonOptions];
                    next[index] = { ...next[index], label: e.target.value };
                    setReasonOptions(next);
                  }}
                  className="flex-1 min-w-[120px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive shrink-0"
                  onClick={() => setReasonOptions(reasonOptions.filter((_, i) => i !== index))}
                  disabled={reasonOptions.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="p-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setReasonOptions([...reasonOptions, { value: '', label: '' }])}>
                <Plus className="h-4 w-4 mr-2" />
                Add option
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Custom fields</Label>
              <p className="text-sm text-muted-foreground">Add extra fields. Values are stored per downtime log.</p>
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
          Save Add downtime form config
        </Button>
      </CardContent>
    </Card>
  );
}
