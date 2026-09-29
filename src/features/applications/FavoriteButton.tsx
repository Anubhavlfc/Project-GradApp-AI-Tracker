import { Star } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { cn } from '@/lib/cn';

type FavoriteButtonProps = { name: string; isFavorite: boolean; onToggle: () => void };

export function FavoriteButton({ name, isFavorite, onToggle }: FavoriteButtonProps) {
  return (
    <IconButton label={`Favorite ${name}`} aria-pressed={isFavorite} onClick={onToggle}>
      <Star
        aria-hidden="true"
        className={cn('size-4', isFavorite && 'fill-current text-tone-amber-fg')}
      />
    </IconButton>
  );
}
