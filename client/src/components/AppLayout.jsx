import { useState } from 'react';
import { Layout, Menu, Button, Avatar, Drawer, Badge } from 'antd';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ScanBarcode,
  Wallet,
  BarChart3,
  Settings,
  ScrollText,
  LogOut,
  Menu as MenuIcon,
  Bookmark,
  UserRound,
  Library,
  Sparkles,
  Tags,
  CalendarClock,
  Heart,
  Bell,
  ShoppingCart,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { roleLabel } from '../utils/roles.js';
import ElenaChat from './ElenaChat.jsx';
import QuestLearnLogo from './QuestLearnLogo.jsx';
import ThemeSwitcher from './ThemeSwitcher.jsx';
import NotificationBell from './NotificationBell.jsx';
import api from '../services/api.js';

const { Header, Sider, Content } = Layout;

const NAV = [
  { key: '/app', label: 'Dashboard', icon: <LayoutDashboard size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN', 'STUDENT', 'MEMBER'] },
  { key: '/catalog', label: 'Books', icon: <BookOpen size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN', 'STUDENT', 'MEMBER'] },
  { key: '/free', label: 'Free Books', icon: <BookOpen size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN', 'STUDENT', 'MEMBER'] },
  { key: '/categories', label: 'Categories', icon: <Tags size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN', 'STUDENT', 'MEMBER'] },
  { key: '/upcoming', label: 'Upcoming Books', icon: <CalendarClock size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN', 'STUDENT', 'MEMBER'] },
  { key: '/wishlist', label: 'My Wishlist', icon: <Heart size={16} />, roles: ['STUDENT', 'MEMBER'] },
  { key: '/cart', label: 'Book cart', icon: <ShoppingCart size={16} />, roles: ['STUDENT', 'MEMBER'] },
  { key: '/notifications', label: 'Notifications', icon: <Bell size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN', 'STUDENT', 'MEMBER'] },
  { key: '/circulation', label: 'Circulation', icon: <ScanBarcode size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'] },
  { key: '/inventory', label: 'Inventory / barcodes', icon: <ScanBarcode size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'] },
  { key: '/users', label: 'People', icon: <Users size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'] },
  { key: '/fines', label: 'Fines', icon: <Wallet size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN', 'STUDENT', 'MEMBER'] },
  { key: '/reservations', label: 'Reservations', icon: <Bookmark size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN', 'STUDENT', 'MEMBER'] },
  { key: '/loans', label: 'My loans', icon: <Library size={16} />, roles: ['STUDENT', 'MEMBER'] },
  { key: '/analytics', label: 'Reports', icon: <BarChart3 size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'] },
  { key: '/settings', label: 'Settings', icon: <Settings size={16} />, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { key: '/audit', label: 'Activity logs', icon: <ScrollText size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'] },
  { key: '/preferences', label: 'Preferences', icon: <Sparkles size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN', 'STUDENT', 'MEMBER'] },
  { key: '/profile', label: 'Profile', icon: <UserRound size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN', 'STUDENT', 'MEMBER'] },
];

function UpcomingPreview() {
  const { data } = useQuery({
    queryKey: ['upcoming-books-sidebar'],
    queryFn: async () => (await api.get('/books/upcoming', { params: { compact: 1 } })).data,
  });
  const coming = (data?.comingSoon || []).slice(0, 2);
  const featured = (data?.featured || []).slice(0, 2);
  const fresh = (data?.newReleases || []).slice(0, 2);
  if (!coming.length && !featured.length && !fresh.length) return null;
  return (
    <div className="app-sider-upcoming">
      <h4>Upcoming Books</h4>
      {fresh.map((b) => (
        <Link key={b._id} to={`/catalog/${b._id}`} title={b.title}>
          📚 {b.title}
        </Link>
      ))}
      {coming.map((b) => (
        <Link key={b._id} to={`/catalog/${b._id}`} title={b.title}>
          📖 {b.title}
        </Link>
      ))}
      {featured.map((b) => (
        <Link key={b._id} to={`/catalog/${b._id}`} title={b.title}>
          ⭐ {b.title}
        </Link>
      ))}
      <Link to="/upcoming">View all</Link>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const cartCount = useQuery({
    queryKey: ['cart-ids'],
    queryFn: async () => (await api.get('/books/cart/ids')).data,
    enabled: ['STUDENT', 'MEMBER'].includes(user.role),
  });
  const wishCount = useQuery({
    queryKey: ['wishlist-ids'],
    queryFn: async () => (await api.get('/books/wishlist/ids')).data,
    enabled: ['STUDENT', 'MEMBER'].includes(user.role),
  });
  const nCount = (cartCount.data?.ids || []).length;
  const wCount = (wishCount.data?.ids || []).length;
  const items = NAV.filter((n) => n.roles.includes(user.role)).map((n) => ({
    key: n.key,
    icon: n.icon,
    label:
      n.key === '/cart' && nCount ? (
        <span className="flex items-center justify-between gap-2">{n.label}<Badge count={nCount} size="small" /></span>
      ) : n.key === '/wishlist' && wCount ? (
        <span className="flex items-center justify-between gap-2">{n.label}<Badge count={wCount} size="small" /></span>
      ) : (
        n.label
      ),
  }));

  const selected =
    NAV.find((n) => n.key !== '/app' && loc.pathname.startsWith(n.key))?.key || (loc.pathname === '/app' ? '/app' : loc.pathname);

  const menu = (
    <Menu
      theme="dark"
      className="app-sider-menu"
      selectedKeys={[selected]}
      items={items}
      onClick={({ key }) => {
        nav(key);
        setOpen(false);
      }}
    />
  );

  async function onSignOut() {
    await logout();
    nav('/', { replace: true });
  }

  const brand = (
    <Link to="/" className="app-sider-brand" aria-label="QuestLearn home">
      <QuestLearnLogo className="h-9 w-9 shrink-0 text-white" />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold leading-tight">QuestLearn</div>
        <div className="truncate text-[11px] opacity-80">Your Journey to Knowledge Begins Here.</div>
      </div>
    </Link>
  );

  return (
    <Layout className="min-h-screen ql-app-shell">
      <Sider breakpoint="lg" collapsedWidth={0} width={248} className="app-sider anim-slide-in" zeroWidthTriggerStyle={{ display: 'none' }}>
        {brand}
        <div className="app-sider-menu-wrap">{menu}</div>
        <UpcomingPreview />
        <div className="app-sider-footer">
          <div className="mb-3 truncate text-xs" style={{ color: 'var(--sidebar-text)' }}>
            {user.name}
          </div>
          <Button className="sign-out-btn" block icon={<LogOut size={16} />} onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </Sider>
      <Layout>
        <Header className="app-navbar flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              className="lg:hidden"
              type="text"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
              icon={<MenuIcon className="text-white" size={20} />}
            />
            <span className="hidden text-sm text-white/85 sm:inline">
              {roleLabel(user.role)} · {user.readerId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeSwitcher />
            <Badge color="var(--accent-color)">
              <Avatar src={user.avatar || undefined} style={{ background: 'var(--tan)' }}>
                {user.name?.[0]}
              </Avatar>
            </Badge>
            <Button className="sign-out-btn sign-out-btn-header" icon={<LogOut size={16} />} onClick={onSignOut}>
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </Header>
        <Content className="app-content page-fade p-4 lg:p-6">
          <Outlet />
        </Content>
      </Layout>
      <Drawer
        title="Navigate"
        placement="left"
        open={open}
        onClose={() => setOpen(false)}
        styles={{
          header: { background: 'var(--sidebar-bg)', color: 'var(--sidebar-text)' },
          body: { padding: 0, background: 'var(--sidebar-bg)' },
        }}
      >
        {menu}
        <UpcomingPreview />
        <div className="p-4">
          <Button className="sign-out-btn" block icon={<LogOut size={16} />} onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </Drawer>
      <ElenaChat />
    </Layout>
  );
}
