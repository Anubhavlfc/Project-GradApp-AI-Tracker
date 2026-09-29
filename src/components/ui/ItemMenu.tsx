import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { IconButton } from './Button';
import { Menu, MenuItem } from './Menu';

type ItemMenuProps = {
  /** What the menu belongs to, for screen readers: "Actions for Transcript". */
  subject: string;
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
};

/** The "..." button at the end of a row: edit it, or delete it (which the page confirms). */
export function ItemMenu({
  subject,
  onEdit,
  onDelete,
  editLabel = 'Edit',
  deleteLabel = 'Delete…',
}: ItemMenuProps) {
  const label = `Actions for ${subject}`;
  return (
    <Menu
      label={label}
      trigger={(props) => (
        <IconButton label={label} {...props}>
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </IconButton>
      )}
    >
      <MenuItem icon={<Pencil aria-hidden="true" className="size-4" />} onSelect={onEdit}>
        {editLabel}
      </MenuItem>
      <MenuItem
        destructive
        icon={<Trash2 aria-hidden="true" className="size-4" />}
        onSelect={onDelete}
      >
        {deleteLabel}
      </MenuItem>
    </Menu>
  );
}
