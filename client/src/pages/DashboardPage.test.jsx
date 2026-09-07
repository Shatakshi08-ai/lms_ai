import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from '../pages/DashboardPage.jsx';
import api from '../services/api.js';

vi.mock('../services/api.js', () => ({
  default: { get: vi.fn() },
}));

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { role: 'ADMIN', name: 'Admin' } }),
}));

vi.mock('../components/CirculationDrawer.jsx', () => ({
  default: () => null,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: () => <div />,
  Bar: () => null,
  LineChart: () => <div />,
  Line: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe('DashboardPage data binding', () => {
  it('renders live KPI values from the API payload', async () => {
    api.get.mockResolvedValue({
      data: {
        kpis: {
          totalUsers: 6,
          totalMembers: 1,
          totalStudents: 2,
          totalLibrarians: 1,
          activeUsers: 6,
          totalBooks: 12,
          availableBooks: 10,
          issuedBooks: 3,
          returnedBooks: 4,
          overdueBooks: 1,
          reservedBooks: 2,
          recentRegistrations: 0,
          revenue: 0,
          pendingFines: 0,
        },
        charts: { monthly: [], categoryPop: [], revenueMonthly: [] },
        recent: { issues: [], returns: [], users: [] },
      },
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <DashboardPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Admin operations')).toBeInTheDocument();
    expect(await screen.findByText('Total users')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Total books')).toBeInTheDocument();
    expect(screen.getAllByText('6').length).toBeGreaterThan(0);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders error state', async () => {
    api.get.mockRejectedValue(new Error('fail'));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <DashboardPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/unable to load dashboard statistics/i)).toBeInTheDocument();
  });
});
