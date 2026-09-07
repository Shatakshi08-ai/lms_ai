import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../pages/RegisterPage.jsx';

const register = vi.fn();

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ register }),
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    register.mockReset();
  });

  it('renders registration fields', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create reader id/i })).toBeInTheDocument();
  });

  it('requires matching passwords', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText(/full name/i), 'Pat Reader');
    await user.type(screen.getByLabelText(/^email$/i), 'pat@college.edu');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Mismatch1!');
    await user.click(screen.getByRole('checkbox', { name: /questlearn library rules/i }));
    await user.click(screen.getByRole('button', { name: /create reader id/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });
});
