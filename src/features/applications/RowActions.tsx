import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { IconButton, Menu, MenuItem } from '@/components/ui';
import { applicationName } from './labels';
import type { ApplicationRecord } from './types';

type RowActionsProps = { record: ApplicationRecord; onDelete: (record: ApplicationRecord) => void };

/** The "..." menu on a row or card: edit or delete that program. */
export function RowActions({ record, onDelete }: RowActionsProps) {
  const navigate = useNavigate();
  const label = `Actions for ${applicationName(record)}`;
  return (
    <Menu
      label={label}
      trigger={(props) => (
        <IconButton label={label} {...props}>
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </IconButton>
      )}
    >
      <MenuItem
        icon={<Pencil aria-hidden="true" className="size-4" />}
        onSelect={() => void navigate(`/app/applications/${record.id}/edit`)}
      >
        Edit
      </MenuItem>
      <MenuItem
        destructive
        icon={<Trash2 aria-hidden="true" className="size-4" />}
        onSelect={() => onDelete(record)}
      >
        Delete…
      </MenuItem>
    </Menu>
  );
}
