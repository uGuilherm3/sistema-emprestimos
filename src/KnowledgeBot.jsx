import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Sparkles, Send, Bot, Globe, Plus, X, Loader2, Link as LinkIcon, ExternalLink, AlertCircle, Cog } from 'lucide-react';
import iaGif from './assets/ia.gif';

const API_BASE = import.meta.env.VITE_BOT_API_URL 
  ? `${import.meta.env.VITE_BOT_API_URL}/api/bot` 
  : 'http://192.168.0.253:3001/api/bot';

// Parser simples de Markdown para HTML (negrito, links, listas)
function parseMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#254E70;text-decoration:underline;font-weight:600;">$1 ↗</a>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:1rem;list-style:disc">$1</li>')
    .replace(/\n/g, '<br/>');
}

export default function KnowledgeBot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLearn, setShowLearn] = useState(false);
  const [learnType, setLearnType] = useState('url'); // 'url' ou 'file'
  const [urlInput, setUrlInput] = useState('');
  const [fileInput, setFileInput] = useState(null);
  const [isLearning, setIsLearning] = useState(false);
  const [toast, setToast] = useState(null);
  const [successAnimation, setSuccessAnimation] = useState(null); // { message: string, title?: string }
  const messagesEndRef = useRef(null);
  
  // Efeito de Digitação no Placeholder
  const [placeholder, setPlaceholder] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(150);

  const words = [
    "Como instalo isso?",
    "Qual contato desse tribunal?",
    "Como chegar na sede da OAB?"
  ];

  useEffect(() => {
    const handleTyping = () => {
      const i = loopNum % words.length;
      const fullText = words[i];

      setPlaceholder(isDeleting 
        ? fullText.substring(0, placeholder.length - 1) 
        : fullText.substring(0, placeholder.length + 1)
      );

      setTypingSpeed(isDeleting ? 80 : 150);

      if (!isDeleting && placeholder === fullText) {
        setTimeout(() => setIsDeleting(true), 2000);
      } else if (isDeleting && placeholder === '') {
        setIsDeleting(false);
        setLoopNum(loopNum + 1);
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [placeholder, isDeleting, loopNum, typingSpeed]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input })
      });

      const data = await response.json();

      // 🚨 ADICIONE ESTA VERIFICAÇÃO AQUI 🚨
      // Se o status não for 2xx ou se vier a propriedade "error" do seu backend
      if (!response.ok || data.error) {
        throw new Error(data.error || "Erro retornado pelo servidor.");
      }

      setMessages(prev => [...prev, {
        role: 'bot',
        text: data.answer,
        sources: data.sources
      }]);
    } catch (error) {
      // Agora ele vai renderizar a mensagem de erro no chat corretamente!
      setMessages(prev => [...prev, { 
        role: 'bot', 
        text: `Desculpe, tive um erro ao processar sua pergunta. Detalhes: ${error.message}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleLearn = async (e) => {
    e?.preventDefault();
    if (isLearning) return;

    if (learnType === 'url' && !urlInput.trim()) {
      setToast({ show: true, message: 'INSIRA UMA URL VÁLIDA', type: 'error' });
      return;
    }

    if (learnType === 'file' && !fileInput) {
      setToast({ show: true, message: 'SELECIONE UM ARQUIVO (PDF OU DOCX)', type: 'error' });
      return;
    }

    setIsLearning(true);
    try {
      let data;
      if (learnType === 'url') {
        if (!urlInput.trim()) return;
        const response = await fetch(`${API_BASE}/learn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlInput })
        });
        data = await response.json();
      } else {
        if (!fileInput) return;
        const formData = new FormData();
        formData.append('file', fileInput);

        const response = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: formData
        });
        data = await response.json();
      }

      if (data.error) throw new Error(data.error);
      
      // Dispara animação de sucesso rica solicitada pelo usuário
      setSuccessAnimation({
          message: data.message || `O bot consumiu a inteligência de: ${data.titulo || 'um documento'} e ficou mais forte!`,
          title: data.titulo
      });

      setUrlInput('');
      setFileInput(null);
      setShowLearn(false);

      // Auto-fechar a animação após 6 segundos (4s + 2s solicitados)
      setTimeout(() => setSuccessAnimation(null), 8000);
    } catch (error) {
      setToast({ message: 'Erro ao aprender: ' + error.message, type: 'error' });
    } finally {
      setIsLearning(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-start pt-0 animate-in fade-in duration-700">
      
      {/* Área do Chat (Centro) */}
      <main className="w-full max-w-5xl flex flex-col bg-[var(--bg-card)] rounded-[3rem] overflow-hidden shadow-2xl h-[800px] max-h-[85vh] shrink-0">

        {/* Header do Chat */}
        <header className="p-6 md:p-8 flex items-center justify-between bg-[var(--bg-page)]/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#254E70]/5 text-[#254E70] rounded-2xl">
              <Bot size={28} strokeWidth={1} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">BILU AI</h2>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-0.5 opacity-60">Base de Conhecimento</p>
            </div>
          </div>
        </header>

        {/* Área de Mensagens */}
        <div className="flex-1 p-6 md:p-10 overflow-y-auto custom-scrollbar space-y-8 bg-gradient-to-b from-transparent to-[var(--bg-soft)]/20">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-10 animate-in fade-in duration-1000">
              
              <div className="max-w-md space-y-8 flex flex-col items-center">
                <div className="w-20 h-20 bg-[#254E70]/5 text-[#254E70]/30 rounded-[2.5rem] flex items-center justify-center shadow-inner animate-in zoom-in-50 duration-700">
                  <Cog size={36} strokeWidth={1.5} className="animate-spin-slow" />
                </div>

                <div className="bg-[var(--bg-soft)]/50 p-8 rounded-[2.5rem] space-y-4 shadow-sm w-full">
                  <p className="text-[12px] text-slate-600 dark:text-[#A0A0A0] font-bold leading-relaxed uppercase tracking-tight">
                    Oi, Guilherme! Esta funcionalidade está em <span className="text-[#8D3046] font-black underline decoration-2 underline-offset-4">fase de testes</span> interna do TI LEND.
                  </p>
                  
                  <div className="pt-2 flex items-center justify-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-black text-[#254E70] uppercase tracking-widest opacity-60">Motor Operacional Ativo</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-10">
                  Pergunte sobre manuais, procedimentos técnicos ou base de conhecimento da OAB.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[90%] md:max-w-[75%] p-6 rounded-[2.5rem] text-[13px] font-bold ${msg.role === 'user' ? 'bg-[#254E70] text-white rounded-tr-none shadow-lg shadow-[#254E70]/10' : 'bg-[var(--bg-soft)] text-slate-700 dark:text-white rounded-tl-none'}`}>
                  <span dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }} />

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-slate-200 dark:border-white/10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#254E70] mb-3 opacity-60">Anexos & Referências:</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((s, i) => (
                          <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-black/20 rounded-xl text-[10px] font-black uppercase tracking-wider text-[#254E70] hover:bg-[#254E70] hover:text-white transition-all shadow-sm">
                            <ExternalLink size={12} /> {s.titulo.substring(0, 25)}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex items-start gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-2xl bg-[var(--bg-soft)] flex items-center justify-center text-slate-400"><Bot size={20} strokeWidth={1} /></div>
              <div className="bg-[var(--bg-soft)] p-6 rounded-[2.5rem] rounded-tl-none w-48 h-16"></div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Form de Input Refatorado */}
        <footer className="p-6 md:p-10 shrink-0 relative">
          
          {/* Notificação (Toast) integrada acima do input */}
          {toast && (
            <div className="absolute -top-12 left-0 w-full flex justify-center px-10 animate-in slide-in-from-bottom-2 fade-in duration-300 z-10">
              <div className={`${toast.type === 'error' ? 'bg-red-600' : 'bg-[#254E70]'} text-white px-8 py-3 rounded-full shadow-2xl flex items-center gap-4`}>
                <div className="p-1 bg-white/20 rounded-md shrink-0">
                  {toast.type === 'error' ? <AlertCircle size={14} /> : <Sparkles size={14} />}
                </div>
                <p className="text-[9px] font-black uppercase tracking-wider leading-tight">{toast.message}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="max-w-5xl mx-auto flex items-center gap-4">
            <div className="relative flex-1 input-underline-wrapper shadow-sm transition-all duration-300">
                <input
                  type="text"
                  placeholder={placeholder}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border-none pl-8 pr-16 py-4 h-full text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0 outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 w-14 bg-[#254E70] text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#254E70]/20 disabled:opacity-20 flex items-center justify-center z-10"
                >
                  <Send size={20} />
                </button>
            </div>

            {/* Novo Botão de Alimentar Integrado */}
            <button
              type="button"
              onClick={() => setShowLearn(true)}
              className="w-[54px] h-[64px] bg-[var(--bg-soft)] text-[#254E70] rounded-[1.25rem] hover:bg-[#254E70] hover:text-white transition-all shadow-sm flex items-center justify-center shrink-0 group"
              title="Alimentar Base de Conhecimento"
            >
              <Plus size={22} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </form>
        </footer>

        </main>

      {/* Modal / Overlay de Aprendizado */}
      {showLearn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[var(--bg-card)] w-full max-w-lg rounded-[3rem] shadow-2xl p-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#254E70]"></div>

            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#254E70]/10 text-[#254E70] rounded-2xl shadow-sm"><Sparkles size={24} /></div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">Update Neural</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Sincronizar Novos Dados</p>
                </div>
              </div>
              <button onClick={() => setShowLearn(false)} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all"><X size={24} /></button>
            </div>

            <div className="flex gap-3 p-2 bg-[var(--bg-soft)] rounded-[2rem] mb-10">
              <button
                onClick={() => setLearnType('url')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${learnType === 'url' ? 'bg-[#254E70] text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <Globe size={16} /> Link Web
              </button>
              <button
                onClick={() => setLearnType('file')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${learnType === 'file' ? 'bg-[#254E70] text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <LinkIcon size={16} /> Arquivos
              </button>
            </div>


            <form onSubmit={handleLearn} className="space-y-8">
              {learnType === 'url' ? (
                <div className="relative">
                  <Globe size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-[#254E70]/50" />
                  <input
                    type="url"
                    autoFocus
                    placeholder="Cole a URL de referência..."
                    className="w-full bg-[var(--bg-soft)] border-none rounded-2xl pl-14 pr-6 py-5 text-sm font-bold focus:ring-4 focus:ring-[#254E70]/10 outline-none transition-all"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                  />
                </div>
              ) : (
                <div className="relative">
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] bg-[var(--bg-soft)]/50 hover:bg-[var(--bg-soft)] cursor-pointer transition-all group">
                    <div className="flex flex-col items-center justify-center px-6">
                      <div className="p-5 bg-white/50 text-[#254E70] rounded-2xl mb-4 group-hover:scale-110 transition-transform shadow-sm">
                        <Plus size={28} />
                      </div>
                      <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight text-center">
                        {fileInput ? fileInput.name : 'Selecionar Manual (.pdf ou .docx)'}
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx"
                      onChange={(e) => setFileInput(e.target.files[0])}
                    />
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={isLearning}
                className="w-full py-6 bg-[#254E70] text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 transition-all hover:opacity-95 disabled:opacity-50 shadow-2xl shadow-[#254E70]/30"
              >
                {isLearning ? <><Loader2 size={20} className="animate-spin" /> Injetando Conhecimento...</> : 'Confirmar Treinamento'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DIV CENTRALIZADA DE SUCESSO (IA.GIF) - POLIDA */}
      {successAnimation && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] w-full max-w-md bg-[var(--bg-card)] rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/5 p-12 animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center text-center">
           
           {/* O GIF CENTRALIZADO */}
           <div className="relative w-40 h-40 rounded-2xl overflow-hidden shadow-xl mb-8 border border-white/10">
              <img 
                src={iaGif} 
                alt="IA Upgrade" 
                className="w-full h-full object-cover" 
              />
           </div>

           <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Upgrade Neural Finalizado</span>
              </div>
              
              <p className="text-[12px] font-medium text-[var(--text-main)] leading-relaxed uppercase tracking-[0.15em] opacity-80 max-w-xs mx-auto">
                 {successAnimation.message}
              </p>
           </div>
        </div>
      )}
    </div>
  );
}
