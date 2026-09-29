import { render, screen } from '@testing-library/react';
import { Alert } from './Alert';
import { EmptyState } from './EmptyState';
import { ProgressBar } from './ProgressBar';
import { SkeletonRegion } from './Skeleton';

describe('feedback components', () => {
  it('announces errors as alerts and other messages as status', () => {
    render(
      <>
        <Alert kind="danger" title="Failed to save application." />
        <Alert kind="success" title="Saved." />
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to save application.');
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
  });

  it('exposes progress values and clamps out-of-range input', () => {
    render(
      <>
        <ProgressBar value={8} max={11} label="Stanford" />
        <ProgressBar value={50} max={10} label="Overflow" />
      </>,
    );
    const stanford = screen.getByRole('progressbar', { name: 'Stanford' });
    expect(stanford).toHaveAttribute('aria-valuenow', '8');
    expect(stanford).toHaveAttribute('aria-valuemax', '11');
    expect(stanford.firstElementChild).toHaveStyle({ width: `${(8 / 11) * 100}%` });
    expect(screen.getByRole('progressbar', { name: 'Overflow' }).firstElementChild).toHaveStyle({
      width: '100%',
    });
  });

  it('renders an empty state with an action', () => {
    render(
      <EmptyState
        title="No applications yet."
        description="Add one."
        action={<button>Add</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No applications yet.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('labels skeleton regions for assistive tech', () => {
    render(<SkeletonRegion label="Loading applications">x</SkeletonRegion>);
    expect(screen.getByRole('status')).toHaveTextContent('Loading applications');
  });
});
