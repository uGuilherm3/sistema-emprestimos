import { useState, useRef, useEffect } from 'react';
import { api } from './utils/apiClient';
import { Mail, Lock, ShieldCheck, ShieldAlert, Camera, User, Briefcase, ArrowRight, Shield, X, Users } from 'lucide-react';

const TIPOS = ['Adm', 'Técnico', 'Assistente', 'Solicitante'];

const inputClass = "w-full pl-14 pr-6 py-4 bg-[var(--bg-page)] rounded-2xl text-sm text-slate-900 dark:text-white outline-none transition-all focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5";

export default function CriarPerfil({ onAbrirUsuario }) {
  const [form, setForm] = useState({
    nome: '', username: '', email: '', atribuicao: '',
    setor: '', tipo_usuario: 'Técnico', password: '', confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const [fotoPreview, setFotoPreview] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });
  const fotoRef = useRef(null);

  useEffect(() => {
    api.users.list({ order: 'nome', limit: 500 }).then(({ data }) => {
      if (data) setUsuarios(data);
    });
  }, [sucesso]); // recarrega após criar um novo

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErro('A foto deve ter no máximo 5MB.'); return; }
    setFotoPreview(URL.createObjectURL(file));
    setErro('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro(''); setSucesso(false);

    if (!form.nome.trim() || !form.username.trim()) {
      setErro('Nome e nome de usuário são obrigatórios.'); return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      setErro('As senhas não coincidem.'); return;
    }

    setLoading(true);
    try {
      // Verifica apenas username (email é opcional)
      const { data: existente } = await api.users.checkExists(form.username.trim(), form.email.trim() || `__noemail_${Date.now()}__`);
      if (existente?.id) { setErro('Nome de usuário já cadastrado.'); setLoading(false); return; }

      const id = crypto.randomUUID();
      const { data, error } = await api.users.insert({
        id,
        username: form.username.trim(),
        email: form.email.trim() || null,
        pin: form.password || null,
        nome: form.nome.trim(),
        setor: form.setor.trim().toUpperCase() || null,
        atribuicao: form.atribuicao.trim() || null,
        tipo_usuario: form.tipo_usuario,
      });
      if (error) throw new Error(error);

      if (fotoRef.current?.files[0]) {
        await api.uploads.foto(data?.id || id, fotoRef.current.files[0]);
      }

      setSucesso(true);
      setForm({ nome: '', username: '', email: '', atribuicao: '', setor: '', tipo_usuario: 'Técnico', password: '', confirmPassword: '' });
      setFotoPreview(null);
      if (fotoRef.current) fotoRef.current.value = '';
      setTimeout(() => setSucesso(false), 4000);
    } catch (err) {
      setErro(err.message || 'Erro ao criar perfil.');
    } finally {
      setLoading(false);
    }
  };

  const inicial = form.nome.charAt(0) || form.username.charAt(0) || '?';

  return (
    <div className="relative w-full min-h-full flex flex-col items-center justify-center px-6 overflow-x-hidden">

      {/* FORMULÁRIO */}
      <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <form onSubmit={handleSubmit} className="space-y-6 pb-20">

          {/* CARD PRINCIPAL */}
          <div className="bg-[var(--bg-card)] rounded-[2.5rem] overflow-hidden shadow-sm relative">
            <div className="h-32 bg-gradient-to-r from-[var(--bg-soft)] to-[var(--bg-card)] opacity-50" />

            {/* AVATAR */}
            <div className="px-10 pb-10 -mt-16 flex flex-col md:flex-row items-end gap-6 relative z-0">
              <div className="relative">
                <div className="w-32 h-32 rounded-[2rem] bg-[var(--bg-page)] overflow-hidden flex items-center justify-center border-4 border-[var(--bg-card)] shadow-sm">
                  {fotoPreview
                    ? <img src={fotoPreview} alt="Avatar" className="w-full h-full object-cover" onError={() => setFotoPreview(null)} />
                    : <span className="text-4xl font-bold text-[#404040] uppercase select-none">{inicial}</span>
                  }
                </div>
                <button type="button" onClick={() => fotoRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2.5 bg-slate-200 dark:bg-[#404040] text-slate-700 dark:text-white rounded-xl shadow-lg hover:scale-110 transition-transform">
                  <Camera size={16} />
                </button>
                {fotoPreview && (
                  <button type="button" onClick={() => { setFotoPreview(null); if (fotoRef.current) fotoRef.current.value = ''; }}
                    className="absolute top-0 right-0 p-1.5 bg-red-500 text-white rounded-xl shadow-lg hover:scale-110 transition-transform">
                    <X size={12} />
                  </button>
                )}
                <input type="file" ref={fotoRef} onChange={handleFoto} className="hidden" accept="image/*" />
              </div>
              <div className="flex-1 pb-2">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white capitalize tracking-tight">
                  {form.username || 'Novo usuário'}
                </h3>
                <p className="text-sm font-medium text-[#A0A0A0]">
                  {form.atribuicao || 'Preencha os dados abaixo'}
                </p>
              </div>
            </div>

            {/* CAMPOS */}
            <div className="px-10 pb-10 grid grid-cols-1 md:grid-cols-2 gap-8 pt-10">

              {/* DADOS DA CONTA */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-[#606060] uppercase tracking-[0.2em] mb-2 ml-1">Dados da Conta</p>
                <div className="relative">
                  <User size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" />
                  <input type="text" value={form.nome} onChange={set('nome')} placeholder="Nome Completo" className={inputClass} />
                </div>
                <div className="relative">
                  <User size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" />
                  <input type="text" value={form.username} onChange={set('username')} placeholder="Nome de usuário" className={inputClass} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <Briefcase size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" />
                    <input type="text" value={form.atribuicao} onChange={set('atribuicao')} placeholder="Cargo" className={inputClass} />
                  </div>
                  <div className="relative">
                    <User size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" />
                    <input type="text" value={form.setor} onChange={set('setor')} placeholder="Setor / Unidade" className={inputClass} />
                  </div>
                </div>
                <div className="relative">
                  <Shield size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060] z-10" />
                  <select value={form.tipo_usuario} onChange={set('tipo_usuario')}
                    className={`${inputClass} appearance-none cursor-pointer`}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* SEGURANÇA */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-[#606060] uppercase tracking-[0.2em] mb-2 ml-1">Segurança</p>
                <div className="relative">
                  <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" />
                  <input type="email" value={form.email} onChange={set('email')} placeholder="E-mail Corporativo (opcional)" className={inputClass} />
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" />
                  <input type="password" value={form.password} onChange={set('password')} placeholder="Senha (PIN)" className={inputClass} />
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#606060]" />
                  <input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Confirmar senha" className={inputClass} />
                </div>
              </div>
            </div>
          </div>

          {/* BOTÃO */}
          <div className="relative flex flex-col items-center">
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-between bg-[var(--bg-card)] p-3 rounded-3xl group transition-all disabled:opacity-30">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-[#606060] ml-6">
                {loading ? 'Criando perfil...' : 'Criar perfil'}
              </span>
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl transition-all group-hover:opacity-70 bg-[var(--bg-page)] text-slate-900 dark:text-white shadow-inner">
                {loading
                  ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <ArrowRight size={18} />}
              </div>
            </button>
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-3 w-full justify-center">
              {sucesso && (
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-[10px] uppercase tracking-widest animate-in fade-in zoom-in slide-in-from-bottom-2 bg-black/5 dark:bg-white/5 px-4 py-2 rounded-full shadow-sm">
                  <ShieldCheck size={14} /> Perfil criado com sucesso
                </div>
              )}
              {erro && (
                <div className="flex items-center gap-2 text-red-400 font-bold text-[10px] uppercase tracking-widest animate-in fade-in zoom-in slide-in-from-bottom-2 bg-red-500/10 px-4 py-2 rounded-full shadow-sm">
                  <ShieldAlert size={14} /> {erro}
                </div>
              )}
            </div>
          </div>

        </form>
      </div>

      {/* SIDEBAR DIREITA — TODOS OS COLABORADORES */}
      {usuarios.length > 0 && (
        <div className="fixed right-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-1000 hidden xl:flex z-40">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-[var(--bg-card)] rounded-full flex items-center justify-center text-[#606060] shadow-sm opacity-40">
              <Users size={20} />
            </div>
            <div className="h-16 w-px bg-gradient-to-b from-transparent via-[#606060]/20 to-transparent" />
          </div>
          <style>{`.sidebar-users::-webkit-scrollbar{display:none}`}</style>
          <div className="sidebar-users bg-[var(--bg-card)] p-2.5 rounded-full flex flex-col items-center gap-3"
            style={{ maxHeight: 'calc(8 * 52px)', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {usuarios.map(user => (
              <button
                key={user.id}
                type="button"
                onClick={() => onAbrirUsuario && onAbrirUsuario(user)}
                onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ show: true, text: user.nome || user.username, x: r.left, y: r.top + r.height / 2 }); }}
                onMouseLeave={() => setTooltip(t => ({ ...t, show: false }))}
                className="w-10 h-10 rounded-full overflow-hidden opacity-40 hover:opacity-100 hover:scale-110 transition-all shrink-0 cursor-pointer"
              >
                {user.foto_perfil ? (
                  <img src={user.foto_perfil} className="w-full h-full object-cover" alt={user.username} />
                ) : (
                  <div className="w-full h-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-[8px] font-black uppercase text-slate-600 dark:text-slate-300">
                    {(user.nome || user.username || '?').charAt(0)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {tooltip.show && (
        <div
          style={{ position: 'fixed', top: tooltip.y, left: tooltip.x - 8, transform: 'translate(-100%, -50%)', zIndex: 999999, pointerEvents: 'none' }}
          className="px-3 py-2 bg-[#0f172a] dark:bg-white text-white dark:text-[#0f172a] text-xs font-medium rounded-full whitespace-nowrap shadow-lg border border-white/10 dark:border-black/10"
        >
          {tooltip.text}
        </div>
      )}

    </div>
  );
}
