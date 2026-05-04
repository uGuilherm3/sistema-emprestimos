import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import { loginGLPI } from './utils/glpiClient';
import {
  ShieldAlert, CheckCircle2, ArrowLeft, Sun, Moon, LogOut,
  Home, Calendar, ShoppingBag, Activity, ArrowUpRight, ArrowDownLeft,
  CalendarDays, LayoutGrid, Printer, MessageSquare, FileText, ListChecks,
  Laptop, ScreenShare, Sparkles
} from 'lucide-react';

const SHELL_URL = (import.meta.env.VITE_SHELL_URL || 'http://localhost:5173/sistema-emprestimos/').replace(/\/$/, '');

const APPS = [
  { id: 'dashboard',   nome: 'Dashboard',            desc: 'Métricas e indicadores gerais',        icon: Home,          path: '/',                roles: ['adm'] },
  { id: 'emprestimos', nome: 'Dashboard Empréstimos', desc: 'Visão geral de empréstimos',           icon: Laptop,        path: '/emprestimos',     roles: ['adm'] },
  { id: 'agenda',      nome: 'Agenda',                desc: 'Seus compromissos e tarefas',          icon: Calendar,      path: '/agenda',          roles: ['default', 'tecnico', 'adm'] },
  { id: 'portal',      nome: 'Portal',                desc: 'Solicitar equipamentos',               icon: ShoppingBag,   path: '/portal',          roles: ['default', 'tecnico', 'adm'] },
  { id: 'estoque',     nome: 'Inventário',            desc: 'Cadastro e gestão de ativos',          icon: Activity,      path: '/estoque',         roles: ['tecnico', 'adm'] },
  { id: 'saidas',      nome: 'Registro de Saídas',    desc: 'Registrar novos empréstimos',          icon: ArrowUpRight,  path: '/saidas',          roles: ['tecnico', 'adm'] },
  { id: 'entradas',    nome: 'Devoluções',            desc: 'Gerenciar devoluções ativas',          icon: ArrowDownLeft, path: '/entradas',        roles: ['tecnico', 'adm'] },
  { id: 'calendario',  nome: 'Calendário',            desc: 'Agendamentos de equipamentos',         icon: CalendarDays,  path: '/calendario',      roles: ['tecnico', 'adm'] },
  { id: 'chamados',    nome: 'Chamados',              desc: 'Helpdesk e suporte técnico',           icon: LayoutGrid,    path: '/chamados_externos', roles: ['tecnico', 'adm'] },
  { id: 'impressoras', nome: 'Impressoras',           desc: 'Gestão de impressoras e toners',       icon: Printer,       path: '/impressoras',     roles: ['tecnico', 'adm'] },
  { id: 'bot',         nome: 'Conhecimento',          desc: 'Pesquisar soluções e documentação',    icon: MessageSquare, path: '/bot_conhecimento', roles: ['tecnico', 'adm'] },
  { id: 'documentos',  nome: 'Documentos',            desc: 'Arquivo de termos e PDFs',             icon: FileText,      path: '/documentos',      roles: ['tecnico', 'adm'] },
  { id: 'relatorios',  nome: 'Relatórios',            desc: 'Inteligência e exportação de dados',   icon: ListChecks,    path: '/relatorios',      roles: ['tecnico', 'adm'] },
  { id: 'sessoes',     nome: 'Sessões',               desc: 'Acesso remoto e sessões ativas',       icon: ScreenShare,   path: '/sessoes',         roles: ['tecnico', 'adm'] },
];

function resolveRole(tipoUsuario) {
  if (['adm', 'admin'].includes(tipoUsuario)) return 'adm';
  if (['tecnico', 'agente'].includes(tipoUsuario)) return 'tecnico';
  return 'default';
}

export default function Login() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const tema = localStorage.getItem('tema_tilend');
    return tema ? tema === 'escuro' : true;
  });
  const [viewMode, setViewMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loggedInUser, setLoggedInUser] = useState(null);

  const [username, setUsername] = useState('');
  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [setor, setSetor] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tema_tilend', 'escuro');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tema_tilend', 'claro');
    }
  }, [isDarkMode]);

  const toggleMode = (mode) => {
    setViewMode(mode);
    setErro('');
    setSucesso('');
    setPassword('');
    setConfirmPassword('');
  };

  const enterLauncher = (userId, tipoUsuario, nomeUsuario) => {
    localStorage.setItem('tilend_user_id', userId);
    setLoggedInUser({ id: userId, tipo_usuario: tipoUsuario, nome: nomeUsuario });
    setViewMode('launcher');
  };

  const openApp = (path) => {
    const url = SHELL_URL + path;
    const sep = url.includes('?') ? '&' : '?';
    window.location.href = `${url}${sep}tilend_uid=${loggedInUser.id}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    const userToLogin = username.trim().toLowerCase();
    const pinToLogin = password.trim();

    try {
      const { data: perfil } = await supabase
        .from('perfil')
        .select('*')
        .or(`username.eq."${userToLogin}",email.eq."${userToLogin}"`)
        .eq('pin', pinToLogin)
        .single();

      if (perfil) {
        enterLauncher(perfil.id, perfil.tipo_usuario, perfil.username);
        return;
      }

      const glpiUser = await loginGLPI(userToLogin, pinToLogin);
      if (glpiUser) {
        localStorage.setItem('tilend_glpi_session', glpiUser.sessionToken);
        enterLauncher(glpiUser.id, glpiUser.tipo_usuario || 'tecnico', glpiUser.name || userToLogin);
        return;
      }

      setErro('Credenciais incorretas (PIN legado ou Senha GLPI inválida).');
    } catch (err) {
      setErro('Erro na comunicação com os servidores.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErro('Cadastro não disponível. Entre em contato com a equipe de TI.');
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setErro('Recuperação de senha não disponível para o modo PIN. Entre em contato com a TI.');
  };

  const inputClass = `w-full bg-[var(--bg-soft)] dark:bg-[var(--bg-card)]/5 ring-inset focus:ring-2 text-slate-900 dark:text-white px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-[#404040] text-sm [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:[-webkit-text-fill-color:black] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[transition:background-color_5000s_ease-in-out_0s]`;
  const labelClass = 'block text-[10px] font-bold uppercase text-slate-500 dark:text-[#A0A0A0] tracking-widest mb-1';
  const grad = 'linear-gradient(to bottom right, #254E70, #8D3046)';

  if (viewMode === 'launcher' && loggedInUser) {
    const role = resolveRole(loggedInUser.tipo_usuario);
    const appsPermitidos = APPS.filter(app => app.roles.includes(role));

    return (
      <div className="min-h-screen bg-[var(--bg-page)] font-sans transition-colors duration-300 animate-in fade-in duration-700">
        <div className="max-w-6xl mx-auto px-8 py-12">
          <div className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-900 dark:bg-white flex items-center justify-center rounded-sm">
                <span className="text-white dark:text-black font-black text-[10px] italic">TI</span>
              </div>
              <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white">TI LEND.</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                onClick={() => { localStorage.removeItem('tilend_user_id'); setViewMode('login'); setLoggedInUser(null); }}
                className="flex items-center gap-2 text-[9px] text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white font-bold uppercase tracking-widest transition-colors"
              >
                <LogOut size={14} /> Sair
              </button>
            </div>
          </div>

          <div className="mb-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-[#606060] mb-3">Bem-vindo de volta</p>
            <h2 className="text-5xl md:text-6xl font-light tracking-tight text-slate-900 dark:text-white capitalize">{loggedInUser.nome}</h2>
            <p className="text-sm text-slate-500 dark:text-[#606060] mt-3 font-medium">Selecione o módulo que deseja acessar.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {appsPermitidos.map(app => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  onClick={() => openApp(app.path)}
                  className="group flex flex-col items-start p-5 bg-[var(--bg-card)] rounded-2xl border border-slate-100 dark:border-white/5 hover:border-[#254E70]/30 hover:shadow-lg hover:shadow-[#254E70]/5 transition-all duration-300 text-left"
                >
                  <div className="p-2.5 bg-[#254E70]/10 dark:bg-[#254E70]/20 rounded-xl mb-4 group-hover:bg-[#254E70]/20 dark:group-hover:bg-[#254E70]/30 transition-colors">
                    <Icon size={18} className="text-[#254E70]" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight mb-1">{app.nome}</span>
                  <span className="text-[10px] text-slate-500 dark:text-[#606060] leading-snug">{app.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] grid grid-cols-1 lg:grid-cols-2 animate-in fade-in duration-700 font-sans transition-colors duration-300">

      <div className="relative p-10 md:p-16 lg:p-24 flex flex-col justify-center">
        <div className="absolute top-10 left-10 md:left-16 lg:left-24 flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 dark:bg-white flex items-center justify-center rounded-sm transition-colors duration-300">
            <span className="text-white dark:text-black font-black text-[10px] italic">TI</span>
          </div>
          <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white transition-colors duration-300">TI LEND.</h1>
        </div>

        <div className="absolute top-10 right-10 md:right-16 lg:right-24">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="w-full max-w-2xl mx-auto mt-10">
          {loading && (
            <div className="absolute top-0 left-0 h-1 animate-pulse w-full bg-[#254E70]" />
          )}

          {viewMode === 'forgot' && (
            <button
              onClick={() => toggleMode('login')}
              className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white font-bold uppercase tracking-widest mb-12 transition-all"
            >
              <ArrowLeft size={14} /> Voltar ao Login
            </button>
          )}

          <div className="mb-16">
            <h2 className="text-slate-900 dark:text-white text-5xl md:text-6xl font-light tracking-tight transition-colors duration-300">
              {viewMode === 'login' ? 'Login' : viewMode === 'register' ? 'Criar Conta' : 'Recuperar'}
            </h2>
          </div>

          {erro && (
            <div className="flex items-center gap-2.5 p-4 bg-red-50 dark:bg-red-500/10 border-l-2 border-red-500 text-red-600 dark:text-red-400 text-xs font-semibold mb-8 animate-in fade-in">
              <ShieldAlert size={16} /><span>{erro}</span>
            </div>
          )}
          {sucesso && (
            <div className="flex items-center gap-2.5 p-4 bg-emerald-50 dark:bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-8 animate-in fade-in">
              <CheckCircle2 size={16} /><span>{sucesso}</span>
            </div>
          )}

          <form
            onSubmit={viewMode === 'register' ? handleRegister : viewMode === 'forgot' ? handleForgotPassword : handleLogin}
            className="relative"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              {viewMode === 'login' && (
                <>
                  <div>
                    <label className={labelClass}>Usuário ou E-mail</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      placeholder="seu.nome"
                      className={inputClass}
                    />
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => toggleMode('register')}
                        className="text-[9px] text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white font-bold uppercase tracking-widest transition-colors"
                      >
                        Criar Conta
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Senha</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className={inputClass}
                    />
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => toggleMode('forgot')}
                        className="text-[9px] text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white font-bold uppercase tracking-widest transition-colors"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                  </div>
                </>
              )}

              {viewMode === 'register' && (
                <>
                  <div>
                    <label className={labelClass}>Nome Completo</label>
                    <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Nome e Sobrenome" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Nome de Usuário</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="seu.login" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Setor / Área</label>
                    <input type="text" value={setor} onChange={(e) => setSetor(e.target.value)} required placeholder="Ex: Recepção" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>E-mail Corporativo</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@empresa.com" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Senha</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Confirmar Senha</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" className={inputClass} />
                  </div>
                  <div className="md:col-span-2 mt-[-10px] flex justify-end">
                    <button
                      type="button"
                      onClick={() => toggleMode('login')}
                      className="text-[9px] text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white font-bold uppercase tracking-widest transition-colors"
                    >
                      Já tenho uma conta
                    </button>
                  </div>
                </>
              )}

              {viewMode === 'forgot' && (
                <div className="md:col-span-2 max-w-sm">
                  <label className={labelClass}>E-mail cadastrado</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@empresa.com" className={inputClass} />
                </div>
              )}
            </div>

            <div className="flex justify-end mt-20">
              <button
                type="submit"
                disabled={loading}
                className="w-24 h-24 bg-slate-900 text-white dark:bg-white dark:text-black rounded-full font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center hover:scale-105 transition-all shadow-xl disabled:opacity-50"
              >
                {loading ? '...' : viewMode === 'login' ? 'Entrar' : viewMode === 'register' ? 'Criar' : 'Enviar'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="relative hidden lg:flex items-center justify-center overflow-hidden h-full" style={{ background: grad }}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="w-full max-w-lg space-y-12 relative z-20 p-12 lg:p-24">
          <div className="w-full h-px bg-white/20" />
          <div>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter text-white leading-tight">
              As ferramentas mais poderosas de gestão.
            </h2>
            <p className="text-white/80 text-base mt-6 leading-relaxed font-medium">
              Um ecossistema completo para controle de ativos, com foco em eficiência, rastreabilidade e produtividade.
            </p>
          </div>
          <div className="w-full h-px bg-white/20 pt-10" />
          <div className="text-left">
            <p className="text-[9px] text-white/60 font-bold uppercase tracking-[0.4em]">
              © {new Date().getFullYear()} TI LEND. | OAB CEARÁ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
