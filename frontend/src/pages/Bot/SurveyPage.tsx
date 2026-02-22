import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

type Sender = 'bot' | 'user';

interface Option {
  id: number;
  text: string;
  label: string;
}

interface QuestionPayload {
  session_id: number;
  question_id: number;
  question_text: string;
  question_type: string;
  is_required: boolean;
  options: Option[];
}

interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  ts: number;
}

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-[100vh] w-full flex items-center justify-center bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-900 text-white">
      <div className="w-full max-w-sm px-6 text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shadow-lg">
          <div className="h-10 w-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Ouverture du chat…</h1>
        <p className="mt-2 text-sm text-white/80">
          Merci de patienter un instant. Nous préparons votre session.
        </p>
        <div className="mt-5 h-2 w-full rounded-full bg-white/15 overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-white/70 animate-[kpiFloat_2.6s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
};

const Bubble: React.FC<{ sender: Sender; text: string; ts: number }> = ({ sender, text, ts }) => {
  const isUser = sender === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[82%] rounded-2xl px-4 py-2 shadow-md',
          'transition-transform duration-200',
          isUser
            ? 'bg-emerald-600 text-white rounded-br-md'
            : 'bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 rounded-bl-md',
          'hover:-translate-y-[1px]',
        ].join(' ')}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
        <div className={`mt-1 text-[11px] ${isUser ? 'text-white/80' : 'text-gray-500 dark:text-gray-300'}`}>
          {formatTime(ts)}
        </div>
      </div>
    </div>
  );
};

const TypingBubble: React.FC = () => {
  return (
    <div className="flex justify-start">
      <div className="max-w-[70%] rounded-2xl rounded-bl-md px-4 py-3 shadow-md bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" />
          <span className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:120ms]" />
          <span className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
};

/**
 * Survey Bot - WhatsApp-like experience
 * Requirements:
 * - Loading screen 2-3s BEFORE any message appears.
 * - Welcome message generated only after loader.
 * - No duplicate first question (React StrictMode safe).
 * - More "human" tone + polite guardrails.
 * - Options are presented cleanly at the bottom.
 * - Dark mode remains readable.
 */
const SurveyPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [introLoading, setIntroLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionPayload | null>(null);
  const [botTyping, setBotTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [textValue, setTextValue] = useState('');
  const [selectedMulti, setSelectedMulti] = useState<number[]>([]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);
  const lastQuestionIdRef = useRef<number | null>(null);

  const botApi = useMemo(
    () => axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api' }),
    []
  );

  const pushMessage = (sender: Sender, text: string) => {
    setMessages((prev) => [...prev, { id: uid(), sender, text, ts: Date.now() }]);
  };

  const pushBot = (text: string) => pushMessage('bot', text);
  const pushUser = (text: string) => pushMessage('user', text);

  const resetInputs = () => {
    setTextValue('');
    setSelectedMulti([]);
  };

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, botTyping, currentQuestion]);

  const fetchNext = async () => {
    if (!token) return;
    setBotTyping(true);
    try {
      const res = await botApi.get(`/bot/${token}`);

      if (res.data?.message) {
        pushBot(String(res.data.message));
        pushBot("Merci 🙏 Ton temps compte. Ta participation est bien enregistrée.");
        setCurrentQuestion(null);
        return;
      }

      const payload: QuestionPayload = res.data;

      // Prevent duplicates (React 18 StrictMode double-effect + fast reloads)
      if (lastQuestionIdRef.current !== payload.question_id) {
        lastQuestionIdRef.current = payload.question_id;

        // A more human intro before each question
        const leadIns = [
          "D'accord 🙂",
          "Parfait, merci.",
          "Très bien ✅",
          "Super, on continue.",
        ];
        if (messages.length > 0) pushBot(leadIns[Math.floor(Math.random() * leadIns.length)]);
        pushBot(payload.question_text);
      }

      setCurrentQuestion(payload);
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Une erreur est survenue.';
      pushBot(String(msg));
      setCurrentQuestion(null);
    } finally {
      setBotTyping(false);
    }
  };

  const startConversation = async () => {
    // Welcome tone: warm + reassuring
    pushBot("Salut 👋 Bienvenue !");
    pushBot("Je suis là pour te poser quelques questions. Ça prend moins d’une minute 🙂");
    pushBot("Ne t’inquiète pas : tu choisis simplement une réponse à chaque étape.");
    await fetchNext();
  };

  useEffect(() => {
    // Reset per token
    startedRef.current = false;
    lastQuestionIdRef.current = null;
    setMessages([]);
    setCurrentQuestion(null);
    setBotTyping(false);
    setIsSubmitting(false);
    resetInputs();
    setIntroLoading(true);

    if (!token) {
      setIntroLoading(false);
      pushBot('Lien de sondage invalide.');
      return;
    }

    // StrictMode-safe: run once even if effect is invoked twice in dev
    if (startedRef.current) return;
    startedRef.current = true;

    const timer = window.setTimeout(() => {
      setIntroLoading(false);
      startConversation();
    }, 2400); // ~2.4s

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submitAnswer = async (answerTextForChat: string, payload: any) => {
    if (!token || !currentQuestion) return;
    setIsSubmitting(true);
    try {
      pushUser(answerTextForChat);
      await botApi.post(`/bot/${token}/answer`, payload);
      resetInputs();
      await fetchNext();
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Une erreur est survenue.';
      pushBot(String(msg));
      setCurrentQuestion(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const invalidChoice = () => {
    pushBot("Oups 😅 Cette réponse n’est pas valide.");
    pushBot("Merci de choisir une option proposée juste en bas 👇");
  };

  const handlePickSingle = async (optId: number) => {
    if (!currentQuestion) return;
    const opt = currentQuestion.options.find((o) => o.id === optId);
    if (!opt) {
      invalidChoice();
      return;
    }
    const payload: any = { question_id: currentQuestion.question_id, option_id: optId };
    await submitAnswer(opt.text, payload);
  };

  const handleSendMulti = async () => {
    if (!currentQuestion) return;

    if (currentQuestion.is_required && selectedMulti.length === 0) {
      invalidChoice();
      return;
    }

    const opts = currentQuestion.options.filter((o) => selectedMulti.includes(o.id));
    const label = opts.map((o) => o.text).join(', ');

    // Backend currently supports only one option_id. We send the first one.
    const payload: any = { question_id: currentQuestion.question_id, option_id: selectedMulti[0] };
    await submitAnswer(label || '—', payload);
  };

  const handleSendText = async () => {
    if (!currentQuestion) return;
    const v = (textValue || '').trim();

    if (currentQuestion.is_required && v.length === 0) {
      pushBot("Je n’ai pas reçu ta réponse 🙈");
      pushBot("Peux-tu écrire quelque chose avant d’envoyer ?");
      return;
    }

    const payload: any = { question_id: currentQuestion.question_id, answer_text: v };
    await submitAnswer(v, payload);
  };

  const renderComposer = () => {
    if (!currentQuestion) return null;

    const disabled = isSubmitting || botTyping;

    if (currentQuestion.question_type === 'single_choice') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {currentQuestion.options.map((opt) => (
            <button
              key={opt.id}
              disabled={disabled}
              onClick={() => handlePickSingle(opt.id)}
              className={[
                'group relative overflow-hidden rounded-xl border px-4 py-3 text-left shadow-sm',
                'bg-white/90 hover:bg-white dark:bg-gray-900/70 dark:hover:bg-gray-900',
                'text-gray-900 dark:text-gray-100',
                'transition-transform duration-150 active:scale-[0.99]',
                'disabled:opacity-60',
              ].join(' ')}
              type="button"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-emerald-500/10 to-emerald-500/0" />
              <div className="relative font-medium">{opt.text}</div>
              <div className="relative mt-1 text-xs text-gray-500 dark:text-gray-300">Appuie pour choisir</div>
            </button>
          ))}
        </div>
      );
    }

    if (currentQuestion.question_type === 'multiple_choice') {
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {currentQuestion.options.map((opt) => {
              const active = selectedMulti.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  disabled={disabled}
                  onClick={() =>
                    setSelectedMulti((prev) =>
                      prev.includes(opt.id) ? prev.filter((x) => x !== opt.id) : [...prev, opt.id]
                    )
                  }
                  className={[
                    'rounded-xl border px-4 py-3 text-left shadow-sm transition-all duration-150',
                    active
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white/90 hover:bg-white dark:bg-gray-900/70 dark:hover:bg-gray-900 text-gray-900 dark:text-gray-100',
                    'disabled:opacity-60',
                  ].join(' ')}
                  type="button"
                >
                  <div className="font-medium">{opt.text}</div>
                  <div className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-gray-500 dark:text-gray-300'}`}>
                    {active ? 'Sélectionné ✅' : 'Clique pour sélectionner'}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            disabled={disabled}
            onClick={handleSendMulti}
            className="w-full rounded-xl bg-emerald-600 text-white py-3 font-semibold shadow-md hover:opacity-95 disabled:opacity-60"
            type="button"
          >
            Envoyer ma sélection
          </button>
        </div>
      );
    }

    // text / number / rating
    return (
      <div className="flex gap-2">
        <input
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          disabled={disabled}
          placeholder="Écris ta réponse…"
          className="flex-1 rounded-xl border px-4 py-3 bg-white/90 dark:bg-gray-900/70 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-400"
        />
        <button
          disabled={disabled}
          onClick={handleSendText}
          className="rounded-xl bg-emerald-600 text-white px-5 font-semibold shadow-md hover:opacity-95 disabled:opacity-60"
          type="button"
        >
          Envoyer
        </button>
      </div>
    );
  };

  if (introLoading) return <LoadingScreen />;

  return (
    <div className="min-h-[100vh] w-full">
      <div className="sticky top-0 z-10 bg-emerald-700 text-white shadow">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">Survey Bot</div>
          <div className="text-xs text-white/80">Mode WhatsApp • sécurisé</div>
        </div>
      </div>

      <div className="bg-whatsapp-light dark:bg-whatsapp-dark min-h-[calc(100vh-56px)]">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div
            ref={listRef}
            className="h-[calc(100vh-56px-170px)] overflow-y-auto rounded-2xl bg-white/35 dark:bg-black/20 backdrop-blur border border-white/20 p-4 space-y-3 shadow-sm"
          >
            {messages.map((m) => (
              <Bubble key={m.id} sender={m.sender} text={m.text} ts={m.ts} />
            ))}
            {botTyping ? <TypingBubble /> : null}
          </div>

          {/* Composer */}
          <div className="mt-3 rounded-2xl bg-white/70 dark:bg-gray-900/60 backdrop-blur border border-white/20 p-3 shadow-md">
            {!currentQuestion ? (
              <div className="text-center text-sm text-gray-600 dark:text-gray-200">
                Fin de la session ✅ Merci encore !
              </div>
            ) : (
              <>
                <div className="mb-2 text-xs text-gray-600 dark:text-gray-200">
                  Choisis une réponse ci-dessous 👇
                </div>
                {renderComposer()}
              </>
            )}
          </div>

          <div className="mt-3 text-center text-xs text-gray-500 dark:text-gray-300">
            Astuce : si tu n’arrives pas à cliquer, attends que le bot finisse d’écrire 🙂
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveyPage;
