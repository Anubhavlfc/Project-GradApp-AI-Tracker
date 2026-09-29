import { fireEvent, render, screen } from '@testing-library/react';
import { Checkbox, Field, Input } from './Field';

describe('Field', () => {
  it('labels the control and links hint and error to it', () => {
    render(
      <Field label="University name" required hint="As on the portal." error="Required.">
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByLabelText(/University name/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy.split(' ')).toHaveLength(2);
    expect(document.getElementById(describedBy.split(' ')[1] as string)).toHaveTextContent(
      'Required.',
    );
  });

  it('does not mark a valid field invalid', () => {
    render(<Field label="Notes">{(control) => <Input {...control} />}</Field>);
    const input = screen.getByLabelText('Notes');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });
});

describe('Checkbox', () => {
  it('toggles from its label', () => {
    render(<Checkbox label="Fee waiver available" description="If offered." />);
    const box = screen.getByLabelText('Fee waiver available');
    expect(box).not.toBeChecked();
    fireEvent.click(screen.getByText('Fee waiver available'));
    expect(box).toBeChecked();
    expect(box).toHaveAccessibleDescription('If offered.');
  });
});
