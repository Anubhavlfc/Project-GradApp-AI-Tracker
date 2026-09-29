import { useId, useState } from 'react';
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Search,
  SlidersHorizontal,
  Star,
} from 'lucide-react';
import { Button, IconButton, Input, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { DEGREE_LEVELS, PRIORITIES } from './labels';
import { APPLICATION_STATUSES } from './status';
import {
  activeFilterCount,
  clearFilters,
  DEADLINE_FILTERS,
  DEFAULT_DIRECTION,
  isFiltered,
  SORT_KEYS,
  SORT_LABELS,
  type SortKey,
  type ViewState,
  type ViewUpdate,
} from './view';

type FilterSelectProps<T extends string> = {
  label: string;
  allLabel: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (value: T | null) => void;
};

function FilterSelect<T extends string>({
  label,
  allLabel,
  value,
  options,
  onChange,
}: FilterSelectProps<T>) {
  return (
    <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-40">
      <Select
        aria-label={label}
        value={value ?? ''}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          onChange(next ? next.value : null);
        }}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

type ApplicationToolbarProps = {
  view: ViewState;
  countries: readonly string[];
  onChange: (update: ViewUpdate) => void;
};

/** Search, filters and sorting for the applications list. */
export function ApplicationToolbar({ view, countries, onChange }: ApplicationToolbarProps) {
  const panelId = useId();
  const [panelOpen, setPanelOpen] = useState(false);
  const filterCount = activeFilterCount(view);

  // The box keeps what was typed (including a trailing space between words) while the address
  // holds the trimmed search. It only takes the address's value back when that changed elsewhere,
  // e.g. "Clear filters" or the back button.
  const [text, setText] = useState(view.query);
  const [seenQuery, setSeenQuery] = useState(view.query);
  if (view.query !== seenQuery) {
    setSeenQuery(view.query);
    if (view.query !== text.trim()) setText(view.query);
  }

  const set = (changes: Partial<ViewState>) => onChange((current) => ({ ...current, ...changes }));
  const SortIcon = view.direction === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            type="search"
            aria-label="Search applications"
            placeholder="Search by university, program, or place"
            className="pl-9"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              set({ query: event.target.value });
            }}
          />
        </div>
        <Button
          className="lg:hidden"
          aria-expanded={panelOpen}
          aria-controls={panelId}
          onClick={() => setPanelOpen((open) => !open)}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          {filterCount > 0 ? `Filters (${filterCount})` : 'Filters'}
        </Button>
      </div>

      <div
        id={panelId}
        className={cn('flex-wrap items-center gap-2', panelOpen ? 'flex' : 'hidden lg:flex')}
      >
        <FilterSelect
          label="Filter by status"
          allLabel="All statuses"
          value={view.status}
          options={APPLICATION_STATUSES}
          onChange={(status) => set({ status })}
        />
        <FilterSelect
          label="Filter by degree"
          allLabel="All degrees"
          value={view.degree}
          options={DEGREE_LEVELS}
          onChange={(degree) => set({ degree })}
        />
        <FilterSelect
          label="Filter by priority"
          allLabel="All priorities"
          value={view.priority}
          options={PRIORITIES}
          onChange={(priority) => set({ priority })}
        />
        <FilterSelect
          label="Filter by deadline"
          allLabel="Any deadline"
          value={view.deadline}
          options={DEADLINE_FILTERS}
          onChange={(deadline) => set({ deadline })}
        />
        {countries.length > 0 ? (
          <FilterSelect
            label="Filter by country"
            allLabel="All countries"
            value={view.country}
            options={countries.map((country) => ({ value: country, label: country }))}
            onChange={(country) => set({ country })}
          />
        ) : null}
        <Button
          aria-pressed={view.favoritesOnly}
          className={cn(view.favoritesOnly && 'border-accent bg-accent-soft text-accent-soft-fg')}
          onClick={() =>
            onChange((current) => ({ ...current, favoritesOnly: !current.favoritesOnly }))
          }
        >
          <Star aria-hidden="true" className={cn('size-4', view.favoritesOnly && 'fill-current')} />
          Favorites
        </Button>

        <div className="flex items-center gap-1 sm:ml-auto">
          <div className="min-w-40">
            <Select
              aria-label="Sort by"
              value={view.sort}
              onChange={(event) => {
                const sort = SORT_KEYS.find((key) => key === event.target.value);
                if (sort) set({ sort, direction: DEFAULT_DIRECTION[sort] });
              }}
            >
              {SORT_KEYS.map((key: SortKey) => (
                <option key={key} value={key}>
                  Sort: {SORT_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>
          <IconButton
            label={
              view.direction === 'asc' ? 'Sorted ascending. Reverse' : 'Sorted descending. Reverse'
            }
            onClick={() =>
              onChange((current) => ({
                ...current,
                direction: current.direction === 'asc' ? 'desc' : 'asc',
              }))
            }
          >
            <SortIcon aria-hidden="true" className="size-4" />
          </IconButton>
        </div>

        {isFiltered(view) ? (
          <Button variant="ghost" onClick={() => onChange(clearFilters)}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
