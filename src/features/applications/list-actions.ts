import type { ApplicationStatus } from './status';
import type { ApplicationRecord } from './types';

/** What a person can do to a program from the list, whether it is shown as a table or cards. */
export type ListActions = {
  onToggleFavorite: (record: ApplicationRecord) => void;
  onChangeStatus: (record: ApplicationRecord, status: ApplicationStatus) => void;
  onDelete: (record: ApplicationRecord) => void;
};
