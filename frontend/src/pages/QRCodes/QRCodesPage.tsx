import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import Card from '@/components/Card';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Skeleton from '@/components/Skeleton';
import { useToast } from '@/components/ToastProvider';
import { useTranslation } from 'react-i18next';

type Campaign = {
  id: number;
  title: string;
  description: string;
  status: string;
};

type Session = {
  id: number;
  token: string;
  status: string;
};

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function getBackendOrigin(): string {
  const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (!baseUrl) return '';
  // e.g. http://localhost:5001/api -> http://localhost:5001
  return baseUrl.replace(/\/api\/?$/i, '');
}

const QRCodesPage: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const query = useQuery();
  const campaignIdFilter = query.get('campaignId');

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sessionsByCampaign, setSessionsByCampaign] = useState<Record<number, Session | null>>({});
  const [search, setSearch] = useState('');

  const backendOrigin = getBackendOrigin();

  const filteredCampaigns = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = campaigns;
    if (campaignIdFilter) {
      const id = Number(campaignIdFilter);
      if (!Number.isNaN(id)) list = list.filter((c) => c.id === id);
    }
    if (!q) return list;
    return list.filter((c) => (c.title || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
  }, [campaigns, search, campaignIdFilter]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get('/campaigns/mine');
        const list: Campaign[] = res.data?.campaigns || [];
        setCampaigns(list);

        // For each campaign, fetch sessions and keep the first one (or create one if missing)
        const entries = await Promise.all(
          list.map(async (c) => {
            try {
              const sRes = await api.get(`/campaigns/${c.id}/sessions`);
              const sessions = (sRes.data?.sessions || []) as Session[];
              if (sessions.length > 0) {
                return [c.id, sessions[0]] as const;
              }
              // Create a default session if none exists (should be rare now)
              const createRes = await api.post(`/campaigns/${c.id}/sessions`, { count: 1 });
              const created = createRes.data?.sessions?.[0];
              if (created?.session_id && created?.token) {
                return [c.id, { id: created.session_id, token: created.token, status: 'Pending' }] as const;
              }
              return [c.id, null] as const;
            } catch {
              return [c.id, null] as const;
            }
          })
        );

        const map: Record<number, Session | null> = {};
        for (const [cid, s] of entries) map[cid] = s;
        setSessionsByCampaign(map);
      } catch (e: any) {
        addToast('error', t('qr.load_failed'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [addToast, t]);

  const publicFrontend = ((import.meta as any).env?.VITE_PUBLIC_FRONTEND_URL as string | undefined) || window.location.origin;
  const participantLink = (token: string) => `${publicFrontend.replace(/\/$/, '')}/survey/${token}`;

  const copyLink = async (token: string) => {
    const link = participantLink(token);
    try {
      await navigator.clipboard.writeText(link);
      addToast('success', t('qr.copied'));
    } catch {
      addToast('error', t('qr.copy_failed'));
    }
  };

  const qrPngUrl = (campaignId: number, sessionId: number) =>
    `${backendOrigin}/api/campaigns/${campaignId}/sessions/${sessionId}/qr.png`;

  const qrPdfUrl = (campaignId: number, sessionId: number) =>
    `${backendOrigin}/api/campaigns/${campaignId}/sessions/${sessionId}/qr.pdf`;

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('qr.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('qr.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={t('qr.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outline" onClick={() => navigate('/campaigns')}>
            {t('qr.back_to_campaigns')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-6 w-2/3 mb-3" />
              <Skeleton className="h-40 w-full mb-3" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <Card>
          <p className="text-gray-600 dark:text-gray-300">{t('qr.no_campaigns')}</p>
        </Card>
      ) : (
        <>
        {String(publicFrontend).includes('localhost') && (
          <Card className="border-l-4 border-yellow-400">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              ⚠️ Les liens/QR contiennent <b>localhost</b>, donc ça marche seulement sur ce PC.
              Pour scanner depuis un téléphone, ouvre le front via l’IP du PC (ex: http://192.168.x.x:5173)
              ou configure <b>VITE_PUBLIC_FRONTEND_URL</b> dans <code>.env</code>.
            </p>
          </Card>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCampaigns.map((c) => {
            const s = sessionsByCampaign[c.id];
            return (
              <Card key={c.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{c.title}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{c.status}</p>
                  </div>
                  <Button variant="outline" onClick={() => navigate(`/campaigns/${c.id}`)}>
                    {t('qr.open')}
                  </Button>
                </div>

                {!s ? (
                  <p className="text-sm text-red-600">{t('qr.no_session')}</p>
                ) : (
                  <>
                    <div className="flex justify-center">
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
                        <img
                          src={qrPngUrl(c.id, s.id)}
                          alt={`QR ${c.title}`}
                          className="w-40 h-40 object-contain"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-gray-600 dark:text-gray-300">{t('qr.participant_link')}</div>
                      <div className="flex gap-2">
                        <Input readOnly value={participantLink(s.token)} />
                        <Button onClick={() => copyLink(s.token)}>{t('qr.copy')}</Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => window.open(qrPdfUrl(c.id, s.id), '_blank')}>
                          {t('qr.download_pdf')}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => window.open(qrPngUrl(c.id, s.id) + '?download=1', '_blank')}
                        >
                          {t('qr.download_png')}
                        </Button>
                        <Button variant="outline" onClick={() => window.open(participantLink(s.token), '_blank')}>
                          {t('qr.test_survey')}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
};

export default QRCodesPage;
