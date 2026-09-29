import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Button, ButtonLink, IconButton } from './Button';

describe('Button', () => {
  it('calls onClick and defaults to type=button', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and marked busy while loading', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('gives icon buttons an accessible name', () => {
    render(<IconButton label="Delete application">x</IconButton>);
    expect(screen.getByRole('button', { name: 'Delete application' })).toBeInTheDocument();
  });

  it('keeps icon buttons square, without the text-button padding that would squash the icon', () => {
    render(<IconButton label="Menu">x</IconButton>);
    const { className } = screen.getByRole('button', { name: 'Menu' });
    expect(className).toContain('size-9');
    expect(className).not.toMatch(/\bpx-\d/);
  });

  it('renders links that look like buttons', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/app" variant="primary">
          Open
        </ButtonLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/app');
  });
});
