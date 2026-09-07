import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CartPage from '../pages/CartPage.jsx';
import api from '../services/api.js';

vi.mock('../services/api.js', () => ({
  default: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

function renderCart() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CartPage', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.delete.mockReset();
  });

  it('shows empty state', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });
    renderCart();
    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it('renders book image, title, author, category, availability, and actions', async () => {
    api.get.mockResolvedValue({
      data: {
        items: [
          {
            _id: 'b1',
            title: 'Algorithms Unlocked',
            authors: ['Thomas Cormen'],
            category: 'Computer Science',
            coverImage: 'https://example.com/cover.jpg',
            availableCopies: 2,
            isFree: false,
          },
        ],
        total: 1,
      },
    });
    renderCart();
    expect(await screen.findByText('Algorithms Unlocked')).toBeInTheDocument();
    expect(screen.getByText('Thomas Cormen')).toBeInTheDocument();
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
    expect(screen.getByText(/2 available/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Algorithms Unlocked' })).toHaveAttribute('src', 'https://example.com/cover.jpg');
    expect(screen.getByRole('button', { name: /^view$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove from cart/i })).toBeInTheDocument();
    expect(document.querySelector('.ql-cart-grid')).toBeTruthy();
    expect(document.querySelector('.ql-cart-card')).toBeTruthy();
  });

  it('shows error state with retry', async () => {
    api.get.mockRejectedValue(new Error('network'));
    renderCart();
    expect(await screen.findByText(/unable to load cart/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('clears the cart', async () => {
    api.get.mockResolvedValue({
      data: {
        items: [{ _id: 'b1', title: 'A', authors: ['B'], category: 'History', availableCopies: 1 }],
        total: 1,
      },
    });
    api.delete.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderCart();
    await screen.findByText('A');
    const clearBtns = screen.getAllByRole('button', { name: /clear cart/i });
    await user.click(clearBtns[clearBtns.length - 1]);
    expect(api.delete).toHaveBeenCalledWith('/books/cart');
  });
});
