import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BirthForm } from './BirthForm';

describe('BirthForm', () => {
  it('blocks submit without consent', async () => {
    const onSubmit = vi.fn();
    render(<BirthForm onSubmit={onSubmit} mode="self" />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Saurabh');
    await userEvent.type(screen.getByLabelText(/date/i), '1995-08-15');
    await userEvent.type(screen.getByLabelText(/time/i), '14:30');
    await userEvent.type(screen.getByLabelText(/place/i), 'Mumbai');
    await userEvent.type(screen.getByLabelText(/phone/i), '9999999999');
    await userEvent.click(screen.getByRole('button', { name: /reveal|see/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/consent/i)).toBeInTheDocument();
  });

  it('submits valid input with phone normalized to E.164', async () => {
    const onSubmit = vi.fn();
    render(<BirthForm onSubmit={onSubmit} mode="self" />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Saurabh');
    await userEvent.type(screen.getByLabelText(/date/i), '1995-08-15');
    await userEvent.type(screen.getByLabelText(/time/i), '14:30');
    await userEvent.type(screen.getByLabelText(/place/i), 'Mumbai');
    await userEvent.type(screen.getByLabelText(/phone/i), '9999999999');
    await userEvent.click(screen.getByLabelText(/i consent/i));
    await userEvent.click(screen.getByRole('button', { name: /reveal|see/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Saurabh', phoneE164: '+919999999999', consent: true }),
    );
  });
});
