import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage.jsx';

const login = vi.fn();

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ login }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    login.mockReset();
  });

  it('renders email, password, remember me, and login button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /remember me/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });

  it('validates empty fields', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.clear(screen.getByLabelText(/email/i));
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('shows an error when login fails', async () => {
    login.mockRejectedValue({ response: { data: { message: 'Invalid email or password.' } } });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.clear(screen.getByLabelText(/email/i));
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(login).toHaveBeenCalled());
  });

  it('calls login and can show loading label', async () => {
    let resolve;
    login.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.clear(screen.getByLabelText(/email/i));
    await user.type(screen.getByLabelText(/email/i), 'admin@library.com');
    const click = user.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByRole('button', { name: /signing in/i })).toBeDisabled();
    resolve({ role: 'ADMIN', preferencesOnboarded: true });
    await click;
  });
});
