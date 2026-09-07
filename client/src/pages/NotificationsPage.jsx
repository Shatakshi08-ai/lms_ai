import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, List, Typography } from 'antd';
import dayjs from 'dayjs';
import api from '../services/api.js';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/analytics/notifications')).data,
  });
  const mark = useMutation({
    mutationFn: (id) => api.patch(`/analytics/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const all = useMutation({
    mutationFn: () => api.patch('/analytics/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const items = data?.items || [];

  return (
    <div className="page-fade">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Typography.Title level={3} className="!mb-0">
          Notifications
        </Typography.Title>
        <Button disabled={!items.some((n) => !n.read)} onClick={() => all.mutate()} loading={all.isPending}>
          Mark all read
        </Button>
      </div>
      <List
        loading={isLoading}
        dataSource={items}
        locale={{ emptyText: <Empty description="No notifications yet." /> }}
        renderItem={(n) => (
          <List.Item
            actions={[
              !n.read ? (
                <Button key="read" type="link" onClick={() => mark.mutate(n._id)}>
                  Mark read
                </Button>
              ) : null,
            ]}
          >
            <List.Item.Meta
              title={n.title}
              description={
                <>
                  <div>{n.body}</div>
                  <div className="text-xs text-[color:var(--muted-text)]">{dayjs(n.createdAt).format('DD MMM YYYY, hh:mm A')}</div>
                </>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
}
