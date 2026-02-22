import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { useToast } from '@/components/ToastProvider';
import { useTranslation } from 'react-i18next';

type ChartType = 'bar' | 'pie';

interface QuestionOptionForm {
  text: string;
  label?: string;
}

interface QuestionForm {
  id?: number;
  text: string;
  type: string;
  required: boolean;
  options: QuestionOptionForm[];
  preferred_chart_type?: ChartType;
}

const campaignSchema = z.object({
  title: z.string().nonempty('Title is required'),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.string().nonempty(),
  is_anonymous: z.boolean().optional(),
  is_private: z.boolean().optional(),
});

type CampaignForm = z.infer<typeof campaignSchema>;

const CampaignCreate: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      status: 'Draft',
      is_anonymous: false,
      is_private: false,
    },
  });

  const isPrivate = watch('is_private');

  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [screeningQuestionIndex, setScreeningQuestionIndex] = useState<number | null>(null);
  const [screeningAllowedOptions, setScreeningAllowedOptions] = useState<number[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');

  const addQuestion = () => {
    setQuestions((qs) => [
      ...qs,
      {
        text: '',
        type: 'single_choice',
        required: true,
        preferred_chart_type: 'bar',
        options: [{ text: 'Option 1' }, { text: 'Option 2' }],
      },
    ]);
  };

  const updateQuestion = (idx: number, update: Partial<QuestionForm>) => {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...update } : q)));
  };

  const removeQuestion = (idx: number) => {
    setQuestions((qs) => qs.filter((_, i) => i !== idx));

    if (screeningQuestionIndex !== null && screeningQuestionIndex === idx) {
      setScreeningQuestionIndex(null);
      setScreeningAllowedOptions([]);
    }
  };

  const moveQuestion = (idx: number, direction: number) => {
    setQuestions((qs) => {
      const newQs = [...qs];
      const newIndex = idx + direction;

      if (newIndex < 0 || newIndex >= qs.length) return qs;

      [newQs[idx], newQs[newIndex]] = [newQs[newIndex], newQs[idx]];
      return newQs;
    });
  };

  const addOption = (qIdx: number) => {
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === qIdx ? { ...q, options: [...q.options, { text: `Option ${q.options.length + 1}` }] } : q
      )
    );
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === qIdx
          ? { ...q, options: q.options.map((opt, oIdx) => (oIdx === optIdx ? { ...opt, text: value } : opt)) }
          : q
      )
    );
  };

  const removeOption = (qIdx: number, optIdx: number) => {
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === qIdx ? { ...q, options: q.options.filter((_, oIdx) => oIdx !== optIdx) } : q
      )
    );
  };

  const addEmail = () => {
    if (newEmail && !allowedEmails.includes(newEmail)) {
      setAllowedEmails((emails) => [...emails, newEmail]);
      setNewEmail('');
    }
  };

  const removeEmail = (email: string) => {
    setAllowedEmails((emails) => emails.filter((e) => e !== email));
  };

  const onSubmit = async (values: CampaignForm) => {
    try {
      // STEP 1: Create campaign
      // IMPORTANT: backend expects POST /campaigns/ (with trailing slash)
      const createRes = await api.post('/campaigns/', {
        title: values.title,
        description: values.description,
        start_date: values.start_date || undefined,
        end_date: values.end_date || undefined,
        status: values.status,
        is_anonymous: values.is_anonymous,
        is_private: values.is_private,
      });

      const campaignId = createRes.data.campaign_id;

      // STEP 2: Create questions
      const questionIds: number[] = [];

      for (const [idx, q] of questions.entries()) {
        const qRes = await api.post(`/campaigns/${campaignId}/questions`, {
          question_text: q.text,
          question_type: q.type,
          is_required: q.required,
          ordering: idx,
          options: q.options.map((o) => ({ text: o.text, label: o.label })),
          preferred_chart_type: q.preferred_chart_type || 'bar',
        });

        questionIds.push(qRes.data.question_id);
      }

      // STEP 3: Update campaign with screening + allowed users
      const updatePayload: any = {};

      if (screeningQuestionIndex !== null) {
        updatePayload.screening_question_id = questionIds[screeningQuestionIndex];

        // NOTE: Option IDs cannot be guessed.
        // For now we store the selected option indexes, backend should map them.
        updatePayload.screening_allowed_option_indexes = screeningAllowedOptions;
      }

      if (values.is_private) {
        updatePayload.allowed_user_emails = allowedEmails;
      }

      if (Object.keys(updatePayload).length > 0) {
        await api.put(`/campaigns/${campaignId}`, updatePayload);
      }

      addToast('success', 'Campaign created successfully');
      navigate(`/campaigns/${campaignId}`);
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Error creating campaign';
      addToast('error', message);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('campaigns.create_campaign')}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Campaign details */}
        <Card className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              id="title"
              type="text"
              label={t('campaigns.title')}
              error={errors.title?.message}
              {...register('title')}
            />

            <Select
              id="status"
              label={t('campaigns.status')}
              options={[
                { value: 'Draft', label: 'Draft' },
                { value: 'Active', label: 'Active' },
                { value: 'Completed', label: 'Completed' },
              ]}
              {...register('status')}
            />

            <Input
              id="start_date"
              type="date"
              label={t('campaigns.start_date')}
              error={errors.start_date?.message}
              {...register('start_date')}
            />

            <Input
              id="end_date"
              type="date"
              label={t('campaigns.end_date')}
              error={errors.end_date?.message}
              {...register('end_date')}
            />

            <div className="col-span-2">
              <Input
                id="description"
                type="text"
                label={t('campaigns.description')}
                error={errors.description?.message}
                {...register('description')}
              />
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <label className="flex items-center space-x-2">
              <input type="checkbox" {...register('is_anonymous')} />
              <span>{t('campaigns.anonymous')}</span>
            </label>

            <label className="flex items-center space-x-2">
              <input type="checkbox" {...register('is_private')} />
              <span>{t('campaigns.private')}</span>
            </label>
          </div>

          {isPrivate && (
            <div className="space-y-2">
              <h3 className="font-medium">{t('campaigns.allowed_users')}</h3>

              <div className="flex items-center space-x-2">
                <input
                  type="email"
                  placeholder="email@example.com"
                  className="border rounded px-3 py-2 text-sm flex-1"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />

                <Button type="button" variant="secondary" onClick={addEmail}>
                  +
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {allowedEmails.map((email) => (
                  <Badge key={email} variant="primary">
                    <span className="mr-1">{email}</span>
                    <button type="button" onClick={() => removeEmail(email)} className="font-bold">
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Questions section */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('campaigns.questions')}</h2>

            <Button type="button" variant="secondary" onClick={addQuestion}>
              {t('campaigns.add_question')}
            </Button>
          </div>

          {questions.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No questions added yet.</p>
          )}

          {questions.map((q, idx) => (
            <div key={idx} className="border rounded p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Question {idx + 1}</h3>

                <div className="space-x-2">
                  <Button type="button" variant="outline" onClick={() => moveQuestion(idx, -1)}>
                    ↑
                  </Button>
                  <Button type="button" variant="outline" onClick={() => moveQuestion(idx, 1)}>
                    ↓
                  </Button>
                  <Button type="button" variant="danger" onClick={() => removeQuestion(idx)}>
                    {t('campaigns.delete_question')}
                  </Button>
                </div>
              </div>

              <Input
                type="text"
                label={t('campaigns.question_text')}
                value={q.text}
                onChange={(e) => updateQuestion(idx, { text: e.target.value })}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label={t('campaigns.question_type')}
                  value={q.type}
                  onChange={(e) => updateQuestion(idx, { type: e.target.value })}
                  options={[
                    { value: 'single_choice', label: 'Single choice' },
                    { value: 'multiple_choice', label: 'Multiple choice' },
                    { value: 'text', label: 'Text' },
                    { value: 'rating', label: 'Rating' },
                    { value: 'number', label: 'Number' },
                  ]}
                />

                {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                  <Select
                    label="Chart Type"
                    value={q.preferred_chart_type || 'bar'}
                    onChange={(e) =>
                      updateQuestion(idx, { preferred_chart_type: e.target.value as ChartType })
                    }
                    options={[
                      { value: 'bar', label: 'Bar' },
                      { value: 'pie', label: 'Pie' },
                    ]}
                  />
                )}

                <label className="flex items-center space-x-2 mt-2 md:mt-0">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => updateQuestion(idx, { required: e.target.checked })}
                  />
                  <span>{t('campaigns.required')}</span>
                </label>
              </div>

              {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                <div className="space-y-2">
                  <h4 className="font-medium">{t('campaigns.options')}</h4>

                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center space-x-2">
                      <input
                        type="text"
                        className="flex-1 border rounded px-2 py-1 text-sm"
                        value={opt.text}
                        onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                        placeholder={`Option ${oIdx + 1}`}
                      />

                      <button
                        type="button"
                        onClick={() => removeOption(idx, oIdx)}
                        className="text-red-600 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <Button type="button" variant="secondary" onClick={() => addOption(idx)}>
                    {t('campaigns.add_option')}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>

        {/* Screening section */}
        {questions.length > 0 && (
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">{t('campaigns.screening')}</h2>

            <Select
              label={t('campaigns.screening_question')}
              value={screeningQuestionIndex ?? ''}
              onChange={(e) => {
                const idx = e.target.value === '' ? null : parseInt(e.target.value);
                setScreeningQuestionIndex(idx);
                setScreeningAllowedOptions([]);
              }}
              options={[
                { value: '', label: 'None' },
                ...questions.map((q, idx) => ({
                  value: idx,
                  label: q.text || `Question ${idx + 1}`,
                })),
              ]}
            />

            {screeningQuestionIndex !== null &&
              (questions[screeningQuestionIndex].type === 'single_choice' ||
                questions[screeningQuestionIndex].type === 'multiple_choice') && (
                <div className="space-y-2">
                  <h4 className="font-medium">{t('campaigns.screening_options')}</h4>

                  {questions[screeningQuestionIndex].options.map((opt, oIdx) => (
                    <label key={oIdx} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={screeningAllowedOptions.includes(oIdx)}
                        onChange={(e) => {
                          setScreeningAllowedOptions((prev) => {
                            if (e.target.checked) return [...prev, oIdx];
                            return prev.filter((id) => id !== oIdx);
                          });
                        }}
                      />
                      <span>{opt.text}</span>
                    </label>
                  ))}
                </div>
              )}
          </Card>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {t('common.create')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CampaignCreate;
