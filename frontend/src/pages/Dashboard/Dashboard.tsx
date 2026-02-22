import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ToastProvider';
import { useTranslation } from 'react-i18next';
import Skeleton from '@/components/Skeleton';
import ThreeDPieKpi from '@/components/ThreeDPieKpi';

interface OverviewItem {
  campaign_id: number;
  title: string;
  total_responses: number;
  total_sessions: number;
}

interface Campaign {
  id: number;
  title: string;
  description: string;
  status: string;
  start_date?: string;
  end_date?: string;
}

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [overview, setOverview] = useState<OverviewItem[]>([]);
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ov, mine] = await Promise.all([
          // Backend exposes stats overview under /api/campaigns/overview
          api.get('/campaigns/overview'),
          api.get('/campaigns/mine'),
        ]);
        setOverview(ov.data.campaigns);
        setMyCampaigns(mine.data.campaigns);
      } catch (error: any) {
        // Be graceful: network/cors/backend-down should surface clearly.
        const status = error?.response?.status;
        const msg = error?.response?.data?.error;
        if (status === 401) {
          addToast('error', 'Session expired. Please login again.');
        } else if (status === 404) {
          addToast('error', 'Dashboard endpoints missing on backend.');
        } else {
          addToast('error', msg || 'Failed to load dashboard');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [addToast]);

  // Compute aggregated KPIs
  const totalResponses = overview.reduce((sum, c) => sum + c.total_responses, 0);
  const totalSessions = overview.reduce((sum, c) => sum + c.total_sessions, 0);
  const activeCampaigns = myCampaigns.filter((c) => c.status?.toLowerCase() === 'active');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
      {/* KPIs */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur">
    {loading ? (
      <Skeleton count={3} />
    ) : (
      <ThreeDPieKpi
        label={t('dashboard.active_campaigns')}
        value={activeCampaigns.length}
        maxValue={Math.max(1, myCampaigns.length)}
        subLabel={`${activeCampaigns.length} / ${myCampaigns.length} campagnes`}
      />
    )}
  </Card>

  <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur">
    {loading ? (
      <Skeleton count={3} />
    ) : (
      <ThreeDPieKpi
        label={t('dashboard.total_responses')}
        value={totalResponses}
        maxValue={totalSessions > 0 ? totalSessions : undefined}
        subLabel={totalSessions > 0 ? 'Réponses / sessions' : 'Total des réponses'}
      />
    )}
  </Card>

  <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur">
    {loading ? (
      <Skeleton count={3} />
    ) : (
      <ThreeDPieKpi
        label={t('dashboard.total_sessions')}
        value={totalSessions}
        subLabel="Sessions créées"
      />
    )}
  </Card>
</div>
      {/* Recent campaigns */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">{t('dashboard.recent_campaigns')}</h2>
          <Button variant="primary" onClick={() => navigate('/campaigns/create')}>
            {t('dashboard.create_campaign')}
          </Button>
        </div>
        {loading ? (
          <Skeleton count={3} height="3rem" />
        ) : myCampaigns.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">{t('campaigns.no_campaigns')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myCampaigns.slice(0, 6).map((c) => (
              <Card key={c.id} className="cursor-pointer" onClick={() => navigate(`/campaigns/${c.id}`)}>
                <h3 className="text-lg font-semibold mb-1">{c.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{c.description}</p>
                <div className="mt-2 flex items-center space-x-2">
                  <Badge variant={c.status?.toLowerCase() === 'active' ? 'success' : c.status?.toLowerCase() === 'draft' ? 'info' : 'default'}>
                    {c.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;