import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BirthForm } from './BirthForm';

async function fillDateTime(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/^Day$/), '15');
  await user.selectOptions(screen.getByLabelText(/^Month$/), '8');
  await user.selectOptions(screen.getByLabelText(/^Year$/), '1995');
  await user.selectOptions(screen.getByLabelText(/^Hour$/), '2');
  await user.selectOptions(screen.getByLabelText(/^Minute$/), '30');
  // 14:30 = 2:30 PM (default mer is AM, click PM)
  await user.click(screen.getByRole('button', { name: 'PM' }));
}

describe('BirthForm', () => {
  it('blocks submit without consent', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BirthForm onSubmit={onSubmit} mode="self" />);
    await user.type(screen.getByLabelText(/name/i), 'Saurabh');
    await fillDateTime(user);
    await user.type(screen.getByLabelText(/place/i), 'Mumbai');
    await user.type(screen.getByPlaceholderText('9999999999'), '9999999999');
    await user.click(screen.getByRole('button', { name: /reveal|see/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText('Consent required')).toBeInTheDocument();
  });

  it('submits valid input with phone normalized to E.164', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BirthForm onSubmit={onSubmit} mode="self" />);
    await user.type(screen.getByLabelText(/name/i), 'Saurabh');
    await fillDateTime(user);
    await user.type(screen.getByLabelText(/place/i), 'Mumbai');
    await user.type(screen.getByPlaceholderText('9999999999'), '9999999999');
    await user.click(screen.getByLabelText(/i consent/i));
    await user.click(screen.getByRole('button', { name: /reveal|see/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Saurabh',
        dobDate: '1995-08-15',
        dobTime: '14:30',
        phoneE164: '+919999999999',
        consent: true,
      }),
    );
  });
});
