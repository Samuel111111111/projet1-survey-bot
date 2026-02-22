import React, { useEffect, useMemo, useState } from 'react';
import Card from '@/components/Card';
import Table from '@/components/Table';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Button from '@/components/Button';
import api from '@/services/api';
import { useToast } from '@/components/ToastProvider';

type UserItem = {
  id: number;
  login: string;
  email?: string | null;
  role: 'admin' | 'campaign_manager' | 'viewer';
  first_name?: string | null;
  last_name?: string | null;
  email_verified?: boolean;
  created_at?: string | null;
};

const roleOptions = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'campaign_manager', label: 'Campaign Manager' },
  { value: 'admin', label: 'Admin' },
] as const;

const UsersPage: React.FC = () => {
  const { addToast } = useToast();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<UserItem[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [dirtyRole, setDirtyRole] = useState<Record<number, UserItem['role']>>({});

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users', { params: { q, limit: 200, offset: 0 } });
      setItems(res.data.items || []);
      setDirtyRole({});
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.error || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    return items.map((u) => {
      const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ');
      const roleValue = dirtyRole[u.id] ?? u.role;

      return {
        id: u.id,
        login: u.login,
        email: u.email || '-',
        name: fullName || '-',
        verified: u.email_verified ? 'Yes' : 'No',
        created: u.created_at ? new Date(u.created_at).toLocaleString() : '-',
        role: (
          <Select
            value={roleValue}
            onChange={(val) => setDirtyRole((prev) => ({ ...prev, [u.id]: val as UserItem['role'] }))}
            options={roleOptions as any}
          />
        ),
        actions: (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={savingId === u.id || (dirtyRole[u.id] ?? u.role) === u.role}
              onClick={async () => {
                const newRole = dirtyRole[u.id] ?? u.role;
                setSavingId(u.id);
                try {
                  await api.patch(`/admin/users/${u.id}`, { role: newRole });
                  addToast({ type: 'success', message: 'Role updated' });
                  await fetchUsers();
                } catch (e: any) {
                  addToast({ type: 'error', message: e?.response?.data?.error || 'Failed to update role' });
                } finally {
                  setSavingId(null);
                }
              }}
            >
              Save
            </Button>
          </div>
        ),
      };
    });
  }, [items, dirtyRole, savingId, addToast]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Only admins can manage roles. An admin cannot change their own role.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search login/email/name..."
          />
          <Button variant="primary" onClick={fetchUsers} disabled={loading}>
            Search
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4">
          <Table
            columns={[
              { key: 'login', label: 'Login' },
              { key: 'email', label: 'Email' },
              { key: 'name', label: 'Name' },
              { key: 'verified', label: 'Verified' },
              { key: 'created', label: 'Created' },
              { key: 'role', label: 'Role' },
              { key: 'actions', label: 'Actions' },
            ]}
            data={rows}
            loading={loading}
            emptyMessage="No users found."
          />
        </div>
      </Card>
    </div>
  );
};

export default UsersPage;