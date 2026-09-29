// Class maps are written out in full so Tailwind can see every class name.
export type Tone =
  'neutral' | 'blue' | 'indigo' | 'teal' | 'violet' | 'amber' | 'orange' | 'green' | 'red';

/** Tinted pill: badges. */
export const toneBadge: Record<Tone, string> = {
  neutral: 'bg-tone-neutral/10 text-tone-neutral-fg',
  blue: 'bg-tone-blue/10 text-tone-blue-fg',
  indigo: 'bg-tone-indigo/10 text-tone-indigo-fg',
  teal: 'bg-tone-teal/10 text-tone-teal-fg',
  violet: 'bg-tone-violet/10 text-tone-violet-fg',
  amber: 'bg-tone-amber/10 text-tone-amber-fg',
  orange: 'bg-tone-orange/10 text-tone-orange-fg',
  green: 'bg-tone-green/10 text-tone-green-fg',
  red: 'bg-tone-red/10 text-tone-red-fg',
};

/** Solid marker: dots and icons. */
export const toneDot: Record<Tone, string> = {
  neutral: 'bg-tone-neutral',
  blue: 'bg-tone-blue',
  indigo: 'bg-tone-indigo',
  teal: 'bg-tone-teal',
  violet: 'bg-tone-violet',
  amber: 'bg-tone-amber',
  orange: 'bg-tone-orange',
  green: 'bg-tone-green',
  red: 'bg-tone-red',
};

/** Tinted panel with border: alerts. */
export const tonePanel: Record<Tone, string> = {
  neutral: 'border-tone-neutral/30 bg-tone-neutral/10',
  blue: 'border-tone-blue/30 bg-tone-blue/10',
  indigo: 'border-tone-indigo/30 bg-tone-indigo/10',
  teal: 'border-tone-teal/30 bg-tone-teal/10',
  violet: 'border-tone-violet/30 bg-tone-violet/10',
  amber: 'border-tone-amber/30 bg-tone-amber/10',
  orange: 'border-tone-orange/30 bg-tone-orange/10',
  green: 'border-tone-green/30 bg-tone-green/10',
  red: 'border-tone-red/30 bg-tone-red/10',
};

export const toneText: Record<Tone, string> = {
  neutral: 'text-tone-neutral-fg',
  blue: 'text-tone-blue-fg',
  indigo: 'text-tone-indigo-fg',
  teal: 'text-tone-teal-fg',
  violet: 'text-tone-violet-fg',
  amber: 'text-tone-amber-fg',
  orange: 'text-tone-orange-fg',
  green: 'text-tone-green-fg',
  red: 'text-tone-red-fg',
};
