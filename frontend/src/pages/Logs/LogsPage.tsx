import React, { useEffect, useState } from 'react';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Button from '@/components/Button';
import Skeleton from '@/components/Skeleton';
import api from '@/services/api';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ToastProvider';

type LogItem = {
  id: number;
  created_at: string;
  action: string;
  details?: string;
  campaign_id?: number | null;
  user?: { email?: string; login?: string } | null;
};

const LogsPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LogItem[]>([]);
  const [q, setQ] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/logs', { params: { limit: 200, q: q || undefined } });
      setItems(res.data.items || []);
    } catch (e: any) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t('logs.title')}</h1>
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} />
          <Button onClick={fetchLogs} disabled={loading}>{t('common.search')}</Button>
        </div>
      </div>

      <Card>
        {loading ? (
          <Skeleton count={8} />
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('logs.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b dark:border-gray-700">
                  <th className="py-2 pr-4">{t('logs.time')}</th>
                  <th className="py-2 pr-4">{t('logs.action')}</th>
                  <th className="py-2 pr-4">{t('logs.user')}</th>
                  <th className="py-2 pr-4">Campaign</th>
                  <th className="py-2">{t('logs.details')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id} className="border-b dark:border-gray-800">
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4">{l.action}</td>
                    <td className="py-2 pr-4">{l.user?.email || l.user?.login || '-'}</td>
                    <td className="py-2 pr-4">{l.campaign_id ?? '-'}</td>
                    <td className="py-2">{l.details || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default LogsPage;
