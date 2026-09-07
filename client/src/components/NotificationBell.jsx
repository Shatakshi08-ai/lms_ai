import { useEffect } from 'react';
import { Badge, Button, Dropdown, Empty, Typography, message } from 'antd';
import { Bell } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { connectNotifySocket } from '../services/notifySocket.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/analytics/notifications')).data,
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!user) return undefined;
    const conn = connectNotifySocket({
      onNotification(payload) {
        message.info({
          content: (
            <div>
              <div className="font-semibold">🔔 New Notification</div>
              <div>{payload.body || payload.title}</div>
            </div>
          ),
          duration: 5,
        });
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['cart'] });
        qc.invalidateQueries({ queryKey: ['cart-ids'] });
        qc.invalidateQueries({ queryKey: ['wishlist'] });
        qc.invalidateQueries({ queryKey: ['wishlist-ids'] });
      },
    });
    return () => conn.disconnect();
  }, [user?._id, qc]);

  const mark = useMutation({
    mutationFn: (id) => api.patch(`/analytics/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = q.data?.unread || (q.data?.items || []).filter((n) => !n.read).length;
  const items = (q.data?.items || []).slice(0, 8);

  const overlay = (
    <div className="w-80 max-h-96 overflow-auto rounded-lg bg-[color:var(--surface-color)] p-2 shadow-lg">
      <div className="mb-2 flex items-center justify-between px-1">
        <Typography.Text strong>Notifications</Typography.Text>
        <Button type="link" size="small" onClick={() => nav('/notifications')}>
          View all
        </Button>
      </div>
      {!items.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No notifications yet" />}
      {items.map((n) => (
        <button
          type="button"
          key={n._id}
          className={`mb-1 w-full rounded-md px-2 py-2 text-left text-sm ${n.read ? 'opacity-70' : 'bg-[color:var(--light-pink)]'}`}
          onClick={() => {
            if (!n.read) mark.mutate(n._id);
            nav('/notifications');
          }}
        >
          <div className="font-medium">{n.title}</div>
          <div className="text-[color:var(--muted-text)]">{n.body}</div>
        </button>
      ))}
    </div>
  );

  return (
    <Dropdown dropdownRender={() => overlay} trigger={['click']} placement="bottomRight">
      <Badge count={unread} size="small">
        <Button type="text" aria-label="Notifications" icon={<Bell className="text-white" size={18} />} />
      </Badge>
    </Dropdown>
  );
}
