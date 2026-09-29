import { useState, type ComponentPropsWithoutRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { IconButton, Input } from '@/components/ui';

/** Password field with a show/hide toggle (fewer typos than asking twice). */
export function PasswordInput(props: Omit<ComponentPropsWithoutRef<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-10" />
      <IconButton
        label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
        className="absolute right-0.5 top-0.5 size-8"
      >
        <Icon aria-hidden="true" className="size-4" />
      </IconButton>
    </div>
  );
}
