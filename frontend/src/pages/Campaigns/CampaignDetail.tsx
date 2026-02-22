import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';
import Tabs, { TabItem } from '@/components/Tabs';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Button from '@/components/Button';
import Badge from '@/components/Badge';
import Table from '@/components/Table';
import Skeleton from '@/components/Skeleton';
import { useToast } from '@/components/ToastProvider';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, Legend } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface CampaignDetailData {
  id: number;
  title: string;
  description: string;
  status: string;
  start_date?: string;
  end_date?: string;
  is_anonymous: boolean;
  is_private: boolean;
  screening_question_id?: number | null;
  screening_allowed_option_ids?: string | null;
  questions: Array<{
    id: number;
    question_text: string;
    question_type: string;
    is_required: boolean;
    ordering: number;
    preferred_chart_type?: 'bar' | 'pie';
    options: Array<{ id: number; text: string; label: string }>;
  }>;
}

interface SessionItem {
  id: number;
  token: string;
  status: string;
  started_at?: string;
  completed_at?: string;
}

interface StatsData {
  campaign_id: number;
  total_responses: number;
  total_sessions: number;
  questions: Array<{
    question_id: number;
    question_text: string;
    question_type: string;
    options?: Array<{ option_id: number; text: string; label: string; votes: number }>;
    total_answers?: number;
  }>;
}

const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const campaignId = parseInt(id || '', 10);
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<CampaignDetailData | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  // Selected tab state. Defaults to 'overview'. We allow deep linking
  // to a specific tab via a `tab` query parameter. See useEffect below.
  const [selectedTab, setSelectedTab] = useState('overview');
  const [isUpdating, setIsUpdating] = useState(false);

  // Local editable fields
  const [editValues, setEditValues] = useState({
    title: '',
    description: '',
    status: 'Draft',
    start_date: '',
    end_date: '',
    is_anonymous: false,
    is_private: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cRes, sRes, stRes] = await Promise.all([
          api.get(`/campaigns/${campaignId}`),
          api.get(`/campaigns/${campaignId}/sessions`),
          api.get(`/campaigns/${campaignId}/stats`),
        ]);
        setCampaign(cRes.data);
        setEditValues({
          title: cRes.data.title,
          description: cRes.data.description,
          status: cRes.data.status,
          start_date: cRes.data.start_date || '',
          end_date: cRes.data.end_date || '',
          is_anonymous: cRes.data.is_anonymous,
          is_private: cRes.data.is_private,
        });
        setSessions(sRes.data.sessions);
        setStats(stRes.data);
      } catch (error) {
        addToast('error', 'Failed to load campaign');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [campaignId, addToast]);

  // When the query string changes, update the selected tab. We use
  // window.location.search rather than useSearchParams to avoid
  // additional dependencies. The allowed tab keys must match those
  // declared in the tabs array below. If the tab parameter is
  // unrecognized or empty, we leave selectedTab unchanged.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const validTabs = ['overview', 'questions', 'sessions', 'analytics', 'exports', 'access', 'logs'];
    if (tabParam && validTabs.includes(tabParam)) {
      setSelectedTab(tabParam);
    }
    // Note: no dependencies aside from window.location.search ensures this
    // effect runs whenever the URL query changes.
  }, [window.location.search]);

  // Overview update
  const handleUpdateOverview = async () => {
    if (!campaign) return;
    setIsUpdating(true);
    try {
      await api.put(`/campaigns/${campaign.id}`, {
        title: editValues.title,
        description: editValues.description,
        status: editValues.status,
        start_date: editValues.start_date || null,
        end_date: editValues.end_date || null,
        is_anonymous: editValues.is_anonymous,
        is_private: editValues.is_private,
      });
      addToast('success', 'Campaign updated');
      setCampaign({ ...campaign, ...editValues });
    } catch (error: any) {
      const message = error.response?.data?.error || 'Error updating campaign';
      addToast('error', message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Sessions actions
  const createSessions = async (count: number) => {
    try {
      const res = await api.post(`/campaigns/${campaignId}/sessions`, { count });
      setSessions((prev) => [...prev, ...res.data.sessions.map((s: any) => ({
        id: s.session_id,
        token: s.token,
        status: 'Pending',
      }))]);
      addToast('success', `${count} sessions created`);
    } catch (error) {
      addToast('error', 'Failed to create sessions');
    }
  };

  // Download functions
  const resolveApiBase = () => {
    const base = api.defaults.baseURL || '/api';
    if (base.startsWith('http://') || base.startsWith('https://')) return base;
    // Ensure leading slash
    const path = base.startsWith('/') ? base : `/${base}`;
    return `${window.location.origin}${path}`;
  };

  const getSurveyLink = (token: string) => `${window.location.origin}/survey/${token}`;

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadQrPng = async (sessionId: number) => {
    // This endpoint is publicly accessible (auth optional) but we use axios to
    // keep a consistent download experience.
    const url = `${resolveApiBase()}/campaigns/${campaignId}/sessions/${sessionId}/qr.png`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to download QR');
    const blob = await res.blob();
    downloadBlob(blob, `session_${sessionId}_qr.png`);
  };

  const downloadQrPdf = async (sessionId: number, token: string) => {
    // Build a simple A4 printable PDF that embeds the PNG QR.
    const qrUrl = `${resolveApiBase()}/campaigns/${campaignId}/sessions/${sessionId}/qr.png`;
    const res = await fetch(qrUrl);
    if (!res.ok) throw new Error('Failed to fetch QR image');
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read QR image'));
      reader.readAsDataURL(blob);
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const title = campaign?.title ? `Campaign: ${campaign.title}` : 'Survey QR Code';
    pdf.setFontSize(16);
    pdf.text(title, 40, 50);

    pdf.setFontSize(11);
    pdf.text(`Session: ${sessionId}`, 40, 72);
    pdf.text(`Link: ${getSurveyLink(token)}`, 40, 92);

    // QR image block
    const imgSize = Math.min(pageWidth - 80, pageHeight - 200, 360);
    const x = (pageWidth - imgSize) / 2;
    const y = 140;
    pdf.addImage(dataUrl, 'PNG', x, y, imgSize, imgSize);

    pdf.save(`session_${sessionId}_qr.pdf`);
  };

  const downloadQrSheet = async () => {
    // This endpoint requires auth; opening in a new tab would drop the JWT.
    // Fetch as blob using the configured axios instance.
    const res = await api.get(`/campaigns/${campaignId}/qr-sheet.pdf`, {
      params: { count: 30, per_page: 30, page_format: 'A4' },
      responseType: 'blob',
    });
    downloadBlob(res.data, `campaign_${campaignId}_qr_sheet.pdf`);
  };
  const exportData = async (fmt: string) => {
    try {
      const res = await api.get(`/export/${campaignId}`, { params: { format: fmt } });
      const { file_name, data_base64, content_type } = res.data;
      const link = document.createElement('a');
      link.href = `data:${content_type};base64,${data_base64}`;
      link.download = file_name;
      link.click();
    } catch (error) {
      addToast('error', 'Export failed');
    }
  };

  // Analytics chart: choose question id and chart type per question
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');


  // When user selects a question, apply its preferred chart type (if any) as default.
  useEffect(() => {
    if (!selectedQuestionId) return;
    const q = campaign?.questions?.find((qq) => qq.id === selectedQuestionId);
    if (q?.preferred_chart_type === 'pie' || q?.preferred_chart_type === 'bar') {
      setChartType(q.preferred_chart_type);
    }
  }, [selectedQuestionId, campaign]);

  const exportCurrentChartPdf = async () => {
    try {
      const el = document.getElementById('analytics-chart-capture');
      if (!el) {
        addToast('error', 'Chart not found');
        return;
      }
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 40;
      const usableWidth = pageWidth - margin * 2;
      const ratio = canvas.height / canvas.width;
      const imgHeight = usableWidth * ratio;

      pdf.setFontSize(16);
      pdf.text(campaign?.title ? `Analytics - ${campaign.title}` : 'Analytics', margin, 50);
      pdf.addImage(img, 'PNG', margin, 80, usableWidth, imgHeight);
      pdf.save(`campaign_${campaignId}_analytics.pdf`);
      addToast('success', 'Analytics PDF downloaded');
    } catch (e) {
      addToast('error', 'Failed to export chart');
    }
  };

  const overviewTab = campaign && (
    <Card className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={t('campaigns.title')}
          value={editValues.title}
          onChange={(e) => setEditValues((v) => ({ ...v, title: e.target.value }))}
        />
        <Select
          label={t('campaigns.status')}
          value={editValues.status}
          onChange={(e) => setEditValues((v) => ({ ...v, status: e.target.value }))}
          options={[{ value: 'Draft', label: 'Draft' }, { value: 'Active', label: 'Active' }, { value: 'Completed', label: 'Completed' }]}
        />
        <Input
          label={t('campaigns.start_date')}
          type="date"
          value={editValues.start_date || ''}
          onChange={(e) => setEditValues((v) => ({ ...v, start_date: e.target.value }))}
        />
        <Input
          label={t('campaigns.end_date')}
          type="date"
          value={editValues.end_date || ''}
          onChange={(e) => setEditValues((v) => ({ ...v, end_date: e.target.value }))}
        />
        <div className="md:col-span-2">
          <Input
            label={t('campaigns.description')}
            value={editValues.description || ''}
            onChange={(e) => setEditValues((v) => ({ ...v, description: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex items-center space-x-6">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={editValues.is_anonymous}
            onChange={(e) => setEditValues((v) => ({ ...v, is_anonymous: e.target.checked }))}
          />
          <span>{t('campaigns.anonymous')}</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={editValues.is_private}
            onChange={(e) => setEditValues((v) => ({ ...v, is_private: e.target.checked }))}
          />
          <span>{t('campaigns.private')}</span>
        </label>
      </div>
      <Button variant="primary" onClick={handleUpdateOverview} disabled={isUpdating}>
        {t('common.update')}
      </Button>
    </Card>
  );

  // Questions tab: For simplicity, display list without editing. Editing can be done on create page. TODO
  const questionsTab = campaign && (
    <Card className="space-y-4">
      {campaign.questions.length === 0 ? (
        <p>{t('campaigns.no_campaigns')}</p>
      ) : (
        <div className="space-y-4">
          {campaign.questions.map((q) => (
            <div key={q.id} className="border-b pb-2">
              <h4 className="font-medium">{q.question_text}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">{q.question_type}</p>
              {q.options.length > 0 && (
                <ul className="ml-4 list-disc text-sm">
                  {q.options.map((o) => (
                    <li key={o.id}>{o.text}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  // Sessions tab
  const sessionsTab = (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex items-center space-x-2">
          <Button variant="primary" onClick={() => createSessions(1)}>
            Create one session
          </Button>
          <Button variant="secondary" onClick={() => createSessions(5)}>
            Create 5 sessions
          </Button>
          <Button variant="outline" onClick={downloadQrSheet}>
            Download QR sheet
          </Button>
        </div>
      </Card>
      <Card>
        <Table
          data={sessions}
          columns={[
            { key: 'id', title: 'ID' },
            { key: 'token', title: 'Token' },
            { key: 'status', title: 'Status' },
            {
              key: 'actions',
              title: 'Actions',
              render: (row) => (
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(getSurveyLink(row.token))}
                  >
                    Copy link
                  </Button>
                  <Button variant="outline" onClick={() => downloadQrPng(row.id)}>
                    Download PNG
                  </Button>
                  <Button variant="outline" onClick={() => downloadQrPdf(row.id, row.token)}>
                    Download PDF
                  </Button>
                </div>
              ),
            },
          ]}
          emptyText="No sessions yet"
        />
        {sessions.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.slice(0, 6).map((s) => (
              <div key={s.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Session #{s.id}</div>
                  <Badge variant={s.status?.toLowerCase() === 'completed' ? 'success' : 'default'}>{s.status}</Badge>
                </div>
                <div className="mt-2 text-xs text-gray-500 break-all">{getSurveyLink(s.token)}</div>
                <div className="mt-3 flex justify-center bg-white rounded p-3">
                  <img
                    alt={`QR session ${s.id}`}
                    className="h-40 w-40"
                    src={`${resolveApiBase()}/campaigns/${campaignId}/sessions/${s.id}/qr.png`}
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" onClick={() => navigator.clipboard.writeText(getSurveyLink(s.token))}>
                    Copy
                  </Button>
                  <Button variant="outline" onClick={() => downloadQrPdf(s.id, s.token)}>
                    PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );

  // Analytics tab
  const analyticsTab = (
    <Card className="space-y-4">
      {stats && (
        <>
          <div className="flex items-center space-x-4">
            <Select
              label="Question"
              value={selectedQuestionId ?? ''}
              onChange={(e) => setSelectedQuestionId(e.target.value === '' ? null : parseInt(e.target.value))}
              options={[
                { value: '', label: 'Select question' },
                ...stats.questions.map((q) => ({ value: q.question_id, label: q.question_text })),
              ]}
            />
            <Select
              label="Chart type"
              value={chartType}
              onChange={(e) => setChartType(e.target.value as any)}
              options={[{ value: 'bar', label: 'Bar' }, { value: 'pie', label: 'Pie' }]}
            />
            <div className="pt-6">
              <Button variant="outline" onClick={exportCurrentChartPdf}>
                Export chart PDF
              </Button>
            </div>
          </div>
          {selectedQuestionId ? (
            (() => {
              const q = stats.questions.find((q) => q.question_id === selectedQuestionId);
              if (!q) return null;
              if (q.options && q.options.length > 0) {
                const data = q.options.map((opt) => ({ name: opt.text, value: opt.votes }));
                return (
                  <div id="analytics-chart-capture" className="w-full h-80">
                    {chartType === 'bar' ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                          <XAxis dataKey="name" hide={data.length > 5} interval={0} angle={-45} textAnchor="end" />
                          <YAxis allowDecimals={false} />
                          <Bar dataKey="value" fill="#6366F1" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label>
                            {data.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={['#6366F1', '#F472B6', '#10B981', '#F59E0B', '#0EA5E9'][idx % 5]} />
                            ))}
                          </Pie>
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                );
              }
              return <p>No options to display for this question.</p>;
            })()
          ) : (
            <p>Select a question to view chart.</p>
          )}
        </>
      )}
    </Card>
  );

  // Exports tab
  const exportsTab = (
    <Card className="space-y-4">
      <div>
        <div className="text-lg font-semibold">Exports</div>
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Exportez les réponses de la campagne. Le format Power BI génère un fichier Excel (.xlsx) avec 2 feuilles :
          <span className="font-medium"> Responses</span> (données brutes) et <span className="font-medium">Stats</span> (agrégations).
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => exportData('csv')}>CSV</Button>
        <Button variant="primary" onClick={() => exportData('xlsx')}>Excel</Button>
        <Button variant="primary" onClick={() => exportData('pdf')}>PDF</Button>
        <Button variant="primary" onClick={() => exportData('powerbi')}>Power BI</Button>
      </div>

      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 p-4">
        <div className="font-semibold">Power BI – Instructions rapides</div>
        <ol className="mt-2 list-decimal ml-5 text-sm text-gray-700 dark:text-gray-200 space-y-1">
          <li>Téléchargez l’export <span className="font-medium">Power BI</span>.</li>
          <li>Dans Power BI Desktop : <span className="font-medium">Get data → Excel</span>.</li>
          <li>Sélectionnez les feuilles <span className="font-medium">Responses</span> et <span className="font-medium">Stats</span>.</li>
          <li>Créez vos visuels et filtres (date, zone_id, question, option_text...).</li>
        </ol>
      </div>
    </Card>
  );

  // ----------------------
// Access (allowed users)
// ----------------------
  const [accessLoading, setAccessLoading] = useState(false);
  const [allowedUsers, setAllowedUsers] = useState<Array<{ id: number; email: string; login: string; role: string }>>([]);
  const [accessCreatorEmail, setAccessCreatorEmail] = useState<string>('');
  const [newAllowedEmail, setNewAllowedEmail] = useState<string>('');

  const fetchAllowedUsers = async () => {
    if (!campaignId) return;
    setAccessLoading(true);
    try {
      const res = await api.get(`/campaigns/${campaignId}/allowed-users`);
      setAllowedUsers(res.data.allowed || []);
      setAccessCreatorEmail(res.data.creator?.email || '');
    } catch (e: any) {
      toast.error(t('common.error'));
    } finally {
      setAccessLoading(false);
    }
  };

  const saveAllowedUsers = async (emails: string[]) => {
    if (!campaignId) return;
    setAccessLoading(true);
    try {
      await api.put(`/campaigns/${campaignId}/allowed-users`, { emails });
      await fetchAllowedUsers();
      toast.success(t('common.saved'));
    } catch (e: any) {
      toast.error(t('common.error'));
    } finally {
      setAccessLoading(false);
    }
  };

  const addAllowedEmail = async () => {
    const email = newAllowedEmail.trim().toLowerCase();
    if (!email) return;
    if (email === accessCreatorEmail?.toLowerCase()) {
      toast.info(t('campaign.access.creator_already_allowed'));
      setNewAllowedEmail('');
      return;
    }
    if (allowedUsers.some((u) => (u.email || '').toLowerCase() === email)) {
      toast.info(t('campaign.access.already_added'));
      setNewAllowedEmail('');
      return;
    }
    const next = [...allowedUsers.map((u) => u.email), email].filter(Boolean) as string[];
    setNewAllowedEmail('');
    await saveAllowedUsers(next);
  };

  const removeAllowedEmail = async (email: string) => {
    const next = allowedUsers
      .map((u) => u.email)
      .filter((e) => (e || '').toLowerCase() !== (email || '').toLowerCase()) as string[];
    await saveAllowedUsers(next);
  };

// ----------------------
// Logs (audit logs)
// ----------------------
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsItems, setLogsItems] = useState<Array<{ id: number; created_at: string; action: string; details?: string; user?: { email?: string; login?: string } }>>([]);

  const fetchCampaignLogs = async () => {
    if (!campaignId) return;
    setLogsLoading(true);
    try {
      const res = await api.get(`/campaigns/${campaignId}/logs`, { params: { limit: 200 } });
      setLogsItems(res.data.items || []);
    } catch (e: any) {
      toast.error(t('common.error'));
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    // Load access + logs when campaign id changes
    if (campaignId) {
      fetchAllowedUsers();
      fetchCampaignLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const accessTab = (
    <Card>
      {!campaign?.is_private ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('campaign.access.public_note')}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('campaign.access.tip_private')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">{t('campaign.access.add_email')}</label>
              <Input
                value={newAllowedEmail}
                onChange={(e) => setNewAllowedEmail(e.target.value)}
                placeholder="user@example.com"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('campaign.access.creator_note', { email: accessCreatorEmail || '-' })}
              </p>
            </div>
            <Button onClick={addAllowedEmail} disabled={accessLoading}>
              {t('common.add')}
            </Button>
          </div>

          <div className="border rounded-md overflow-hidden dark:border-gray-700">
            {accessLoading ? (
              <div className="p-4"><Skeleton count={3} /></div>
            ) : allowedUsers.length === 0 ? (
              <div className="p-4 text-sm text-gray-600 dark:text-gray-300">
                {t('campaign.access.empty')}
              </div>
            ) : (
              <ul className="divide-y dark:divide-gray-700">
                {allowedUsers.map((u) => (
                  <li key={u.id} className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.email || u.login}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.role}</div>
                    </div>
                    <Button variant="outline" onClick={() => removeAllowedEmail(u.email)} disabled={accessLoading}>
                      {t('common.remove')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );

  const logsTab = (
    <Card>
      {logsLoading ? (
        <Skeleton count={6} />
      ) : logsItems.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('logs.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b dark:border-gray-700">
                <th className="py-2 pr-4">{t('logs.time')}</th>
                <th className="py-2 pr-4">{t('logs.action')}</th>
                <th className="py-2 pr-4">{t('logs.user')}</th>
                <th className="py-2">{t('logs.details')}</th>
              </tr>
            </thead>
            <tbody>
              {logsItems.map((l) => (
                <tr key={l.id} className="border-b dark:border-gray-800">
                  <td className="py-2 pr-4 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4">{l.action}</td>
                  <td className="py-2 pr-4">{l.user?.email || l.user?.login || '-'}</td>
                  <td className="py-2">{l.details || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );

  const tabs: TabItem[] = [
    { key: 'overview', title: 'Overview', content: overviewTab || <Skeleton count={3} /> },
    { key: 'questions', title: 'Questions', content: questionsTab || <Skeleton count={3} /> },
    { key: 'sessions', title: 'Sessions', content: sessionsTab },
    { key: 'analytics', title: 'Analytics', content: analyticsTab },
    { key: 'exports', title: 'Exports', content: exportsTab },
    ...(user?.role === 'admin'
      ? [
          { key: 'access', title: 'Access', content: accessTab },
          { key: 'logs', title: 'Logs', content: logsTab },
        ]
      : []),
  ];


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{campaign?.title || 'Campaign'}</h1>
      <Tabs items={tabs} selectedKey={selectedTab} onChange={setSelectedTab} />
    </div>
  );
};

export default CampaignDetail;