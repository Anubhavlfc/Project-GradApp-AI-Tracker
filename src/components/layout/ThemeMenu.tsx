import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { IconButton, Menu, MenuItem } from '@/components/ui';
import type { Theme } from '@/theme/theme-context';
import { useTheme } from '@/theme/useTheme';

const options: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeMenu({ align }: { align?: 'start' | 'end' }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun;
  return (
    <Menu
      label="Theme"
      align={align}
      trigger={(props) => (
        <IconButton label="Change theme" {...props}>
          <CurrentIcon aria-hidden="true" className="size-4" />
        </IconButton>
      )}
    >
      {options.map(({ value, label, icon: Icon }) => (
        <MenuItem
          key={value}
          checked={theme === value}
          icon={<Icon aria-hidden="true" className="size-4" />}
          onSelect={() => setTheme(value)}
        >
          {label}
        </MenuItem>
      ))}
    </Menu>
  );
}
