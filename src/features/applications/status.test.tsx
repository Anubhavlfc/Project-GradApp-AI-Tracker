import { render, screen } from '@testing-library/react';
import { APPLICATION_STATUSES, getStatusMeta } from './status';
import { StatusBadge } from './StatusBadge';

describe('application statuses', () => {
  it('defines the twelve workflow statuses in order', () => {
    expect(APPLICATION_STATUSES.map((status) => status.label)).toEqual([
      'Researching',
      'Shortlisted',
      'Planning to Apply',
      'Application Started',
      'Documents In Progress',
      'Ready to Submit',
      'Submitted',
      'Interview',
      'Waitlisted',
      'Accepted',
      'Rejected',
      'Withdrawn',
    ]);
    expect(new Set(APPLICATION_STATUSES.map((status) => status.value)).size).toBe(12);
  });

  it('shows the label as text so color is never the only signal', () => {
    render(
      <>
        {APPLICATION_STATUSES.map(({ value }) => (
          <StatusBadge key={value} status={value} />
        ))}
      </>,
    );
    for (const { label } of APPLICATION_STATUSES) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('throws on an unknown status instead of rendering something misleading', () => {
    expect(() => getStatusMeta('bogus' as never)).toThrow('Unknown application status');
  });
});
