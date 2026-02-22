import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { useToast } from '@/components/ToastProvider';
import { useTranslation } from 'react-i18next';
import Skeleton from '@/components/Skeleton';

interface Campaign {
  id: number;
  title: string;
  description: string;
  status: string;
  start_date?: string;
  end_date?: string;
}

const CampaignList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [mineRes, allRes] = await Promise.all([
          api.get('/campaigns/mine'),
          api.get('/campaigns/all'),
        ]);
        setMyCampaigns(mineRes.data.campaigns);
        setAllCampaigns(allRes.data.campaigns);
      } catch (error) {
        addToast('error', 'Failed to load campaigns');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [addToast]);

  const list = tab === 'mine' ? myCampaigns : allCampaigns;
  const filtered = list.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tab === 'mine' ? t('campaigns.my_campaigns') : t('campaigns.all_campaigns')}</h1>
        <Button variant="primary" onClick={() => navigate('/campaigns/create')}>
          {t('campaigns.create_campaign')}
        </Button>
      </div>
      <div className="flex items-center space-x-4">
        <Button
          variant={tab === 'mine' ? 'primary' : 'outline'}
          onClick={() => setTab('mine')}
        >
          {t('campaigns.my_campaigns')}
        </Button>
        <Button
          variant={tab === 'all' ? 'primary' : 'outline'}
          onClick={() => setTab('all')}
        >
          {t('campaigns.all_campaigns')}
        </Button>
        <div className="ml-auto w-64">
          <Input
            type="text"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <Skeleton count={5} height="3rem" />
      ) : filtered.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-600 dark:text-gray-300">{t('campaigns.no_campaigns')}</p>
          <Button variant="primary" className="mt-4" onClick={() => navigate('/campaigns/create')}>
            {t('campaigns.create_campaign')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className="cursor-pointer" onClick={() => navigate(`/campaigns/${c.id}`)}>
              <h3 className="text-lg font-semibold mb-1">{c.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{c.description}</p>
              <div className="mt-2 flex items-center space-x-2">
                <Badge variant={c.status?.toLowerCase() === 'active' ? 'success' : c.status?.toLowerCase() === 'draft' ? 'info' : 'default'}>
                  {c.status}
                </Badge>
              </div>

              <div className="mt-4 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                <Button variant="outline" onClick={() => navigate(`/campaigns/${c.id}?tab=analytics`)}>
                  Analytics
                </Button>
                <Button variant="outline" onClick={() => navigate(`/campaigns/${c.id}?tab=sessions`)}>
                  Sessions / QR
                </Button>
                <Button variant="outline" onClick={() => navigate(`/campaigns/${c.id}?tab=exports`)}>
                  Exports
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CampaignList;