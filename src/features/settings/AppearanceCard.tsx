import { Card, CardBody, CardHeader, Field, Select } from '@/components/ui';
import type { Theme } from '@/theme/theme-context';
import { useTheme } from '@/theme/useTheme';

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Same as my device' },
];

function isTheme(value: string): value is Theme {
  return OPTIONS.some((option) => option.value === value);
}

/** Light, dark, or whatever the device uses. The choice is remembered on this device. */
export function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  return (
    <Card>
      <CardHeader title="Appearance" />
      <CardBody>
        <Field label="Theme" hint="Saved on this device." className="max-w-sm">
          {(control) => (
            <Select
              {...control}
              value={theme}
              onChange={(event) => {
                if (isTheme(event.target.value)) setTheme(event.target.value);
              }}
            >
              {OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </CardBody>
    </Card>
  );
}
