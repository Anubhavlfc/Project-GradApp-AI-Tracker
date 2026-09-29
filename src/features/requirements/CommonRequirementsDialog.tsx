import { useState } from 'react';
import { Alert, Button, Checkbox, Modal } from '@/components/ui';
import { requirementErrorMessage, useAddRequirements } from './hooks';
import { COMMON_REQUIREMENTS, requirementKindLabel } from './kinds';
import { hasRequirement } from './progress';
import type { RequirementRow } from './types';

type CommonRequirementsDialogProps = {
  open: boolean;
  applicationId: string;
  /** The program's items as they are now: ones already there are shown but not offered again. */
  items: readonly RequirementRow[];
  onClose: () => void;
  /** Called after the items were added, with a sentence for the page to announce. */
  onAdded: (message: string) => void;
};

function addLabel(count: number): string {
  if (count === 0) return 'Add requirements';
  return count === 1 ? 'Add 1 requirement' : `Add ${count} requirements`;
}

/** Pick the usual items in one go instead of adding them one at a time. */
export function CommonRequirementsDialog({
  open,
  applicationId,
  items,
  onClose,
  onAdded,
}: CommonRequirementsDialogProps) {
  const add = useAddRequirements();
  // Until you tick or untick something, the usual choices are ticked (minus what is on the list).
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected =
    picked ??
    new Set(
      COMMON_REQUIREMENTS.filter((item) => item.preselected && !hasRequirement(items, item)).map(
        (item) => item.id,
      ),
    );
  const chosen = COMMON_REQUIREMENTS.filter((item) => selected.has(item.id));

  function close() {
    setPicked(null);
    setError(null);
    add.reset();
    onClose();
  }

  function toggle(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setPicked(next);
  }

  async function submit() {
    setError(null);
    try {
      const created = await add.mutateAsync({
        applicationId,
        items: chosen.map((item) => ({
          kind: item.kind,
          label: item.label,
          is_required: true,
          status: 'not_started' as const,
          due_date: null,
          notes: null,
        })),
      });
      setPicked(null);
      onAdded(`Added ${created.length} ${created.length === 1 ? 'requirement' : 'requirements'}.`);
      onClose();
    } catch (failure) {
      setError(requirementErrorMessage(failure));
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add common requirements"
      description="Tick what this program asks for. You can change or remove any of them later."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            loading={add.isPending}
            disabled={chosen.length === 0}
            onClick={() => void submit()}
          >
            {addLabel(chosen.length)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <Alert kind="danger" title="Failed to add requirements">
            {error}
          </Alert>
        ) : null}
        <fieldset className="space-y-3">
          <legend className="sr-only">Requirements to add</legend>
          {COMMON_REQUIREMENTS.map((item) => {
            const present = hasRequirement(items, item);
            return (
              <Checkbox
                key={item.id}
                label={item.label ?? requirementKindLabel(item.kind)}
                description={present ? 'Already on your list' : undefined}
                checked={!present && selected.has(item.id)}
                disabled={present}
                onChange={(event) => toggle(item.id, event.target.checked)}
              />
            );
          })}
        </fieldset>
      </div>
    </Modal>
  );
}
