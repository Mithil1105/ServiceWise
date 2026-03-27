import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Fuel as FuelIcon } from 'lucide-react';
import { useOrganizationSettings, useUpdateOrganizationSettings } from '@/hooks/use-organization-settings';
import type {
  FieldOverride,
  FuelEntryFormBuiltInFieldKey,
  FuelEntryFormConfig,
} from '@/types/form-config';
import {
  FUEL_ENTRY_FORM_FIELD_LABELS,
} from '@/types/form-config';

type FuelFieldMeta = {
  key: FuelEntryFormBuiltInFieldKey;
  canHide: boolean;
  defaultRequired: boolean;
  defaultLabel?: string;
};

const FIELDS: FuelFieldMeta[] = [
  { key: 'fuel_type', canHide: true, defaultRequired: true },
  { key: 'odometer_km', canHide: false, defaultRequired: true },
  { key: 'fuel_liters', canHide: false, defaultRequired: true },
  { key: 'amount_inr', canHide: false, defaultRequired: true },
  { key: 'is_full_tank', canHide: true, defaultRequired: false },
  { key: 'notes', canHide: true, defaultRequired: false },
  { key: 'bill_upload', canHide: true, defaultRequired: false },
];

function defaultFieldOverride(meta: FuelFieldMeta): FieldOverride {
  return { required: meta.defaultRequired, hidden: false, label: undefined };
}

export function FuelEntryFormConfigCard({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { data: orgSettings } = useOrganizationSettings();
  const updateSettings = useUpdateOrganizationSettings();
  const config: FuelEntryFormConfig = orgSettings?.fuel_entry_form_config ?? {};

  const [fieldOverrides, setFieldOverrides] = useState<Partial<Record<FuelEntryFormBuiltInFieldKey, FieldOverride>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFieldOverrides(config.fieldOverrides ?? {});
  }, [config.fieldOverrides]);

  const currentJson = useMemo(() => {
    return JSON.stringify({
      fieldOverrides: fieldOverrides,
    });
  }, [fieldOverrides]);

  const savedJson = useMemo(() => {
    return JSON.stringify({
      fieldOverrides: config.fieldOverrides ?? {},
    });
  }, [config.fieldOverrides]);

  useEffect(() => {
    onDirtyChange?.(currentJson !== savedJson);
  }, [currentJson, savedJson, onDirtyChange]);

  const setFieldOverride = (key: FuelEntryFormBuiltInFieldKey, override: FieldOverride) => {
    const meta = FIELDS.find((f) => f.key === key)!;
    setFieldOverrides((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? defaultFieldOverride(meta)),
        ...override,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const clean: FuelEntryFormConfig['fieldOverrides'] = Object.keys(fieldOverrides).length ? fieldOverrides : undefined;
      await updateSettings.mutateAsync({
        fuel_entry_form_config: {
          fieldOverrides: clean,
        } as FuelEntryFormConfig,
      });
      onDirtyChange?.(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FuelIcon className="h-5 w-5" />
          Fuel entry form
        </CardTitle>
        <CardDescription>
          Configure which fields are shown and what labels are used for the Fuel entry page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <Label className="text-base font-medium">Built-in fields</Label>
          <p className="text-sm text-muted-foreground">
            Toggle visibility/requiredness and customize labels. For required numeric fields, the form still validates as before.
          </p>

          <div className="rounded-md border divide-y">
            {FIELDS.map((meta) => {
              const override = fieldOverrides[meta.key] ?? defaultFieldOverride(meta);
              const defaultLabel = FUEL_ENTRY_FORM_FIELD_LABELS[meta.key];
              return (
                <div key={meta.key} className="flex flex-wrap items-center gap-4 p-3">
                  <span className="font-mono text-sm w-40 shrink-0">{defaultLabel}</span>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {meta.canHide ? (
                      <label className="flex items-center gap-2 whitespace-nowrap">
                        <Switch
                          checked={!override.hidden}
                          onCheckedChange={(checked) => setFieldOverride(meta.key, { ...override, hidden: !checked })}
                        />
                        <span className="text-sm">Show</span>
                      </label>
                    ) : (
                      <div className="text-sm text-muted-foreground whitespace-nowrap">Always shown</div>
                    )}

                    <label className="flex items-center gap-2 whitespace-nowrap">
                      <Switch
                        checked={override.required ?? meta.defaultRequired}
                        onCheckedChange={(checked) => setFieldOverride(meta.key, { ...override, required: checked })}
                      />
                      <span className="text-sm">Required</span>
                    </label>

                    <Input
                      placeholder={`Label (default: ${defaultLabel})`}
                      value={override.label ?? ''}
                      onChange={(e) => setFieldOverride(meta.key, { ...override, label: e.target.value || undefined })}
                      className="max-w-[220px]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} data-settings-save>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save fuel form settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

