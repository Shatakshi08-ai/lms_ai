import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import BookDetailPage from './pages/BookDetailPage.jsx';
import CirculationPage from './pages/CirculationPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import FinesPage from './pages/FinesPage.jsx';
import ReservationsPage from './pages/ReservationsPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import StudentHomePage from './pages/StudentHomePage.jsx';
import MyLoansPage from './pages/MyLoansPage.jsx';
import PreferencesPage from './pages/PreferencesPage.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import UpcomingBooksPage from './pages/UpcomingBooksPage.jsx';
import FreeBooksPage from './pages/FreeBooksPage.jsx';
import WishlistPage from './pages/WishlistPage.jsx';
import CartPage from './pages/CartPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import ReaderPage from './pages/ReaderPage.jsx';
import LandingPage from './landing/LandingPage.jsx';
import PublicShell from './landing/PublicShell.jsx';
import AuditPage from './pages/AuditPage.jsx';
import { needsPreferences, isPatron } from './utils/roles.js';

function spin() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spin size="large" />
    </div>
  );
}

function Guard({ children, roles }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return spin();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
  if (needsPreferences(user) && loc.pathname !== '/preferences') {
    return <Navigate to="/preferences" replace />;
  }
  return children;
}

function BrowseShell() {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return spin();
  if (user) {
    if (needsPreferences(user) && loc.pathname !== '/preferences') {
      return <Navigate to="/preferences" replace />;
    }
    return <AppLayout />;
  }
  const path = loc.pathname;
  const guestOk =
    path === '/catalog' ||
    path === '/categories' ||
    path === '/upcoming' ||
    path === '/free' ||
    path.startsWith('/catalog/');
  if (guestOk) return <PublicShell />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return spin();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<LandingPage />} />
      <Route path="/contact" element={<LandingPage />} />
      <Route
        path="/login"
        element={user ? <Navigate to={needsPreferences(user) ? '/preferences' : '/app'} replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to={needsPreferences(user) ? '/preferences' : '/app'} replace /> : <RegisterPage />}
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<BrowseShell />}>
        <Route path="app" element={isPatron(user) ? <StudentHomePage /> : <DashboardPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="catalog/:id/read" element={<ReaderPage />} />
        <Route path="catalog/:id" element={<BookDetailPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="upcoming" element={<UpcomingBooksPage />} />
        <Route path="free" element={<FreeBooksPage />} />
        <Route path="notifications" element={<Guard><NotificationsPage /></Guard>} />
        <Route path="wishlist" element={<Guard><WishlistPage /></Guard>} />
        <Route path="cart" element={<Guard><CartPage /></Guard>} />
        <Route path="loans" element={<Guard><MyLoansPage /></Guard>} />
        <Route path="profile" element={<Guard><ProfilePage /></Guard>} />
        <Route path="preferences" element={<Guard><PreferencesPage /></Guard>} />
        <Route path="fines" element={<Guard><FinesPage /></Guard>} />
        <Route path="reservations" element={<Guard><ReservationsPage /></Guard>} />
        <Route path="circulation" element={<Guard roles={['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN']}><CirculationPage /></Guard>} />
        <Route path="inventory" element={<Guard roles={['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN']}><InventoryPage /></Guard>} />
        <Route path="users" element={<Guard roles={['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN']}><UsersPage /></Guard>} />
        <Route path="analytics" element={<Guard roles={['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN']}><AnalyticsPage /></Guard>} />
        <Route path="settings" element={<Guard roles={['SUPER_ADMIN', 'ADMIN']}><SettingsPage /></Guard>} />
        <Route path="audit" element={<Guard roles={['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN']}><AuditPage /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
