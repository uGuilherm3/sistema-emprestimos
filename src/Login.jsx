// src/Login.jsx
import React, { useState, useEffect, useRef } from 'react';
import { api } from './utils/apiClient';
import { loginGLPI } from './utils/glpiClient';
import {
  ShieldAlert, CheckCircle2, ArrowLeft, Sun, Moon, LogOut,
  Home, Calendar, ShoppingBag, Activity, ArrowUpRight, ArrowDownLeft,
  CalendarDays, LayoutGrid, Printer, MessageSquare, FileText, ListChecks,
  Laptop, ScreenShare, ArrowRight
} from 'lucide-react';

// ─── COMPONENTE: PARTÍCULAS MORFÁVEIS (PIXELS NÍTIDOS) ────────────────────────
const MorphingParticlesCanvas = ({ Icon, isDarkMode }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const iconWrapperRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;

    const dpr = window.devicePixelRatio || 1;
    let width = parent.clientWidth;
    let height = parent.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Reduzi levemente a quantidade para dar mais respiro entre os pixels
    const maxParticles = 1200;

    if (particlesRef.current.length === 0) {
      for (let i = 0; i < maxParticles; i++) {
        particlesRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          targetX: Math.random() * width,
          targetY: Math.random() * height,
          // Agora o tamanho é exato: 1px ou 2px, sem tamanhos quebrados
          size: Math.random() > 0.90 ? 2 : 1,
          speed: 0.05 + Math.random() * 0.04,
          phase: Math.random() * Math.PI * 2,
          isSpecial: Math.random() > 0.85
        });
      }
    }

    const rColor = isDarkMode ? 255 : 37;
    const gColor = isDarkMode ? 255 : 78;
    const bColor = isDarkMode ? 255 : 112;

    const svgElement = iconWrapperRef.current?.querySelector('svg');
    if (svgElement) {
      svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgData = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

      const img = new Image();
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = width;
        offCanvas.height = height;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

        offCtx.fillStyle = 'black';
        offCtx.fillRect(0, 0, width, height);

        const iconSize = Math.min(width, height) * 0.55;
        const dx = (width - iconSize) / 2;
        const dy = (height - iconSize) / 2;

        offCtx.drawImage(img, dx, dy, iconSize, iconSize);

        const imgData = offCtx.getImageData(0, 0, width, height).data;
        const targets = [];

        // Pula de 5 em 5 pixels para criar um espaçamento maior (grid mais visível)
        for (let y = 0; y < height; y += 5) {
          for (let x = 0; x < width; x += 5) {
            const index = (y * width + x) * 4;
            const r = imgData[index];

            if (r > 128) {
              targets.push({ x, y });
            }
          }
        }

        targets.sort(() => Math.random() - 0.5);

        particlesRef.current.forEach((p, i) => {
          if (targets.length > 0) {
            const target = targets[i % targets.length];
            // Ruído também em números inteiros para não quebrar o pixel-perfect
            p.targetX = target.x + Math.round((Math.random() - 0.5) * 4);
            p.targetY = target.y + Math.round((Math.random() - 0.5) * 4);
          } else {
            p.targetX = width / 2 + Math.round((Math.random() - 0.5) * 200);
            p.targetY = height / 2 + Math.round((Math.random() - 0.5) * 200);
          }
        });
      };
      img.src = svgData;
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particlesRef.current.forEach(p => {
        p.x += (p.targetX - p.x) * p.speed;
        p.y += (p.targetY - p.y) * p.speed;

        p.phase += 0.04;

        // Opacidade mais "seca" e brilhante, evitando valores muito baixos que causam borrão
        const opacity = p.isSpecial
          ? 0.7 + Math.sin(p.phase) * 0.3
          : 0.3 + Math.sin(p.phase) * 0.4;

        ctx.fillStyle = `rgba(${rColor}, ${gColor}, ${bColor}, ${Math.max(0.1, opacity)})`;

        // A MÁGICA DA NITIDEZ ESTÁ AQUI: Math.round() nas coordenadas e fillRect (quadrado)
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      });

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [Icon, isDarkMode]);

  return (
    <>
      <div ref={iconWrapperRef} style={{ display: 'none' }}>
        <Icon size={256} strokeWidth={3} color="white" />
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
    </>
  );
};


// ─── DEFINIÇÃO DOS MÓDULOS ────────────────────────────────────────────────────
const MODULOS = [
  { id: 'dashboard', nome: 'Dashboard', descricao: 'Métricas e indicadores gerais', icon: Home, rota: '/', roles: ['adm'], main: true },
  { id: 'estoque', nome: 'Empréstimos', descricao: 'Gestão de ativos e empréstimos', icon: Laptop, rota: '/estoque', roles: ['tecnico', 'adm'], main: true },
  { id: 'agenda', nome: 'Agenda', descricao: 'Seus compromissos e tarefas', icon: Calendar, rota: '/agenda', roles: ['default', 'tecnico', 'adm'], main: true },
  { id: 'portal', nome: 'Portal', descricao: 'Solicitar equipamentos', icon: ShoppingBag, rota: '/portal', roles: ['default', 'tecnico', 'adm'], main: true },
  { id: 'chamados', nome: 'Chamados', descricao: 'Helpdesk e suporte técnico', icon: LayoutGrid, rota: '/chamados_externos', roles: ['tecnico', 'adm'], main: true },
  { id: 'impressoras', nome: 'Impressoras', descricao: 'Gestão de impressoras e toners', icon: Printer, rota: '/impressoras', roles: ['tecnico', 'adm'], main: true },
  { id: 'bot', nome: 'Conhecimento', descricao: 'Pesquisar soluções e documentação', icon: MessageSquare, rota: '/bot_conhecimento', roles: ['tecnico', 'adm'], main: true },
  { id: 'documentos', nome: 'Documentos', descricao: 'Arquivo de termos e PDFs', icon: FileText, rota: '/documentos', roles: ['tecnico', 'adm'], main: true },
  { id: 'relatorios', nome: 'Relatórios', descricao: 'Inteligência e exportação de dados', icon: ListChecks, rota: '/relatorios', roles: ['tecnico', 'adm'], main: true },
  { id: 'sessoes', nome: 'Sessões', descricao: 'Acesso remoto e sessões ativas', icon: ScreenShare, rota: '/sessoes', roles: ['tecnico', 'adm'], main: true },

  // SUBPÁGINAS (Não aparecem no launcher, são acessadas pelo menu interno do sistema)
  { id: 'emprestimos', nome: 'Dashboard Empréstimos', descricao: 'Visão geral de empréstimos', icon: Laptop, rota: '/emprestimos', roles: ['adm'], main: false },
  { id: 'saidas', nome: 'Registro de Saídas', descricao: 'Registrar novos empréstimos', icon: ArrowUpRight, rota: '/saidas', roles: ['tecnico', 'adm'], main: false },
  { id: 'entradas', nome: 'Devoluções', descricao: 'Gerenciar devoluções ativas', icon: ArrowDownLeft, rota: '/entradas', roles: ['tecnico', 'adm'], main: false },
  { id: 'calendario', nome: 'Calendário', descricao: 'Agendamentos de equipamentos', icon: CalendarDays, rota: '/calendario', roles: ['tecnico', 'adm'], main: false },
];

function resolverPermissao(tipoUsuario) {
  if (['adm', 'admin'].includes(tipoUsuario)) return 'adm';
  if (['tecnico', 'agente'].includes(tipoUsuario)) return 'tecnico';
  return 'default';
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Login({ onLoginSucesso, isDarkMode, setIsDarkMode }) {

  const [viewMode, setViewMode] = useState('login');
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [userAutenticado, setUserAutenticado] = useState(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [setor, setSetor] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const trocarTela = (tela) => {
    setViewMode(tela);
    setErro('');
    setSucesso('');
    setPassword('');
    setConfirmPassword('');
  };

  const criarUserMock = (dados) => ({
    id: dados.id,
    username: dados.username,
    nome: dados.nome || dados.username,
    setor: dados.setor,
    tipoUsuario: dados.tipo_usuario,
    get: (field) => {
      if (field === 'username') return dados.username;
      if (field === 'nome') return dados.nome || dados.username;
      if (field === 'setor') return dados.setor;
      if (field === 'tipoUsuario') return dados.tipo_usuario;
      return dados[field];
    },
    save: async () => { }
  });

  const entrarLauncher = (userMock) => {
    localStorage.setItem('tilend_user_id', userMock.id);
    setUserAutenticado(userMock);
    setViewMode('launcher');
    setActiveModuleIndex(0);
  };

  const abrirModulo = (rota) => {
    onLoginSucesso(userAutenticado, rota);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');

    const userToLogin = username.trim().toLowerCase();
    const pinToLogin = password.trim();

    try {
      const { data: user } = await api.users.login(userToLogin, pinToLogin);
      if (user) return entrarLauncher(criarUserMock(user));

      const glpiUser = await loginGLPI(userToLogin, pinToLogin);
      if (glpiUser) {
        localStorage.setItem('tilend_glpi_session', glpiUser.sessionToken);
        const userMock = {
          ...glpiUser,
          get: (field) => {
            if (field === 'tipoUsuario') return 'tecnico';
            if (field === 'nome') return glpiUser.username;
            return glpiUser[field];
          },
          save: async () => { }
        };
        return entrarLauncher(userMock);
      }
      setErro('Credenciais incorretas. Verifique seu usuário e PIN.');
    } catch (err) {
      setErro('Erro na comunicação com os servidores.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErro('');
    if (password !== confirmPassword) return setErro('As senhas não coincidem.');
    if (password.trim().length < 4) return setErro('O PIN deve ter no mínimo 4 caracteres.');
    setLoading(true);
    try {
      const { data: existente } = await api.users.checkExists(username.trim().toLowerCase(), email.trim().toLowerCase());
      if (existente) return setErro('Nome de usuário ou e-mail já cadastrado.');
      const { error } = await api.users.insert({ id: crypto.randomUUID(), username: username.trim().toLowerCase(), email: email.trim().toLowerCase(), pin: password.trim(), nome: nome.trim(), setor: setor.trim().toUpperCase(), tipo_usuario: 'default' });
      if (error) throw new Error(error);
      setSucesso('Conta criada! Faça login para continuar.');
      trocarTela('login');
    } catch (err) {
      setErro('Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `w-full bg-[var(--bg-soft)] dark:bg-[var(--bg-card)]/5 ring-inset focus:ring-2 text-slate-900 dark:text-white px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-[#404040] text-sm`;
  const labelClass = 'block text-[10px] font-bold uppercase text-slate-500 dark:text-[#A0A0A0] tracking-widest mb-1';
  const grad = 'linear-gradient(to bottom right, #254E70, #8D3046)';

  const permissao = userAutenticado ? resolverPermissao(userAutenticado.get('tipoUsuario')) : 'default';
  const modulosPermitidos = userAutenticado ? MODULOS.filter(m => m.roles.includes(permissao) && m.main) : [];
  const moduloAtivo = modulosPermitidos[activeModuleIndex];

  // ─── LÓGICA DE SCROLL ────────────────────────────────────────────────────────
  const isScrolling = useRef(false);
  const handleWheel = (e) => {
    if (isScrolling.current || modulosPermitidos.length === 0) return;

    isScrolling.current = true;
    setTimeout(() => { isScrolling.current = false; }, 350);

    if (e.deltaY > 0) {
      setActiveModuleIndex(prev => Math.min(prev + 1, modulosPermitidos.length - 1));
    } else if (e.deltaY < 0) {
      setActiveModuleIndex(prev => Math.max(prev - 1, 0));
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] grid grid-cols-1 lg:grid-cols-2 animate-in fade-in duration-700 font-sans transition-colors duration-300">

      {/* ── Painel Esquerdo: Formulário ou Bem-vindo ── */}
      <div className="relative p-10 md:p-16 lg:p-24 flex flex-col justify-center overflow-y-auto">
        <div className="absolute top-10 left-10 md:left-16 lg:left-24 flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 dark:bg-white flex items-center justify-center rounded-sm transition-colors duration-300">
            <span className="text-white dark:text-black font-black text-[10px] italic">TI</span>
          </div>
          <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white transition-colors duration-300">TI LEND.</h1>
        </div>
        <div className="absolute top-10 right-10 md:right-16 lg:right-24">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {viewMode === 'launcher' && userAutenticado ? (
          <div className="w-full max-w-2xl mx-auto mt-10 animate-in fade-in slide-in-from-left-8 duration-700">
            <div className="mb-12">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-[#606060] mb-3">Bem-vindo de volta</p>
              <h2 className="text-5xl md:text-6xl font-light tracking-tight text-slate-900 dark:text-white capitalize">
                {userAutenticado.get('nome') || userAutenticado.get('username')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-[#606060] mt-3 font-medium">
                Sua sessão foi iniciada com sucesso. Selecione um módulo ao lado para continuar.
              </p>
            </div>
            <button onClick={() => { localStorage.removeItem('tilend_user_id'); setViewMode('login'); setUserAutenticado(null); }} className="flex items-center gap-2 text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold uppercase tracking-widest mt-8">
              <LogOut size={14} /> Sair
            </button>
          </div>
        ) : (
          <div className="w-full max-w-2xl mx-auto mt-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="mb-16"><h2 className="text-slate-900 dark:text-white text-5xl font-light tracking-tight">Login</h2></div>
            {erro && <div className="flex items-center gap-2.5 p-4 bg-red-50 dark:bg-red-500/10 border-l-2 border-red-500 text-red-600 dark:text-red-400 text-xs font-semibold mb-8"><ShieldAlert size={16} /><span>{erro}</span></div>}
            {sucesso && <div className="flex items-center gap-2.5 p-4 bg-emerald-50 dark:bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-8"><CheckCircle2 size={16} /><span>{sucesso}</span></div>}
            <form onSubmit={handleLogin} className="relative">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <div>
                  <label className={labelClass}>Usuário ou E-mail</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Senha / PIN</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} />
                </div>
              </div>
              <div className="flex justify-end mt-20">
                <button type="submit" disabled={loading} className="w-24 h-24 bg-slate-900 text-white dark:bg-white dark:text-black rounded-full font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center hover:scale-105 transition-all shadow-xl">Entrar</button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ── Painel Direito: Onde a Magia do Launcher Acontece ── */}
      <div
        className={`relative ${viewMode === 'launcher' ? 'flex' : 'hidden lg:flex'} h-full transition-all duration-700`}
        style={viewMode === 'launcher' ? { background: 'transparent' } : { background: grad }}
        onWheel={viewMode === 'launcher' ? handleWheel : undefined}
      >
        {viewMode === 'launcher' && moduloAtivo ? (
          <div className="w-full h-full flex flex-row p-0 animate-in fade-in duration-700 bg-[var(--bg-page)] dark:bg-black/20 overflow-hidden select-none">

            {/* Conteúdo Central: Canvas e Info do Módulo */}
            <div className="flex-1 flex flex-col justify-between py-32 px-10 md:px-12 lg:px-24 relative overflow-hidden">

              {/* O CANVAS METAMÓRFICO BASEADO NO ÍCONE DO MÓDULO */}
              <div className="w-full h-[45%] flex justify-center mb-8 mx-auto relative pointer-events-none">
                <MorphingParticlesCanvas
                  Icon={moduloAtivo.icon}
                  isDarkMode={isDarkMode}
                />
              </div>

              {/* INFO DO MÓDULO (Design limpo) */}
              <div className="min-h-[140px] animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-lg w-full relative z-10 mx-auto">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-[#606060] mb-4">
                  Módulo Selecionado
                </p>

                <h3 className="text-4xl md:text-5xl font-light tracking-tight text-slate-900 dark:text-white mb-2">
                  {moduloAtivo.nome}
                </h3>

                <p className="text-sm text-slate-500 dark:text-[#606060] mt-3 font-medium">
                  {moduloAtivo.descricao}
                </p>

                <div className="mt-8">
                  <button
                    onClick={() => abrirModulo(moduloAtivo.rota)}
                    className="flex w-max items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-white hover:opacity-70 transition-opacity"
                  >
                    Acessar <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* ÍCONE DE SCROLL CENTRALIZADO NO RODAPÉ */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-30 pointer-events-none z-20 flex flex-col items-center gap-1">
              <div className="w-4 h-6 border-[1.5px] border-slate-400 dark:border-[#606060] rounded-full flex justify-center p-0.5">
                <div className="w-1 h-1.5 bg-slate-400 dark:bg-[#606060] rounded-full animate-bounce mt-0.5" />
              </div>
            </div>

            {/* BARRA LATERAL MINIMALISTA (Indicadores de Scroll) */}
            <div className="w-16 shrink-0 flex flex-col items-center justify-center py-10 z-10 relative">
              <div className="flex flex-col gap-3">
                {modulosPermitidos.map((modulo, index) => {
                  const isActive = index === activeModuleIndex;
                  return (
                    <button
                      key={modulo.id}
                      onClick={() => setActiveModuleIndex(index)}
                      className={`transition-all duration-500 ${isActive
                        ? 'h-10 w-[6px] bg-slate-900 dark:bg-white shadow-[0_0_10px_rgba(0,0,0,0.1)] dark:shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                        : 'h-2 w-[4px] bg-slate-300 dark:bg-white/20 hover:bg-slate-400 dark:hover:bg-white/40 cursor-pointer'
                        }`}
                      aria-label={`Selecionar módulo ${modulo.nome}`}
                    />
                  );
                })}
              </div>
            </div>

          </div>
        ) : (
          <div className="w-full h-full relative flex items-center justify-center animate-in fade-in duration-1000" />
        )}
      </div>

    </div>
  );
}