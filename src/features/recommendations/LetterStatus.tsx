import { Badge, StatusPicker } from '@/components/ui';
import {
  getRecommendationStatusMeta,
  RECOMMENDATION_STATUSES,
  type RecommendationStatus,
} from './statuses';

export function LetterStatusBadge({ status }: { status: RecommendationStatus }) {
  const { label, tone } = getRecommendationStatusMeta(status);
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

type LetterStatusPickerProps = {
  status: RecommendationStatus;
  /** Whose letter, for screen readers: "Prof. Jane Smith". */
  name: string;
  onChange: (status: RecommendationStatus) => void;
};

/** The status badge as a button: click it to move the letter to another status. */
export function LetterStatusPicker({ status, name, onChange }: LetterStatusPickerProps) {
  return (
    <StatusPicker
      value={status}
      options={RECOMMENDATION_STATUSES}
      subject={name}
      onChange={onChange}
    />
  );
}
