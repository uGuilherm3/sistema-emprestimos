// src/App.jsx
// Componente raiz do sistema TI Lend.
// Controla: autenticação, layout da sidebar, roteamento entre módulos e tema claro/escuro.
import { useState, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from './utils/apiClient';
import {
  Home, Activity, CalendarDays, FileText, Settings,
  Search, Bell, LogOut,
  ArrowUpRight, ArrowDownLeft, X, Trash2,
  Menu, Sun, Moon, Globe, AlertTriangle, ArrowRight, ArrowLeft, CheckCircle2, ListChecks, LayoutGrid, Printer, MessageSquare, Calendar, Laptop, ShoppingBag, FilePenLine, Wrench
} from 'lucide-react';
import DashboardMetricas from './DashboardMetricas';
import CadastroItem from './CadastroItem';
import GestaoEstoqueList from './GestaoEstoqueList';
import NovoEmprestimo from './NovoEmprestimo';
import ListaEmprestimosAtivos from './ListaEmprestimosAtivos';
import EditarPerfil from './EditarPerfil';
import CalendarioAgendamentos from './CalendarioAgendamentos';
import PortalSolicitante from './PortalSolicitante';
import RelatoriosExportacao from './RelatoriosExportacao';
import ChamadosAdmin from './ChamadosAdmin';
import PrintersAdmin from './PrintersAdmin';
import DetalhesGerencial from './DetalhesGerencial';
import KnowledgeBot from './KnowledgeBot';
import ChatBotIA from './components/ChatBotIA';
import AgendaEstiloGoogle from './AgendaEstiloGoogle';
import DashboardEmprestimos from './DashboardEmprestimos';
import Manutencoes from './Manutencoes';
import Login from './Login'; // Tela de login + launcher de módulos
import LogoImg from './assets/logo.jpg';


const levenshtein = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
};

// Módulos exibidos na tela de seleção (launcher) após o login.
// roles define quais tipos de usuário podem ver cada módulo.
const LAUNCHER_MODULOS = [
  { id: 'dashboard', nome: 'Dashboard', icon: Home, rota: '/', roles: ['adm'] },
  { id: 'agenda', nome: 'Agenda', icon: Calendar, rota: '/agenda', roles: ['default', 'tecnico', 'adm'] },
  { id: 'estoque', nome: 'Empréstimos', icon: Laptop, rota: '/estoque', roles: ['tecnico', 'adm'] },
  { id: 'portal', nome: 'Portal', icon: ShoppingBag, rota: '/portal', roles: ['default', 'tecnico', 'adm'] },
  { id: 'chamados_externos', nome: 'Chamados', icon: LayoutGrid, rota: '/chamados_externos', roles: ['tecnico', 'adm'] },
  { id: 'impressoras', nome: 'Ativos', icon: Printer, rota: '/impressoras', roles: ['tecnico', 'adm'] },
  { id: 'manutencoes', nome: 'Manutenções', icon: Wrench, rota: '/manutencoes', roles: ['tecnico', 'adm'] },
  { id: 'relatorios', nome: 'Relatórios', icon: FileText, rota: '/relatorios', roles: ['adm'] },
];

// Converte tipo_usuario do banco para o role simplificado usado no launcher e permissões.
const tipoParaRole = (tipo) => {
  if (['adm', 'admin'].includes(tipo)) return 'adm';
  if (['tecnico', 'agente'].includes(tipo)) return 'tecnico';
  return 'default';
};

const PERMISSIONS = {
  default: new Set(['agenda', 'portal', 'perfil', 'chamados_externos']),
  solicitante: new Set(['agenda', 'portal', 'perfil', 'chamados_externos']),
  tecnico: new Set(['agenda', 'estoque', 'saidas', 'entradas', 'calendario', 'chamados_externos', 'impressoras', 'bot_conhecimento', 'relatorios', 'portal', 'detalhes', 'perfil', 'manutencoes']),
};

const FIRST_ALLOWED_ROUTE = {
  default: '/agenda',
  solicitante: '/agenda',
  tecnico: '/agenda',
};

const rotasGlobais = [
  { id: 'dashboard', nome: 'Dashboard', icon: Home, keywords: ['home', 'inicio', 'painel', 'metricas', 'resumo'] },
  { id: 'agenda', nome: 'Minha Agenda', icon: Calendar, keywords: ['agenda', 'compromissos', 'google', 'calendario', 'atividades', 'eventos'] },
  { id: 'estoque', nome: 'Inventário Global', icon: Activity, keywords: ['estoque', 'produtos', 'ativos', 'cadastro', 'lista', 'adicionar'] },
  { id: 'saidas', nome: 'Registro de Saídas', icon: FilePenLine, keywords: ['saida', 'saídas', 'emprestimo', 'emprestar', 'retirada', 'checkout', 'novo'] },
  { id: 'entradas', nome: 'Gestão de Devoluções', icon: ArrowDownLeft, keywords: ['entrada', 'entradas', 'devolucao', 'devolucoes', 'receber', 'retorno'] },
  { id: 'localizacoes', nome: 'Localização por Setor', icon: Globe, keywords: ['setor', 'localizacao', 'onde está', 'posse', 'ativos por área'] },
  { id: 'calendario', nome: 'Calendários de Agendamento', icon: CalendarDays, keywords: ['agenda', 'agendamento', 'reserva', 'datas'] },
  { id: 'chamados_externos', nome: 'Chamados', icon: LayoutGrid, keywords: ['chamado', 'externo', 'ajuda', 'suporte', 'helpdesk', 'web', 'tickets'] },
  { id: 'impressoras', nome: 'Ativos', icon: Printer, keywords: ['impressora', 'toner', 'impressao', 'papel', 'manutencao'] },
  { id: 'bot_conhecimento', nome: 'Bot de Conhecimento', icon: MessageSquare, keywords: ['bot', 'ia', 'ajuda', 'pesquisa', 'conhecimento', 'perguntas', 'pergunta', 'experimental'] },
  { id: 'relatorios', nome: 'Inteligência e Relatórios', icon: FileText, keywords: ['relatorio', 'exportar', 'csv', 'dados', 'tudo', 'transacoes passadas', 'excel', 'exportação'] },
  { id: 'manutencoes', nome: 'Manutenções', icon: Wrench, keywords: ['manutencao', 'reparo', 'conserto', 'limpeza', 'preventiva'] },
  { id: 'portal', nome: 'Portal do Solicitante', icon: ShoppingBag, keywords: ['portal', 'solicitante', 'público', 'loja', 'pedir', 'comprar', 'reserva'] },
  { id: 'perfil', nome: 'Configurações de Conta', icon: Settings, keywords: ['perfil', 'conta', 'senha', 'ajustes', 'sair', 'foto', 'username'] },
  { id: 'dashboard#historico-dashboard', nome: 'Histórico de Transações (Dashboard)', icon: ListChecks, keywords: ['historico', 'transacoes', 'auditoria', 'quem pegou', 'quem devolveu', 'entradas e saídas', 'timeline', 'lista de emprestimos'] }
];

// ── Mini gráfico de anel (SVG) ────────────────────────────────
const MiniRing = ({ pct = 65, label, color = '#254E70' }) => {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center justify-center h-full gap-1.5">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${(pct / 100) * c} ${c}`} strokeLinecap="round"
          transform="rotate(-90 28 28)" style={{ transition: 'stroke-dasharray 0.9s ease' }} />
        <text x="28" y="33" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10" fontWeight="600">{pct}%</text>
      </svg>
      <span className="text-[8px] text-slate-500 dark:text-[#505050] uppercase tracking-widest">{label}</span>
    </div>
  );
};

// ── Mini gráfico de barras horizontais ────────────────────────
const MiniBars = ({ bars = [], label }) => (
  <div className="flex flex-col justify-center h-full gap-2 px-3 py-2">
    {bars.map((b, i) => (
      <div key={i} className="flex items-center gap-2">
        <span className="text-[8px] text-slate-400 dark:text-[#606060] w-14 shrink-0 truncate">{b.label}</span>
        <div className="flex-1 h-[3px] bg-white/5 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: b.color || '#254E70', transition: 'width 0.9s ease' }} />
        </div>
      </div>
    ))}
    {label && <span className="text-[8px] text-slate-500 dark:text-[#505050] text-center mt-1">{label}</span>}
  </div>
);

// ── Cards de preview por módulo ───────────────────────────────
const PREVIEW_CARD_BASE = 'bg-[var(--bg-card)] rounded-2xl h-full overflow-hidden';


const LgCard = ({ titulo, desc, icone: Icon }) => (
  <div className={`${PREVIEW_CARD_BASE} relative overflow-hidden flex flex-col justify-end p-12 text-left`}>
    {Icon && (
      <Icon 
        className={`absolute -top-28 -right-28 w-80 h-80 opacity-10 dark:opacity-[0.03] pointer-events-none text-white ${titulo === 'Manutenções' ? 'rotate-[168deg]' : '-rotate-12'}`} 
        strokeWidth={1}
      />
    )}
    <p className="text-[14px] font-medium tracking-widest text-slate-500 dark:text-[#505050]">Módulo selecionado</p>
    <h3 className="text-4xl font-light text-white mb-6 leading-snug">{titulo}</h3>
    <p className="text-base text-slate-400 dark:text-[#606060] leading-relaxed max-w-xl">{desc}</p>
  </div>
);

const MdCard = ({ children }) => <div className={PREVIEW_CARD_BASE}>{children}</div>;

const SmCard = ({ label, val }) => (
  <div className={`${PREVIEW_CARD_BASE} flex flex-col items-center justify-center p-8`}>
    <span className="text-6xl font-light text-white leading-none">{val}</span>
    <span className="text-[14px] text-slate-500 dark:text-[#505050] uppercase tracking-wider mt-5 text-center leading-tight">{label}</span>
  </div>
);

const ModuloPreviewCards = ({ moduleId, itens = [], notificacoes = [] }) => {
  const modInfo = LAUNCHER_MODULOS.find(m => m.id === moduleId);
  const IconeModulo = modInfo?.icon;

  const total = itens.length;
  const disp = itens.filter(i => (i.quantidade_disponivel || 0) > 0).length;
  const atraso = notificacoes.filter(n => n.tipo === 'atraso').length;
  const dispPct = Math.round(disp / Math.max(1, total) * 100);

  const cfg = {
    dashboard: {
      layout: 'A',
      large: { titulo: 'Dashboard', desc: 'Métricas executivas de empréstimos, devoluções, agenda e auditoria em tempo real.' },
      medium: <MiniRing pct={dispPct} label="Disponibilidade" color="#10b981" />,
      s1: { label: 'Itens Cadastrados', val: total },
      s2: { label: 'Em Atraso', val: atraso || '0' },
    },
    agenda: {
      layout: 'B',
      large: { titulo: 'Agenda', desc: 'Organize compromissos, tarefas e lembretes com visualização estilo Google Calendar.' },
      medium: (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <span className="text-6xl font-light text-white leading-none">12</span>
          <span className="text-[14px] text-slate-500 dark:text-[#505050] uppercase tracking-wider mt-5 text-center leading-tight">Eventos na Semana</span>
        </div>
      ),
      s1: { label: 'Mês', val: new Date().toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase() },
      s2: { label: 'Hoje', val: new Date().toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase() },
    },
    estoque: {
      layout: 'C',
      large: { titulo: 'Empréstimos', desc: 'Registre saídas e devoluções, controle estoque e monitore empréstimos em aberto.' },
      medium: <MiniBars label="Distribuição do estoque" bars={[
        { label: 'Disponível', pct: dispPct, color: '#10b981' },
        { label: 'Em uso', pct: 100 - dispPct, color: '#f59e0b' },
        { label: 'Em atraso', pct: Math.min(100, atraso * 12), color: '#ef4444' },
      ]} />,
      s1: { label: 'Total Itens', val: total },
      s2: { label: 'Disponíveis', val: disp },
    },
    chamados_externos: {
      layout: 'D',
      large: { titulo: 'Chamados', desc: 'Central integrada de suporte TI — abra, acompanhe e resolva chamados por protocolo.' },
      medium: <MiniRing pct={65} label="Resolvidos" color="#3b82f6" />,
      s1: { label: 'Novos', val: notificacoes.filter(n => n.tipo === 'chamado_novo').length || '—' },
      s2: { label: 'Atualizados', val: notificacoes.filter(n => n.tipo === 'chamado_status').length || '—' },
    },
    impressoras: {
      layout: 'A',
      large: { titulo: 'Ativos', desc: 'Monitor de impressoras em tempo real — status online/offline, toner e histórico de impressões.' },
      medium: <MiniBars label="Nível de toner" bars={[
        { label: 'Crítico', pct: 15, color: '#ef4444' },
        { label: 'Normal', pct: 62, color: '#f59e0b' },
        { label: 'Cheio', pct: 88, color: '#10b981' },
      ]} />,
      s1: { label: 'Monitoradas', val: '16' },
      s2: { label: 'Online', val: '14' },
    },
    manutencoes: {
      layout: 'B',
      large: { titulo: 'Manutenções', desc: 'Registre ordens de serviço preventivas e corretivas com histórico completo de intervenções.' },
      medium: <MiniRing pct={42} label="Em andamento" color="#f59e0b" />,
      s1: { label: 'Abertas', val: '—' },
      s2: { label: 'Concluídas', val: '—' },
    },
    relatorios: {
      layout: 'C',
      large: { titulo: 'Relatórios', desc: 'Exporte dados em CSV/Excel com filtros avançados de período, categoria e tipo.' },
      medium: <MiniBars label="Categorias exportadas" bars={[
        { label: 'Empréstimos', pct: 80, color: '#254E70' },
        { label: 'Devoluções', pct: 55, color: '#8D3046' },
        { label: 'Auditoria', pct: 35, color: '#64748b' },
      ]} />,
      s1: { label: 'Total Itens', val: total },
      s2: { label: 'Alertas', val: notificacoes.length },
    },
    portal: {
      layout: 'D',
      large: { titulo: 'Portal', desc: 'Espaço público para colaboradores solicitarem empréstimos de equipamentos com aprovação em tempo real.' },
      medium: <MiniRing pct={dispPct} label="Disponível" color="#10b981" />,
      s1: { label: 'Disponíveis', val: disp },
      s2: { label: 'Categorias', val: [...new Set(itens.map(i => i.categoria).filter(Boolean))].length || '—' },
    },
  }[moduleId];

  if (!cfg) return null;

  const G = 12;
  const H = '64vh'; // Altura aumentada para preencher mais espaço
  const Sq = `calc((${H} - ${G}px) / 2)`;
  const ColW = `calc(${Sq} * 2 + ${G}px)`;

  const layouts = {
    // Large esquerda (flex), medium + smalls direita (fixo baseado em Sq)
    A: (
      <div style={{ display: 'grid', gridTemplateColumns: `1fr ${ColW}`, gridTemplateRows: '1fr 1fr', gap: G, height: H }}>
        <div style={{ gridRow: '1/3' }}><LgCard {...cfg.large} icone={IconeModulo} /></div>
        <MdCard>{cfg.medium}</MdCard>
        <div style={{ display: 'grid', gridTemplateColumns: `${Sq} ${Sq}`, gap: G }}>
          <SmCard {...cfg.s1} /><SmCard {...cfg.s2} />
        </div>
      </div>
    ),
    // Large topo (100%), medium + smalls embaixo (3 quadrados)
    B: (
      <div className="mx-auto" style={{ maxWidth: `calc(${Sq} * 3 + ${G}px * 2)` }}>
        <div style={{ display: 'grid', gridTemplateRows: '1.3fr 1fr', gap: G, height: H }}>
          <LgCard {...cfg.large} icone={IconeModulo} />
          <div style={{ display: 'grid', gridTemplateColumns: `${Sq} ${Sq} ${Sq}`, gap: G }}>
            <MdCard>{cfg.medium}</MdCard>
            <SmCard {...cfg.s1} /><SmCard {...cfg.s2} />
          </div>
        </div>
      </div>
    ),
    // Medium + smalls esquerda, Large direita
    C: (
      <div style={{ display: 'grid', gridTemplateColumns: `${ColW} 1fr`, gridTemplateRows: '1fr 1fr', gap: G, height: H }}>
        <MdCard>{cfg.medium}</MdCard>
        <div style={{ gridColumn: '2', gridRow: '1/3' }}><LgCard {...cfg.large} icone={IconeModulo} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: `${Sq} ${Sq}`, gap: G }}>
          <SmCard {...cfg.s1} /><SmCard {...cfg.s2} />
        </div>
      </div>
    ),
    // Medium esquerda alta, smalls centro-topo, Large direita baixo
    D: (
      <div style={{ display: 'grid', gridTemplateColumns: `${Sq} ${Sq} 1fr`, gridTemplateRows: '1fr 1fr', gap: G, height: H }}>
        <div style={{ gridRow: '1/3' }}><MdCard>{cfg.medium}</MdCard></div>
        <SmCard {...cfg.s1} /><SmCard {...cfg.s2} />
        <div style={{ gridColumn: '2/4' }}><LgCard {...cfg.large} icone={IconeModulo} /></div>
      </div>
    ),
  };

  return (
    <div key={moduleId} className="w-full max-w-7xl mx-auto">
      {layouts[cfg.layout]}
    </div>
  );
};

export default function App() {
  // usuarioAtual: objeto do usuário logado (null = ninguém logado)
  const [usuarioAtual, setUsuarioAtual] = useState(null);

  // isLoadingAuth: true enquanto verifica se há sessão salva no localStorage.
  // Evita piscar a tela de login antes de terminar a verificação.
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // showLauncher: true logo após o login — exibe a tela de seleção de módulo
  // antes de entrar no sistema. Volta a false quando o usuário escolhe um módulo.
  const [showLauncher, setShowLauncher] = useState(false);
  const [animandoLauncher, setAnimandoLauncher] = useState(false);
  const [moduloPreview, setModuloPreview] = useState(null);
  const [prevModuloIndex, setPrevModuloIndex] = useState(-1);
  const [slideDirection, setSlideDirection] = useState(0);

  // Lógica para determinar a direção do slide baseado na posição dos ícones
  const handleSetModuloPreview = (newId) => {
    if (newId === moduloPreview) return;
    
    if (newId) {
      const newIndex = LAUNCHER_MODULOS.findIndex(m => m.id === newId);
      if (prevModuloIndex !== -1) {
        setSlideDirection(newIndex > prevModuloIndex ? 1 : -1);
      } else {
        setSlideDirection(0);
      }
      setPrevModuloIndex(newIndex);
    } else {
      setPrevModuloIndex(-1);
      setSlideDirection(0);
    }
    setModuloPreview(newId);
  };

  const slideVariants = {
    initial: (direction) => ({
      x: direction > 0 ? 30 : (direction < 0 ? -30 : 0),
      y: 15,
      opacity: 0,
      scale: 0.98
    }),
    animate: {
      x: 0,
      y: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction) => ({
      x: direction > 0 ? -30 : (direction < 0 ? 30 : 0),
      opacity: 0,
      scale: 0.98,
      transition: { duration: 0.2 }
    })
  };
  const [dockMouseX, setDockMouseX] = useState(null);
  const dockRef = useRef(null);

  const [abaPortal, setAbaPortal] = useState('catalogo');
  const location = useLocation();
  const navigate = useNavigate();

  const abaAtiva = useMemo(() => {
    const path = location.pathname.replace(/^\/|\/$/g, '');
    if (!path) return 'dashboard';
    // Se for um protocolo (ex: 2024/001, 2026/0001IS, 2024-CH001, 2026-4990 ou 2026E0001)
    if (/^\d{4}\/\d{3,4}[a-zA-Z]*$/i.test(path) || /^\d{4}-CH\d+$/.test(path) || /^\d{4}-\d+$/.test(path) || /^\d{4}[A-Z]\d+$/i.test(path)) return 'detalhes';
    if (path === 'detalhes') return 'detalhes';
    return path;
  }, [location.pathname]);

  const spotifyRef = useRef(null);
  const menuPerfilRef = useRef(null);
  const [itemDetalhado, setItemDetalhado] = useState(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [triggerAtualizacao, setTriggerAtualizacao] = useState(0);

  const [isSidebarOpen] = useState(false);
  const [isGestaoOpen] = useState(() => {
    const salvo = localStorage.getItem('tilend_gestao_open');
    return salvo !== null ? JSON.parse(salvo) : true;
  });
  const [menuPerfilPopoverAberto, setMenuPerfilPopoverAberto] = useState(false);

  const [notificacoesAberto, setNotificacoesAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);

  const [idsExcluidos, setIdsExcluidos] = useState(() => {
    const salvos = localStorage.getItem('tilend_ids_excluidos');
    return salvos ? JSON.parse(salvos) : [];
  });

  const [seenNotifIds, setSeenNotifIds] = useState(() => {
    const salvos = localStorage.getItem('tilend_seen_notif_ids');
    return salvos ? JSON.parse(salvos) : [];
  });

  useEffect(() => { localStorage.setItem('tilend_ids_excluidos', JSON.stringify(idsExcluidos)); }, [idsExcluidos]);
  useEffect(() => { localStorage.setItem('tilend_sidebar_open', JSON.stringify(isSidebarOpen)); }, [isSidebarOpen]);
  useEffect(() => { localStorage.setItem('tilend_gestao_open', JSON.stringify(isGestaoOpen)); }, [isGestaoOpen]);

  const [itens, setItens] = useState([]);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchSuggestion, setSearchSuggestion] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [spotifyAberto, setSpotifyAberto] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState(localStorage.getItem('spotify_access_token'));
  const [musicaAtual, setMusicaAtual] = useState(null);

  // FECHAR SPOTIFY AO CLICAR FORA (ROBUSTO)
  useEffect(() => {
    function handleClickOutside(event) {
      if (spotifyRef.current && !spotifyRef.current.contains(event.target)) {
        setSpotifyAberto(false);
      }
    }
    if (spotifyAberto) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [spotifyAberto]);

  // FECHAR MENU PERFIL AO CLICAR FORA
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuPerfilRef.current && !menuPerfilRef.current.contains(event.target)) {
        setMenuPerfilPopoverAberto(false);
      }
    }
    if (menuPerfilPopoverAberto) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuPerfilPopoverAberto]);

  // Tenta renovar token ao carregar se estiver sem access_token mas com refresh_token
  useEffect(() => {
    if (!spotifyToken && localStorage.getItem('spotify_refresh_token')) {
      refreshSpotifyToken();
    }
    if (!spotifyToken) {
      setSpotifyAberto(false);
    }
  }, [spotifyToken]);

  const SPOTIFY_CLIENT_ID = 'c754606c4d0147958e6a3fde0e007bf0';

  // Forçamos o link exatamente como está no seu Dashboard para evitar qualquer erro de detecção
  // URI de callback do Spotify — deve estar cadastrada exatamente igual no Spotify Developer Dashboard
  const REDIRECT_URI = `${window.location.origin}/sistemas/`;

  useEffect(() => {
    console.log("%c[Spotify Config]", "color: #1DB954; font-weight: bold; font-size: 14px;");
    console.log("URI Enviada:", REDIRECT_URI);
    console.log("Client ID:", SPOTIFY_CLIENT_ID);
  }, []);

  const SPOTIFY_SCOPES = ['user-read-currently-playing', 'user-read-playback-state', 'user-modify-playback-state'];

  // PKCE HELPERS
  const generateRandomString = (length) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = window.crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  }

  const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);

    // Se o browser permitir, usa o nativo (mais rápido)
    if (window.crypto && window.crypto.subtle) {
      return window.crypto.subtle.digest('SHA-256', data);
    }

    // Fallback: SHA-256 manual em JS puro (para IP local sem HTTPS)
    const rotateRight = (n, m) => (n >>> m) | (n << (32 - m));
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    let bits = data.length * 8;
    let p = new Uint8Array(data.length + 1 + 8 + (63 - (data.length + 8) % 64));
    p.set(data); p[data.length] = 0x80;
    for (let i = 0; i < 8; i++) p[p.length - 1 - i] = (bits >>> (i * 8)) & 0xff;
    for (let i = 0; i < p.length; i += 64) {
      let w = new Uint32Array(64);
      for (let j = 0; j < 16; j++) w[j] = (p[i + j * 4] << 24) | (p[i + j * 4 + 1] << 16) | (p[i + j * 4 + 2] << 8) | p[i + j * 4 + 3];
      for (let j = 16; j < 64; j++) {
        let s0 = rotateRight(w[j - 15], 7) ^ rotateRight(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        let s1 = rotateRight(w[j - 2], 17) ^ rotateRight(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let j = 0; j < 64; j++) {
        let S1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        let ch = (e & f) ^ ((~e) & g);
        let t1 = (hh + S1 + ch + k[j] + w[j]) | 0;
        let S0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    const res = new Uint8Array(32);
    for (let i = 0; i < 8; i++) { res[i * 4] = (h[i] >>> 24) & 0xff; res[i * 4 + 1] = (h[i] >>> 16) & 0xff; res[i * 4 + 2] = (h[i] >>> 8) & 0xff; res[i * 4 + 3] = h[i] & 0xff; }
    return res;
  };

  const base64urlencode = (a) => {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  const exchangeCodeForToken = async (code) => {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) {
      console.error('[Spotify] code_verifier não encontrado — tente conectar novamente');
      return;
    }
    localStorage.removeItem('spotify_code_verifier');
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        }),
      });
      const data = await response.json();
      if (data.access_token) {
        setSpotifyToken(data.access_token);
        localStorage.setItem('spotify_access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('spotify_refresh_token', data.refresh_token);
        }
      } else {
        console.error('[Spotify] Falha na troca de token:', data);
      }
    } catch (err) {
      console.error('[Spotify] Erro de troca de código:', err);
    }
  };

  const refreshSpotifyToken = async () => {
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    if (!refreshToken) {
      // Sem meio de renovar? Desconecta para parar os erros 401
      localStorage.removeItem('spotify_access_token');
      localStorage.removeItem('spotify_refresh_token');
      setSpotifyToken(null);
      return;
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: SPOTIFY_CLIENT_ID,
        }),
      });

      const data = await response.json();
      if (data.access_token) {
        setSpotifyToken(data.access_token);
        localStorage.setItem('spotify_access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('spotify_refresh_token', data.refresh_token);
        }
      } else {
        // Se a renovação falhar (ex: token revogado), limpa a sessão
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        setSpotifyToken(null);
      }
    } catch (err) {
      console.error('Erro ao renovar token Spotify:', err);
    }
  };

  // CAPTURA TRANSICAO DA URL (TOKEN OU CODE)
  useEffect(() => {
    // Tenta primeiro o fluxo PKCE (Code)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const authError = urlParams.get('error');

    if (authError) {
      console.error('Erro na autenticação Spotify:', authError);
      localStorage.removeItem('spotify_access_token');
      localStorage.removeItem('spotify_refresh_token');
      setSpotifyToken(null);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (code) {
      exchangeCodeForToken(code);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Fallback para Implicit Grant (Hash)
    const hash = window.location.hash;
    if (hash) {
      const token = hash.substring(1).split('&').find(elem => elem.startsWith('access_token'))?.split('=')[1];
      if (token) {
        setSpotifyToken(token);
        localStorage.setItem('spotify_access_token', token);
        window.location.hash = '';
      }
    }
  }, []);

  // POLLING DA MÚSICA ATUAL
  useEffect(() => {
    if (!spotifyToken) return;

    const buscarMusica = async () => {
      if (!spotifyToken) return;
      try {
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { 'Authorization': `Bearer ${spotifyToken}` },
          cache: 'no-store'
        });

        if (response.status === 401) {
          if (localStorage.getItem('spotify_refresh_token')) {
            await refreshSpotifyToken();
          } else {
            localStorage.removeItem('spotify_access_token');
            setSpotifyToken(null);
          }
          return;
        }

        if (response.status === 403) {
          // 403 Forbidden: Usuário não whitelisted ou sem permissão
          localStorage.removeItem('spotify_access_token');
          localStorage.removeItem('spotify_refresh_token');
          setSpotifyToken(null);
          setMusicaAtual(null);
          return;
        }

        if (response.status === 204 || response.status > 400) {
          setMusicaAtual(prev => prev ? { ...prev, tocando: false } : null);
          return;
        }

        const data = await response.json();
        if (data && data.item) {
          setMusicaAtual({
            nome: data.item.name,
            artista: data.item.artists[0].name,
            capa: data.item.album.images[0].url,
            link: data.item.external_urls.spotify,
            tocando: data.is_playing,
            progresso: data.progress_ms,
            duracao: data.item.duration_ms
          });
        } else {
          setMusicaAtual(prev => prev ? { ...prev, tocando: false } : null);
        }
      } catch (err) {
        // Silencioso
      }
    };

    buscarMusica();
    const interval = setInterval(buscarMusica, 3000);
    return () => clearInterval(interval);
  }, [spotifyToken]);

  const spotifyAcao = async (endpoint, method = 'POST') => {
    if (!spotifyToken) return;
    try {
      await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
        method: method,
        headers: { 'Authorization': `Bearer ${spotifyToken}` }
      });
    } catch (err) {
      console.error('Erro na acao spotify:', err);
    }
  };

  const loginSpotify = async () => {
    // Validação de segurança exigida pelo Spotify
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.protocol !== 'https:') {
      alert("⚠️ BLOQUEIO DO SPOTIFY: O Spotify não permite login através de endereços de IP (como " + window.location.hostname + ") sem uma conexão segura HTTPS.\n\nPor favor, acesse o sistema através de:\nhttp://localhost:5173/sistemas/\nou\nhttp://127.0.0.1:5173/sistemas/");
      return;
    }

    const codeVerifier = generateRandomString(64);
    localStorage.setItem('spotify_code_verifier', codeVerifier);

    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64urlencode(hashed);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: SPOTIFY_SCOPES.join(' '),
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const temaSalvo = localStorage.getItem('tema_tilend');
    return temaSalvo ? temaSalvo === 'escuro' : true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tema_tilend', 'escuro');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tema_tilend', 'claro');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const checarUsuario = async () => {
      // Lê ?tilend_uid=... da URL — usado quando vindo de outro app (sub-apps em dev)
      const params = new URLSearchParams(window.location.search);
      const uidFromUrl = params.get('tilend_uid');
      if (uidFromUrl) {
        localStorage.setItem('tilend_user_id', uidFromUrl);
        params.delete('tilend_uid');
        const newSearch = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (newSearch ? '?' + newSearch : ''));
      }

      const idSalvo = uidFromUrl || localStorage.getItem('tilend_user_id');
      if (idSalvo) {
        // Usuário local (dev/local) — restaura da sessionStorage sem bater na API
        const localJson = sessionStorage.getItem('tilend_local_user');
        if (localJson) {
          try {
            const d = JSON.parse(localJson);
            if (d.id === idSalvo) {
              const userMock = {
                id: d.id, username: d.username, nome: d.nome,
                setor: d.setor, tipoUsuario: d.tipo_usuario,
                get: (field) => {
                  if (field === 'username') return d.username;
                  if (field === 'nome') return d.nome;
                  if (field === 'setor') return d.setor;
                  if (field === 'tipoUsuario') return d.tipo_usuario;
                  return d[field];
                },
                save: async () => { }
              };
              setUsuarioAtual(userMock);
              if (sessionStorage.getItem('tilend_launcher_pending')) setShowLauncher(true);
              setIsLoadingAuth(false);
              return;
            }
          } catch { }
        }

        // Busca os dados do usuário na tabela 'users' pelo ID salvo
        const { data: perfil } = await api.users.get(idSalvo);

        if (perfil) {
          const userMock = {
            id: perfil.id,
            username: perfil.username,
            nome: perfil.username,
            setor: perfil.setor,
            tipoUsuario: perfil.tipo_usuario,
            atribuicao: perfil.atribuicao,
            foto_perfil: { url: () => perfil.foto_perfil },
            get: (field) => {
              if (field === 'username') return perfil.username;
              if (field === 'setor') return perfil.setor;
              if (field === 'tipoUsuario') return perfil.tipo_usuario;
              if (field === 'atribuicao') return perfil.atribuicao;
              if (field === 'foto_perfil') return { url: () => perfil.foto_perfil };
              if (field === 'pin') return perfil.pin;
              if (field === 'senha_pin') return perfil.pin;
              return perfil[field];
            },
            save: async () => { /* Heartbeat mock */ }
          };
          setUsuarioAtual(userMock);
          if (sessionStorage.getItem('tilend_launcher_pending')) setShowLauncher(true);
          setIsLoadingAuth(false);
          return;
        }
        localStorage.removeItem('tilend_user_id');
      }

      // Terminou de verificar — libera a renderização (mostrará o Login se não achou usuário)
      setIsLoadingAuth(false);
    };
    checarUsuario();
  }, []);

  // HEARTBEAT: Atualiza o campo updated_at do usuário a cada 15s para marcar como "online".
  // O Dashboard usa esse timestamp para exibir quem está ativo no momento.
  useEffect(() => {
    if (!usuarioAtual) return;

    const heartbeat = async () => {
      try {
        await api.users.update(usuarioAtual.id, { updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ') });
      } catch (e) {
        console.error("Erro no heartbeat:", e);
      }
    };

    // Executa imediatamente ao logar/carregar
    heartbeat();

    // Pulso a cada 15 segundos para manter o status online (tolerância no Dashboard é 45s)
    const interval = setInterval(heartbeat, 15000);
    return () => clearInterval(interval);
  }, [usuarioAtual?.id]);

  // MOTOR CENTRAL DE NOTIFICAÇÕES (MariaDB + GLPI)
  useEffect(() => {
    if (usuarioAtual && usuarioAtual.get('tipoUsuario') !== 'solicitante') {
      const fetchData = async () => {
        try {
          const umDiaAtras = new Date(); umDiaAtras.setDate(umDiaAtras.getDate() - 1);
          const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

          const queries = [
            api.items.list(),
            api.emprestimos.list({ status: 'Aberto', limit: 200 }),
            api.emprestimos.list({ status: 'Devolvido', gte_data_hora_retorno: startOfToday.toISOString(), limit: 50 }),
            api.emprestimos.list({ in_status: 'Pendente,Aprovado', limit: 100 }),
            api.agenda.list({ lembrete: 'true', gte_inicio: new Date().toISOString() })
          ];

          let results = await Promise.all(queries);

          if (results[4].error) {
            results[4] = await api.agenda.list({ lembrete: 'true', gte_inicio: new Date().toISOString() });
          }

          const [resItens, resAbertos, resRetornos, , resLembretes] = results;

          // GLPI (tickets de empréstimo)
          const { fetchGLPITickets } = await import('./utils/glpiClient');
          const [ticketsAbertosGLPI, ticketsFechadosGLPI] = await Promise.all([
            fetchGLPITickets({ status: '1,2,3,4' }),
            fetchGLPITickets({ status: '5,6' })
          ]);

          // Disponibilidade real (empréstimos ativos vs estoque)
          if (resItens.data) {
            const itensBase = resItens.data;
            const emprestimosAtivos = resAbertos.data || [];

            // Mapear quantidades emprestadas por item_id ou glpi_item_id
            const emUsoPorItemId = {};
            emprestimosAtivos.forEach(emp => {
              const qtd = Number(emp.quantidade_emprestada) || 1;
              if (emp.item_id) {
                emUsoPorItemId[emp.item_id] = (emUsoPorItemId[emp.item_id] || 0) + qtd;
              } else if (emp.glpi_item_id) {
                emUsoPorItemId[emp.glpi_item_id] = (emUsoPorItemId[emp.glpi_item_id] || 0) + qtd;
              }
            });

            const itensProcessados = itensBase.map(item => {
              const totalFisico = Number(item.quantidade) || 0;
              const emUso = (emUsoPorItemId[item.id] || 0) + (item.glpi_id ? (emUsoPorItemId[item.glpi_id] || 0) : 0);
              const disponivel = Math.max(0, totalFisico - emUso);

              return {
                ...item,
                quantidade_disponivel: disponivel,
                patrimonio_total: totalFisico,
                origem: item.glpi_id ? 'GLPI' : 'LOCAL'
              };
            });

            setItens(itensProcessados);
          }

          const arrayNotificacoesBrutas = [];

          // Empréstimos abertos (MariaDB)
          if (resAbertos.data) {
            resAbertos.data.forEach(emp => {
              if (!emp.item) return;
              const createdAt = new Date(emp.created_at);
              const isAtraso = createdAt < umDiaAtras;
              arrayNotificacoesBrutas.push({
                id: `${isAtraso ? 'atraso' : 'saida'}-${emp.id}`,
                tipo: isAtraso ? 'atraso' : 'saida',
                protocolo: emp.protocolo,
                item: emp.item.nome_equipamento,
                solicitante: emp.nome_solicitante,
                data: isAtraso ? new Date(createdAt.getTime() + (24 * 60 * 60 * 1000)) : createdAt
              });
            });
          }
          if (resRetornos.data) {
            resRetornos.data.forEach(emp => {
              const dataRetorno = emp.data_hora_retorno ? new Date(emp.data_hora_retorno) : new Date(emp.updated_at);
              arrayNotificacoesBrutas.push({ id: `retorno-${emp.id}`, tipo: 'retorno', protocolo: emp.protocolo, item: emp.item?.nome_equipamento || 'Equipamento', solicitante: emp.nome_solicitante, data: dataRetorno });
            });
          }

          // Lembretes de tarefa (30 minutos antes) — apenas eventos do usuário ou em que é participante
          if (resLembretes.data) {
            const trintaMinutosEmMs = 30 * 60 * 1000;
            const agora = new Date();
            const meuUsername = usuarioAtual.get('username');
            resLembretes.data.forEach(ev => {
              const euSouCriador = ev.tecnico === meuUsername;
              const euSouParticipante = Array.isArray(ev.participantes) && ev.participantes.includes(meuUsername);
              if (!euSouCriador && !euSouParticipante) return;

              const inicio = new Date(ev.inicio);
              const diff = inicio.getTime() - agora.getTime();

              if (diff > 0 && diff <= trintaMinutosEmMs) {
                arrayNotificacoesBrutas.push({
                  id: `lembrete-task-${ev.id}`,
                  tipo: 'atraso',
                  protocolo: `AGENDA`,
                  item: ev.titulo,
                  solicitante: `${euSouCriador ? 'Sua tarefa' : `Tarefa de ${ev.tecnico}`} começa às ${inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
                  data: inicio,
                  isLembrete: true
                });
              }
            });
          }

          // Processar GLPI (Novos Abertos)
          ticketsAbertosGLPI.forEach(t => {
            const isEmprestimo = (t.name || '').includes('[EMPRÉSTIMO]');
            if (!isEmprestimo) return;

            const createdAt = new Date(t.date_creation);
            const isAtraso = createdAt < umDiaAtras;

            const matchProt = t.name.match(/#(\d+\/[A-Z0-9]+)/);
            const protocolo = matchProt ? matchProt[1] : `GLPI-${t.id}`;
            const partes = t.name.split(' - ');
            const solicitante = partes.length > 1 ? partes[partes.length - 1] : 'N/I';

            arrayNotificacoesBrutas.push({
              id: `${isAtraso ? 'atraso' : 'saida'}-glpi-${t.id}`,
              tipo: isAtraso ? 'atraso' : 'saida',
              protocolo: protocolo,
              item: 'Equipamento (GLPI)',
              solicitante: solicitante,
              data: isAtraso ? new Date(createdAt.getTime() + (24 * 60 * 60 * 1000)) : createdAt
            });
          });

          // Processar GLPI (Devoluções de Hoje)
          ticketsFechadosGLPI.forEach(t => {
            const isEmprestimo = (t.name || '').includes('[EMPRÉSTIMO]');
            if (!isEmprestimo) return;

            const solvedAt = new Date(t.solvedate || t.date_mod);
            if (solvedAt < startOfToday) return;

            const matchProt = t.name.match(/#(\d+\/[A-Z0-9]+)/);
            const protocolo = matchProt ? matchProt[1] : `GLPI-${t.id}`;
            const partes = t.name.split(' - ');
            const solicitante = partes.length > 1 ? partes[partes.length - 1] : 'N/I';

            arrayNotificacoesBrutas.push({
              id: `retorno-glpi-${t.id}`,
              tipo: 'retorno',
              protocolo: protocolo,
              item: 'Equipamento (GLPI)',
              solicitante: solicitante,
              data: solvedAt
            });
          });

          // 4. CHAMADOS INTERNOS (novo chamado ou mudança de status)
          const CHAMADOS_BASE = import.meta.env.VITE_CHAMADOS_API_BASE;
          if (CHAMADOS_BASE) {
            try {
              const resp = await fetch(`${CHAMADOS_BASE}/chamados`);
              if (resp.ok) {
                const raw = await resp.json();
                const chamados = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
                const snapshotRaw = localStorage.getItem('tilend_chamados_snapshot');
                const snapshot = snapshotRaw ? JSON.parse(snapshotRaw) : {};
                const novoSnapshot = {};
                chamados.forEach(c => {
                  novoSnapshot[String(c.id)] = c.status;
                  const isNovo = !snapshot[String(c.id)] && Object.keys(snapshot).length > 0;
                  const statusMudou = snapshot[String(c.id)] && snapshot[String(c.id)] !== c.status;
                  const dataRef = new Date(c.atualizado_em || c.updated_at || c.criado_em || c.created_at || Date.now());
                  if (isNovo) {
                    arrayNotificacoesBrutas.push({
                      id: `chamado-novo-${c.id}`,
                      tipo: 'chamado_novo',
                      protocolo: c.protocolo || String(c.id),
                      texto: `${c.titulo || 'Novo chamado'} — ${c.nome_solicitante || c.solicitante || ''}`.trim().replace(/—\s*$/, ''),
                      hora: dataRef.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                      data: dataRef,
                    });
                  } else if (statusMudou) {
                    arrayNotificacoesBrutas.push({
                      id: `chamado-status-${c.id}-${c.status}`,
                      tipo: 'chamado_status',
                      protocolo: c.protocolo || String(c.id),
                      texto: `"${c.titulo || 'Chamado'}" mudou para ${c.status}`,
                      hora: dataRef.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                      data: dataRef,
                    });
                  }
                });
                localStorage.setItem('tilend_chamados_snapshot', JSON.stringify(novoSnapshot));
              }
            } catch (_) { /* API de chamados indisponível */ }
          }

          const newNotifs = arrayNotificacoesBrutas.sort((a, b) => b.data.getTime() - a.data.getTime()).slice(0, 40);
          setNotificacoes(newNotifs);

          const unseenList = newNotifs.filter(n => !seenNotifIds.includes(n.id) && !idsExcluidos.includes(n.id));
          const hasUnseenNotifs = unseenList.length > 0;
          setUnreadCount(unseenList.length);

          if (hasUnseenNotifs && !notificacoesAberto) setHasUnreadNotifs(true);
          else setHasUnreadNotifs(false);

        } catch (e) { console.error(e); }
      };
      fetchData();
    }
  }, [triggerAtualizacao, usuarioAtual]);

  // Polling de 60s para detectar novos chamados e mudanças de status
  useEffect(() => {
    if (!usuarioAtual || usuarioAtual.get('tipoUsuario') === 'solicitante') return;
    const id = setInterval(() => setTriggerAtualizacao(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [usuarioAtual]);

  useEffect(() => {
    if (notificacoesAberto && notificacoes.length > 0) {
      setHasUnreadNotifs(false);
      setUnreadCount(0);
      setSeenNotifIds(prev => {
        const newSeen = [...new Set([...prev, ...notificacoes.map(n => n.id)])];
        localStorage.setItem('tilend_seen_notif_ids', JSON.stringify(newSeen));
        return newSeen;
      });
    }
  }, [notificacoesAberto, notificacoes]);

  // ATUALIZA TÍTULO DA GUIA (ESTILO WHATSAPP)
  useEffect(() => {
    const baseTitle = "TI Desk";
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [unreadCount]);

  // Chamado pelo componente Login quando o usuário escolhe um módulo no launcher.
  // Recebe o objeto do usuário e a rota escolhida, seta o estado e navega.
  const handleLoginSucesso = (userMock) => {
    // Marca que o launcher deve aparecer (persiste no reload da aba)
    sessionStorage.setItem('tilend_launcher_pending', '1');
    // Se for usuário local (sem banco), salva os dados brutos para restaurar no reload
    const uid = userMock.id || '';
    if (uid.startsWith('dev-') || uid.startsWith('local-')) {
      sessionStorage.setItem('tilend_local_user', JSON.stringify({
        id: userMock.id,
        username: userMock.username || userMock.get('username'),
        nome: userMock.nome || userMock.get('nome'),
        setor: userMock.setor || userMock.get('setor'),
        tipo_usuario: userMock.tipoUsuario || userMock.get('tipoUsuario'),
      }));
    }
    setUsuarioAtual(userMock);
    setShowLauncher(true);
  };

  // Chamado quando o usuário clica num módulo no launcher.
  // Toca a animação de saída, depois navega para o módulo escolhido.
  const abrirModuloLauncher = (rota) => {
    sessionStorage.removeItem('tilend_launcher_pending');
    handleSetModuloPreview(null);
    setAnimandoLauncher(true);
    setTimeout(() => {
      setShowLauncher(false);
      setAnimandoLauncher(false);
      navigate(rota);
    }, 680);
  };

  const handleUpdatePerfilComplete = (userAtualizado) => { setUsuarioAtual(null); setTimeout(() => { setUsuarioAtual(userAtualizado); }, 10); };
  const getFotoPerfilUrl = () => { if (!usuarioAtual) return null; const foto = usuarioAtual.get('foto_perfil'); return (foto && typeof foto.url === 'function') ? foto.url() : null; };
  const mudarAba = (id) => {
    if (id === 'dashboard#historico-dashboard') {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById('historico-dashboard');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 500);
      return;
    }
    navigate(id === 'dashboard' ? '/' : `/${id}`);
    setIsMobileMenuOpen(false);
    setMenuPerfilPopoverAberto(false);
  };

  const abrirDetalhes = (tipo, dados) => {
    setItemDetalhado({ tipo, dados });
    if (dados?.protocolo && !dados.protocolo.startsWith('#')) {
      navigate(`/${dados.protocolo}`);
    } else {
      navigate('/detalhes');
    }
  };

  const voltarDosDetalhes = () => { navigate(-1); };
  const handleLogout = async () => { localStorage.removeItem('tilend_user_id'); setUsuarioAtual(null); navigate('/'); };

  // Ao recarregar direto numa rota de detalhe, recarrega os dados da API
  useEffect(() => {
    if (itemDetalhado || isLoadingAuth || !usuarioAtual) return;
    const path = location.pathname.replace(/^\/|\/$/g, '');
    const isDetalhe = /^\d{4}[-\/]\d+/.test(path) || path === 'detalhes';
    if (!isDetalhe) return;

    setLoadingDetalhe(true);
    const CHAMADOS_BASE = import.meta.env.VITE_CHAMADOS_API_BASE || 'http://localhost:3000/api';
    const normalizar = s => String(s || '').replace(/\//g, '-').toLowerCase().trim();
    const pathNorm = normalizar(path);

    fetch(`${CHAMADOS_BASE}/chamados`)
      .then(r => r.ok ? r.json() : [])
      .then(resposta => {
        const lista = Array.isArray(resposta) ? resposta : (Array.isArray(resposta?.data) ? resposta.data : []);
        const encontrado = lista.find(c =>
          normalizar(c.protocolo) === pathNorm ||
          normalizar(c.id) === pathNorm ||
          String(c.id) === path
        );
        if (encontrado) { setItemDetalhado({ tipo: 'chamado', dados: encontrado }); setLoadingDetalhe(false); return; }
        return api.emprestimos.list({ protocolo: path }).then(({ data }) => {
          if (data?.[0]) { setItemDetalhado({ tipo: 'emprestimo', dados: data[0] }); }
          else navigate('/', { replace: true });
          setLoadingDetalhe(false);
        }).catch(() => { navigate('/', { replace: true }); setLoadingDetalhe(false); });
      })
      .catch(() => {
        // Chamados API falhou — tenta só nos empréstimos
        api.emprestimos.list({ protocolo: path }).then(({ data }) => {
          if (data?.[0]) { setItemDetalhado({ tipo: 'emprestimo', dados: data[0] }); }
          else navigate('/', { replace: true });
          setLoadingDetalhe(false);
        }).catch(() => { setLoadingDetalhe(false); navigate('/', { replace: true }); });
      });
  }, [location.pathname, itemDetalhado, isLoadingAuth, usuarioAtual]);


  const handleSearchInput = (texto) => {
    setSearchQuery(texto);
    if (!texto.trim()) { setSearchResults([]); setSearchSuggestion(null); setIsSearchOpen(false); return; }

    setIsSearchOpen(true);
    const textNorm = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let matches = []; let melhorSugestao = null; let menorDistancia = Infinity;

    rotasGlobais.forEach(rota => {
      const termosParaComparar = [rota.id, rota.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""), ...rota.keywords];
      let encontrouExato = false;
      termosParaComparar.forEach(termo => {
        if (termosParaComparar.includes(textNorm) || termo.includes(textNorm)) encontrouExato = true;
        const dist = levenshtein(textNorm, termo);
        if (!encontrouExato && dist > 0 && dist <= 3 && dist < menorDistancia) { menorDistancia = dist; melhorSugestao = rota; }
      });
      if (encontrouExato) matches.push(rota);
    });

    // Detecção de Protocolo (AAAA/NNN, AAAA-CHNNN ou AAAA[L]NNN)
    const isProtocolo = /^\d{4}\/\d{3,4}$/.test(texto.trim()) || /^\d{4}-CH\d+$/.test(texto.trim()) || /^\d{4}[A-Z]\d+$/i.test(texto.trim());
    if (isProtocolo) {
      matches.unshift({
        id: texto.trim(),
        nome: `Ver Protocolo ${texto.trim()}`,
        icon: FileText,
        keywords: []
      });
    }

    setSearchResults(matches);
    if (matches.length === 0 && melhorSugestao) setSearchSuggestion(melhorSugestao);
    else setSearchSuggestion(null);
  };

  const executarNavegacaoBusca = (idRota) => {
    if (idRota.includes('#')) {
      const [aba, idElemento] = idRota.split('#');
      mudarAba(aba);
      setSearchQuery('');
      setIsSearchOpen(false);

      // Delay para garantir que o componente da aba foi montado/está vísivel
      setTimeout(() => {
        const elemento = document.getElementById(idElemento);
        if (elemento) {
          elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Highlight sutil (opcional: piscar a borda ou fundo)
          elemento.classList.add('ring-2', 'ring-[#254E70]/30');
          setTimeout(() => elemento.classList.remove('ring-2', 'ring-[#254E70]/30'), 2000);
        }
      }, 300);
    } else if (/^\d{4}\/\d{3,4}[a-zA-Z]*$/i.test(idRota) || /^\d{4}-CH\d+$/.test(idRota) || /^\d{4}[A-Z]\d+$/i.test(idRota)) {
      // Navegação direta para Protocolo
      navigate(`/${idRota}`);
      setSearchQuery('');
      setIsSearchOpen(false);
    } else {
      mudarAba(idRota);
      setSearchQuery('');
      setIsSearchOpen(false);
    }
  };

  // Ainda verificando se há sessão salva — não renderiza nada para evitar piscar
  if (isLoadingAuth) return null;

  // Nenhum usuário logado — exibe a tela de login + launcher
  if (!usuarioAtual) {
    return <Login onLoginSucesso={handleLoginSucesso} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
  }

  // Tipo legado 'solicitante' — redireciona direto para o portal sem sidebar
  if (usuarioAtual.get('tipoUsuario') === 'solicitante') {
    return <PortalSolicitante usuarioAtual={usuarioAtual} onLogout={handleLogout} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
  }

  const tipoUsuario = usuarioAtual.get('tipoUsuario');
  const permSet = PERMISSIONS[tipoUsuario] ?? null;
  const canAccess = (rota) => permSet === null || permSet.has(rota);

  const currentRoute = abaAtiva;
  if (permSet && !permSet.has(currentRoute) && currentRoute !== 'detalhes') {
    return <Navigate to={FIRST_ALLOWED_ROUTE[tipoUsuario] || '/agenda'} replace />;
  }

  const notificacoesVisiveis = notificacoes.filter(n => !idsExcluidos.includes(n.id));
  const isGestaoActive = abaAtiva === 'emprestimos' || abaAtiva === 'estoque' || abaAtiva === 'saidas' || abaAtiva === 'entradas' || abaAtiva === 'calendario';

  const headerInfo = {
    'dashboard': { label: 'Dashboard', icon: Home },
    'emprestimos': { label: 'Empréstimos', icon: Laptop },
    'estoque': { label: 'Empréstimos', icon: Laptop },
    'saidas': { label: 'Empréstimos', icon: Laptop },
    'entradas': { label: 'Empréstimos', icon: Laptop },
    'localizacoes': { label: 'Localização por Setor', icon: Globe },
    'calendario': { label: 'Empréstimos', icon: Laptop },
    'agenda': { label: 'Agenda', icon: CalendarDays },
    'relatorios': { label: 'Inteligência e Relatórios', icon: FileText },
    'portal': { label: 'Portal do Solicitante', icon: ShoppingBag },
    'chamados_externos': { label: 'Chamados', icon: LayoutGrid },
    'impressoras': { label: 'Gestão de Ativos', icon: Printer },
    'bot_conhecimento': { label: 'Bot de Conhecimento', icon: MessageSquare },
    'perfil': { label: 'Configurações de Conta', icon: Settings },
    'manutencoes': { label: 'Manutenções', icon: Wrench },
    'detalhes': { label: 'Detalhamento Técnico', icon: ArrowLeft }
  };

  const legendaUsuario = usuarioAtual.get('atribuicao') || 'Técnico de TI';

  return (
    <div key="view-dashboard" className="flex h-screen bg-[var(--bg-page)] text-slate-900 dark:text-[#F8FAFC] selection:bg-[#8B5CF6]/30 font-sans transition-colors duration-300 overflow-hidden">

      <div className="no-print md:hidden fixed top-0 left-0 right-0 h-20 bg-[var(--bg-page)]/80 backdrop-blur-md flex items-center justify-between px-6 z-40 transition-colors duration-300 shadow-sm border-b border-transparent">
        <div className="flex items-center gap-3">
          <div className="w-[40px] h-[40px] rounded-xl flex items-center justify-center border-red-500 border overflow-hidden"><img src={LogoImg} className="w-full h-full object-cover" alt="Logo" /></div>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-500 dark:text-[#A0A0A0]"><Menu size={24} /></button>
      </div>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <aside className={`no-print fixed inset-y-0 left-0 z-[9999] p-[0.6vw] bg-[var(--bg-page)] flex flex-col h-screen transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 overflow-visible ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} ${showLauncher ? 'md:hidden' : ''}`}>
        <div className="h-10 flex items-center justify-center shrink-0">
          <div className="w-[39px] h-[39px] rounded-xl flex items-center justify-center shrink-0 transition-all overflow-hidden">
            <img src={LogoImg} className="w-full h-full object-cover" alt="Logo" />
          </div>

          {isMobileMenuOpen && (
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white transition-colors p-1 ml-auto">
              <X size={20} />
            </button>
          )}
        </div>

        <div className="flex-1 py-2">
          <div className="space-y-2 w-full">
            {canAccess('dashboard') && (
              <button onClick={() => mudarAba('dashboard')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'dashboard' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'dashboard' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
                <Home size={18} className="shrink-0 transition-transform group-hover:scale-110" />
                <div className="sidebar-pill">Dashboard</div>
              </button>
            )}

            {canAccess('agenda') && (
              <button onClick={() => mudarAba('agenda')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'agenda' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'agenda' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
                <Calendar size={18} className="shrink-0 transition-transform group-hover:scale-110" />
                <div className="sidebar-pill">Agenda</div>
              </button>
            )}

            {canAccess('estoque') && (
              <button onClick={() => mudarAba('estoque')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${isGestaoActive ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${isGestaoActive ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
                <Laptop size={18} className="shrink-0 transition-transform group-hover:scale-110" />
                <div className="sidebar-pill">Empréstimos</div>
              </button>
            )}

            {canAccess('portal') && (
              <button onClick={() => mudarAba('portal')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'portal' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'portal' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
                <ShoppingBag size={18} className="shrink-0 transition-transform group-hover:scale-110" />
                <div className="sidebar-pill">Portal</div>
              </button>
            )}

            {canAccess('chamados_externos') && (
              <button onClick={() => mudarAba('chamados_externos')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'chamados_externos' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'chamados_externos' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
                <LayoutGrid size={18} className="shrink-0 transition-transform group-hover:scale-110" />
                <div className="sidebar-pill">Chamados</div>
              </button>
            )}

            {canAccess('manutencoes') && (
              <button onClick={() => mudarAba('manutencoes')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'manutencoes' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'manutencoes' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
                <Wrench size={18} className="shrink-0 transition-transform group-hover:scale-110" />
                <div className="sidebar-pill">Manutenções</div>
              </button>
            )}

            {canAccess('impressoras') && (
              <button onClick={() => mudarAba('impressoras')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'impressoras' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'impressoras' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
                <Printer size={18} className="shrink-0 transition-transform group-hover:scale-110" />
                <div className="sidebar-pill">Ativos</div>
              </button>
            )}

            {/* {canAccess('bot_conhecimento') && (
              <button onClick={() => mudarAba('bot_conhecimento')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'bot_conhecimento' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'bot_conhecimento' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
                <div className="relative">
                  <MessageSquare size={18} className="shrink-0 transition-transform group-hover:scale-110" />
                  <Sparkles size={10} className="absolute -top-1.5 -right-1.5 text-[#254E70] animate-pulse" strokeWidth={3} />
                </div>
                <div className="sidebar-pill">Conhecimento</div>
              </button>
            )} */}

            {canAccess('relatorios') && (
              <button onClick={() => mudarAba('relatorios')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'relatorios' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#8D3046] shadow-[0_0_12px_rgba(141,48,70,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'relatorios' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
                <FileText size={18} className="shrink-0 transition-transform group-hover:scale-110" />
                <div className="sidebar-pill">Relatórios</div>
              </button>
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-col gap-1 relative">
          <div ref={menuPerfilRef} className="relative w-full mt-2">
            {menuPerfilPopoverAberto && (
              <div className="absolute bottom-[calc(100%+12px)] left-0 w-56 bg-[var(--bg-card)] rounded-2xl z-50 animate-in slide-in-from-bottom-2 flex flex-col border border-slate-200 dark:border-white/10 shadow-2xl">
                <button onClick={() => { mudarAba('perfil'); setMenuPerfilPopoverAberto(false); }} className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-[var(--bg-hover)] dark:hover:bg-white/5 transition-all duration-300 font-medium border-b border-slate-100 dark:border-white/5 rounded-t-2xl">
                  <Settings size={16} className="shrink-0 text-[#254E70]" /> Editar Perfil
                </button>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] dark:hover:bg-white/5 transition-all duration-300 font-medium rounded-b-2xl">
                  <LogOut size={16} className="shrink-0" /> Encerrar Sessão
                </button>
              </div>
            )}

            <button onClick={() => setMenuPerfilPopoverAberto(!menuPerfilPopoverAberto)} className={`w-full flex items-center justify-center hover:bg-[var(--bg-soft)] dark:hover:bg-[var(--bg-card)]/5 transition-all rounded-xl relative group ${menuPerfilPopoverAberto ? 'bg-[var(--bg-soft)] dark:bg-[var(--bg-card)]/5' : ''}`}>
              <div className="flex items-center justify-center overflow-hidden">
                {getFotoPerfilUrl() ? (
                  <img src={getFotoPerfilUrl()} alt="Avatar" className="w-9 h-9 rounded-xl object-cover shrink-0 transition-all" />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-[var(--bg-card)] flex items-center justify-center shrink-0 transition-all text-white dark:text-[var(--bg-page-dark)]">
                    <span className="font-black text-xs uppercase">{usuarioAtual.get('username')?.charAt(0)}</span>
                  </div>
                )}
              </div>
              <div className="sidebar-pill">Perfil</div>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[var(--bg-page)] md:pt-0 transition-colors duration-300">
        <header className={`no-print flex items-center py-2 px-[0.6vw] justify-between shrink-0 bg-[var(--bg-page)]/70 backdrop-blur-xl transition-all duration-300 ${spotifyAberto || notificacoesAberto ? 'z-[10000]' : 'z-30'}`}>
          <div className="flex items-center gap-4">
            {/* Esconde nome da página e botões contextuais no launcher */}
            {!showLauncher && <>
              {abaAtiva === 'detalhes' && (
                <button
                  onClick={voltarDosDetalhes}
                  className="bg-[var(--bg-card)] p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-[var(--bg-hover)] hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
                  title="Voltar"
                >
                  <ArrowLeft size={18} strokeWidth={2.5} />
                </button>
              )}
              <div className={`flex flex-col ${abaAtiva === 'detalhes' ? '' : 'ml-2'}`}>
                <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                  {abaAtiva === 'detalhes' && itemDetalhado?.dados
                    ? (itemDetalhado.dados.protocolo || itemDetalhado.dados.id?.split('-')[0].toUpperCase())
                    : headerInfo[abaAtiva]?.label}
                </span>
                {abaAtiva === 'detalhes' && (
                  <span className="text-[10px] font-black text-[#254E70] dark:text-blue-400 uppercase tracking-widest mt-1">
                    {itemDetalhado?.tipo === 'chamado' ? 'Ticket de Suporte' : 'Termo de Empréstimo'}
                  </span>
                )}
              </div>

              {abaAtiva === 'portal' && (
                <div className="flex items-center gap-2 ml-6 animate-in fade-in slide-in-from-left-2 duration-500">
                  <button
                    onClick={() => setAbaPortal('dashboard')}
                    className="px-5 py-2.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap"
                    style={{
                      backgroundColor: abaPortal === 'dashboard' ? 'var(--bg-selected)' : 'var(--bg-soft)',
                      color: abaPortal === 'dashboard' ? 'var(--text-selected)' : 'var(--text-muted)'
                    }}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setAbaPortal('catalogo')}
                    className="px-5 py-2.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap"
                    style={{
                      backgroundColor: abaPortal === 'catalogo' ? 'var(--bg-selected)' : 'var(--bg-soft)',
                      color: abaPortal === 'catalogo' ? 'var(--text-selected)' : 'var(--text-muted)'
                    }}
                  >
                    Catálogo
                  </button>
                  <button
                    onClick={() => setAbaPortal('historico')}
                    className="px-5 py-2.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap"
                    style={{
                      backgroundColor: abaPortal === 'historico' ? 'var(--bg-selected)' : 'var(--bg-soft)',
                      color: abaPortal === 'historico' ? 'var(--text-selected)' : 'var(--text-muted)'
                    }}
                  >
                    Meus Pedidos
                  </button>
                </div>
              )}

              {isGestaoActive && (
                <div className="flex items-center gap-2 ml-6 animate-in fade-in slide-in-from-left-2 duration-500">
                  <button
                    onClick={() => mudarAba('emprestimos')}
                    className="px-5 py-2.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap"
                    style={{
                      backgroundColor: abaAtiva === 'emprestimos' ? 'var(--bg-selected)' : 'var(--bg-soft)',
                      color: abaAtiva === 'emprestimos' ? 'var(--text-selected)' : 'var(--text-muted)'
                    }}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => mudarAba('estoque')}
                    className="px-5 py-2.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap"
                    style={{
                      backgroundColor: abaAtiva === 'estoque' ? 'var(--bg-selected)' : 'var(--bg-soft)',
                      color: abaAtiva === 'estoque' ? 'var(--text-selected)' : 'var(--text-muted)'
                    }}
                  >
                    Estoque
                  </button>
                  <button
                    onClick={() => mudarAba('saidas')}
                    className="px-5 py-2.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap"
                    style={{
                      backgroundColor: abaAtiva === 'saidas' ? 'var(--bg-selected)' : 'var(--bg-soft)',
                      color: abaAtiva === 'saidas' ? 'var(--text-selected)' : 'var(--text-muted)'
                    }}
                  >
                    Saídas
                  </button>
                  <button
                    onClick={() => mudarAba('entradas')}
                    className="px-5 py-2.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap"
                    style={{
                      backgroundColor: abaAtiva === 'entradas' ? 'var(--bg-selected)' : 'var(--bg-soft)',
                      color: abaAtiva === 'entradas' ? 'var(--text-selected)' : 'var(--text-muted)'
                    }}
                  >
                    Entradas
                  </button>
                  <button
                    onClick={() => mudarAba('calendario')}
                    className="px-5 py-2.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap"
                    style={{
                      backgroundColor: abaAtiva === 'calendario' ? 'var(--bg-selected)' : 'var(--bg-soft)',
                      color: abaAtiva === 'calendario' ? 'var(--text-selected)' : 'var(--text-muted)'
                    }}
                  >
                    Reservas
                  </button>
                </div>
              )}
            </>}
          </div>

          {!showLauncher && <div className="relative w-48 md:w-80 hidden sm:block z-50 ml-auto">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#606060]" />
            <input type="text" placeholder="Busca Inteligente..." value={searchQuery} onChange={(e) => handleSearchInput(e.target.value)} onFocus={() => { if (searchQuery) setIsSearchOpen(true) }} className="w-full pl-11 pr-4 py-3 bg-[var(--bg-card)] border-none rounded-2xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#254E70] transition-all" />
            {isSearchOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSearchOpen(false)}></div>
                <div className="absolute top-full left-0 right-0 mt-3 bg-[var(--bg-card)] rounded-3xl z-50 overflow-hidden animate-in slide-in-from-top-2 flex flex-col max-h-80 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] border border-slate-200/50 dark:border-white/10">
                  <div className="p-3 overflow-y-auto custom-scrollbar">
                    {searchResults.length > 0 ? (
                      searchResults.map(rota => {
                        const Icone = rota.icon;
                        return (
                          <button key={rota.id} onClick={() => executarNavegacaoBusca(rota.id)} className="w-full flex items-center gap-4 p-3 hover:bg-[var(--bg-page)] dark:hover:bg-[var(--bg-card)]/5 rounded-2xl transition-colors text-left group">
                            <div className="p-3 bg-[var(--bg-soft)]  text-slate-500 dark:text-[#A0A0A0] rounded-xl group-hover:text-[#254E70] transition-colors"><Icone size={16} /></div>
                            <div><p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide">{rota.nome}</p></div>
                          </button>
                        )
                      })
                    ) : searchSuggestion ? (
                      <div className="p-3 text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">Você quis dizer?</p>
                        <button onClick={() => executarNavegacaoBusca(searchSuggestion.id)} className="w-full flex items-center justify-center gap-3 p-4 bg-[#254E70]/10 text-[#254E70] rounded-2xl hover:bg-[#254E70]/20 transition-all text-xs font-bold uppercase tracking-widest">
                          {searchSuggestion.nome} <ArrowRight size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-400">
                        <p className="text-[10px] font-bold uppercase tracking-widest">Sem resultados</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>}

          <div className="flex items-center gap-4 ml-4">
            <div className={`relative ${notificacoesAberto ? 'z-[10000]' : 'z-10'}`}>
              <button
                onClick={() => { setNotificacoesAberto(!notificacoesAberto); setHasUnreadNotifs(false); }}
                className={`relative p-2.5 rounded-2xl transition-all duration-300 ${notificacoesAberto ? 'bg-[var(--bg-soft)] text-slate-900 dark:text-white' : 'text-slate-500 dark:text-[#606060] hover:bg-[var(--bg-soft)] hover:text-slate-900 dark:hover:text-white'}`}
              >
                <Bell size={20} strokeWidth={1.5} />
                {hasUnreadNotifs && <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] absolute top-2 right-2 animate-pulse border-2 border-[var(--bg-page)] dark:border-zinc-900"></div>}
              </button>

              {notificacoesAberto && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificacoesAberto(false)}></div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 md:w-[450px] bg-[var(--bg-card)] rounded-[2rem] z-[10000] overflow-hidden animate-in slide-in-from-top-4 duration-200 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] border border-slate-200/50 dark:border-white/10">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-[var(--bg-page)]/50 /50">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">Central de Alertas</h3>
                        <span className="text-[10px] bg-slate-200 dark:bg-[#404040] px-2.5 py-1 rounded-lg font-bold text-slate-700 dark:text-white">{notificacoesVisiveis.length}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {notificacoesVisiveis.length > 0 && <button onClick={() => setIdsExcluidos(notificacoes.map(n => n.id))} className="text-[9px] text-slate-500 dark:text-[#606060] hover:text-[#8D3046] font-bold uppercase flex items-center gap-1.5 transition-colors tracking-widest"><Trash2 size={12} /> Limpar</button>}
                        <button onClick={() => setNotificacoesAberto(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X size={16} /></button>
                      </div>
                    </div>
                    <div className="max-h-[32rem] overflow-y-auto custom-scrollbar">
                      {notificacoesVisiveis.length === 0 ? (
                        <div className="p-16 text-center flex flex-col items-center gap-5">
                          <div className="p-5 bg-[var(--bg-page)] rounded-[2rem] text-slate-400 dark:text-[#404040] shadow-inner"><Bell size={32} strokeWidth={1} /></div>
                          <p className="text-[10px] text-slate-500 dark:text-[#606060] font-black uppercase tracking-widest">Sem novas atividades.</p>
                        </div>
                      ) : (
                        <div className="p-3 space-y-2">
                          {notificacoesVisiveis.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => {
                                if (n.tipo === 'chamado_novo' || n.tipo === 'chamado_status') {
                                  abrirDetalhes('chamado', { protocolo: n.protocolo });
                                } else {
                                  const idReal = n.id.split('-').slice(1).join('-');
                                  const tipoOrigem = n.tipo === 'pendente' || n.tipo === 'agendado' ? 'agendamento' : 'emprestimo';
                                  abrirDetalhes(tipoOrigem, { id: idReal, protocolo: n.protocolo });
                                }
                              }}
                              className="p-5 rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-[var(--bg-page)] dark:hover:bg-[var(--bg-card)]/[0.02] bg-[var(--bg-card)] dark:bg-transparent transition-colors flex gap-4 group relative shadow-sm cursor-pointer"
                            >
                              <div className={`p-3 rounded-xl shrink-0 h-fit shadow-inner border border-transparent ${n.tipo === 'atraso' ? 'bg-[#8D3046]/10 text-[#8D3046] border-[#8D3046]/20' :
                                n.tipo === 'pendente' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                  n.tipo === 'agendado' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                    n.tipo === 'saida' ? 'bg-[#254E70]/10 text-[#254E70] border-[#254E70]/20' :
                                      n.tipo === 'chamado_novo' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                                        n.tipo === 'chamado_status' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                }`}>
                                {n.tipo === 'atraso' ? <AlertTriangle size={16} /> :
                                  n.tipo === 'pendente' ? <Globe size={16} /> :
                                    n.tipo === 'agendado' ? <CalendarDays size={16} /> :
                                      n.tipo === 'saida' ? <ArrowUpRight size={16} /> :
                                        n.tipo === 'chamado_novo' ? <MessageSquare size={16} /> :
                                          n.tipo === 'chamado_status' ? <Activity size={16} /> :
                                            <CheckCircle2 size={16} />}
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">{n.tipo.replace('_', ' ')}</h4>
                                  <span className="text-[10px] text-slate-400 font-mono">{n.hora}</span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-[#A0A0A0] leading-relaxed">
                                  {n.texto}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* GRUPO DE UTILITÁRIOS (SPOTIFY + PERFIL) */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2.5 rounded-2xl text-slate-500 dark:text-[#606060] hover:bg-[var(--bg-soft)] hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shrink-0"
                title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
              >
                {isDarkMode ? <Moon size={20} strokeWidth={1.5} /> : <Sun size={20} strokeWidth={1.5} />}
              </button>

              {/* PLAYER SPOTIFY DINÂMICO */}
              <div className={`hidden md:block ${spotifyAberto ? 'relative z-[10000]' : 'relative z-10'}`}>
                <div
                  className={`flex items-center flex-row-reverse cursor-pointer rounded-full transition-all duration-300 p-1.5 ${!spotifyAberto ? 'group hover:bg-[var(--bg-card)] hover:pl-12' : ''}`}
                  onClick={() => spotifyToken ? setSpotifyAberto(!spotifyAberto) : loginSpotify()}
                >
                  {/* O DISCO (CD) */}
                  <div className={`transition-all duration-700 rounded-full overflow-hidden flex items-center justify-center relative shrink-0 ${musicaAtual ? 'w-9 h-9' : 'w-9 h-9'}`}>
                    {musicaAtual ? (
                      <img
                        src={musicaAtual.capa}
                        alt="Capa"
                        className={`w-full h-full object-cover ${musicaAtual.tocando ? 'animate-spin-slow' : 'animate-spin-slow-paused grayscale-[0.5]'}`}
                      />
                    ) : (
                      <div className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors ${spotifyToken ? 'bg-[#1DB954]' : 'bg-slate-300 dark:bg-[#404040]'}`}>
                        <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.492 17.291c-.215.353-.674.464-1.027.249-2.846-1.74-6.429-2.132-10.648-1.17-.404.093-.812-.162-.905-.566-.093-.404.162-.812.566-.905 4.622-1.056 8.583-.611 11.764 1.336.353.215.464.674.25 1.056zm1.465-3.26c-.27.441-.847.581-1.288.311-3.257-2.002-8.223-2.585-12.076-1.415-.497.151-1.025-.13-1.176-.627-.151-.498.13-1.025.627-1.176 4.39-1.332 9.87-.674 13.593 1.616.441.27.581.847.311 1.288-.009.006-.009.006 0 .002zm.126-3.376c-.324.53-.996.697-1.526.373-3.805-2.261-10.076-2.47-13.639-1.387-.607.185-1.251-.161-1.436-.768-.185-.607.161-1.251.768-1.436 4.25-1.29 11.17-1.042 15.54 1.556.53.324.697.996.373 1.526-.02.04-.02.04-.04.036z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {!spotifyToken && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-[#606060] group-hover:text-[#1DB954] transition-all duration-500 overflow-hidden whitespace-nowrap w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 group-hover:mr-3">
                      Entrar
                    </span>
                  )}

                  {spotifyToken && (
                    <div className="text-right overflow-hidden transition-all duration-500 w-0 h-auto group-hover:w-auto opacity-0 group-hover:opacity-100 group-hover:mr-3 flex flex-col justify-center">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-[#A0A0A0] leading-none block truncate">
                        {musicaAtual ? musicaAtual.artista : 'Experimente'}
                      </span>
                      <span className="text-[11px] font-bold text-slate-900 dark:text-white mt-1 block truncate max-w-[150px]">
                        {musicaAtual ? musicaAtual.nome : 'Tocar algo agora'}
                      </span>
                    </div>
                  )}
                </div>

                {spotifyAberto && spotifyToken && (
                  <div
                    ref={spotifyRef}
                    className={`absolute top-full left-1/2 -translate-x-1/2 mt-5 w-[340px] h-[450px] rounded-[2rem] z-[10000] overflow-hidden animate-in zoom-in-95 duration-500 cursor-default group/popover shadow-2xl ${!musicaAtual ? 'bg-[#FDFDFD]' : 'bg-[var(--bg-card)]'}`}
                  >
                    {musicaAtual ? (
                      <div className="relative w-full h-full flex flex-col rounded-[2rem] overflow-hidden">
                        <div className="absolute inset-0 w-full h-full">
                          <img
                            src={musicaAtual.capa}
                            alt="Capa"
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover/popover:scale-110"
                          />
                          {/* CONTROLES ESTILO INSTAGRAM STORIES */}
                          <div className="absolute inset-0 flex z-[15]">
                            <div className="flex-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); spotifyAcao('previous'); }}
                              style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.1) 0%, transparent 100%)' }}></div>
                            <div className="flex-[2] cursor-pointer" onClick={(e) => { e.stopPropagation(); musicaAtual?.tocando ? spotifyAcao('pause', 'PUT') : spotifyAcao('play', 'PUT'); }}></div>
                            <div className="flex-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); spotifyAcao('next'); }}
                              style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.1) 0%, transparent 100%)' }}></div>
                          </div>
                        </div>

                        <div className="relative flex-1 p-6 flex flex-col justify-between z-20 pointer-events-none">
                          {/* TOPO: BADGE ESTILO EDITORIAL (INTEIRO CLICÁVEL) */}
                          <div className="flex justify-between items-start transition-opacity duration-300 group-hover/popover:opacity-0">
                            {/* Pílula removida conforme solicitado */}
                          </div>

                          {/* BASE: APENAS A BARRINHA DE PROGRESSO (ULTRA DISCRETA) */}
                          <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000 mb-2">
                            <div className="relative h-[2px] w-1/2 mx-auto bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                              <div className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-1000 ease-linear" style={{ width: `${Math.min(100, ((Number(musicaAtual.progresso) || 0) / (Number(musicaAtual.duracao) || 100)) * 100)}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-12 relative">
                        <img
                          src="https://i.pinimg.com/originals/9e/f1/b2/9ef1b2552e6cd165df3202a3066bf463.gif"
                          alt="Spotify Waiting"
                          className="w-full h-auto rounded-[2rem] opacity-90 grayscale-[0.1]"
                        />
                        <div className="absolute bottom-12 left-0 right-0 flex justify-center">
                          <span className="text-[12px] font-medium tracking-tight text-[#131313]">
                            Esperando uma música...
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 pl-6 border-l border-slate-200 dark:border-white/10 h-10" onClick={() => mudarAba('perfil')}>
                <div className="hidden lg:block text-right cursor-pointer group pt-1">
                  <p className="text-[12px] font-bold text-slate-900 dark:text-white capitalize transition-colors group-hover:text-[#254E70] leading-tight">{usuarioAtual.get('username')}</p>
                  <p className="text-[10px] text-slate-500 dark:text-[#A0A0A0] font-bold mt-0.5">{legendaUsuario}</p>
                </div>
                {getFotoPerfilUrl() ? (
                  <img src={getFotoPerfilUrl()} alt="Avatar" className="w-[35px] h-[35px] rounded-full object-cover shadow-sm cursor-pointer transition-all" />
                ) : (
                  <div className="w-[39px] h-[39px] rounded-xl bg-[var(--bg-card)] flex items-center justify-center shadow-sm cursor-pointer hover:ring-2 hover:ring-[#254E70]/50 transition-all text-slate-600 dark:text-[#A0A0A0]">
                    <span className="font-black text-xs uppercase">{usuarioAtual.get('username')?.charAt(0)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {showLauncher ? (
          /* ── LAUNCHER: conteúdo da tela de seleção de módulo ─────────────────
             O header real do sistema já está renderizado acima, incluindo
             notificações, dark mode, Spotify e foto de perfil. */
          <div className="flex-1 flex flex-col items-center justify-start pb-[10vh] relative overflow-y-auto custom-scrollbar animate-in fade-in duration-700">

            {/* Espaçador animado — centra o texto quando vazio, encolhe para o topo ao selecionar */}
            <div
              className="shrink-0"
              style={{
                height: moduloPreview ? '3vh' : '28vh',
                transition: 'height 600ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />

            <div className="flex flex-col items-center justify-center w-full max-w-5xl px-6 mb-12 text-center transition-all duration-500">
              <div className={`flex flex-col items-center transition-all duration-500 ${moduloPreview ? 'mb-2 origin-top' : 'mb-8'}`}>
                <span className={`font-black text-slate-500 dark:text-[#505050] uppercase tracking-[0.4em] transition-all duration-500 ${moduloPreview ? 'text-[8px] mb-2' : 'text-[10px] mb-4'}`}>
                  Bem-vindo de volta
                </span>
                <h1 className={`font-light tracking-tight text-slate-900 dark:text-white capitalize transition-all duration-500 ${moduloPreview ? 'text-3xl md:text-4xl' : 'text-5xl md:text-7xl'}`}>
                  {usuarioAtual.get('nome') || usuarioAtual.get('username')}
                </h1>
                {!moduloPreview && (
                  <p className="text-sm text-slate-400 dark:text-[#505050] mt-5 transition-all duration-300">
                    Selecione um módulo abaixo para continuar
                  </p>
                )}
              </div>

              {/* Cards de preview — expande abaixo do nome */}
              <div style={{
                display: 'grid',
                gridTemplateRows: moduloPreview ? '1fr' : '0fr',
                transition: 'grid-template-rows 420ms cubic-bezier(0.4,0,0.2,1)',
                width: '100%',
                maxWidth: '1280px',
                marginTop: moduloPreview ? '1.5rem' : '0',
              }}>
                <div style={{ overflow: 'visible', position: 'relative' }}>
                  <AnimatePresence mode="wait" custom={slideDirection}>
                    {moduloPreview && (
                      <motion.div
                        key={moduloPreview}
                        custom={slideDirection}
                        variants={slideVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ 
                          duration: 0.45, 
                          ease: [0.23, 1, 0.32, 1] 
                        }}
                        className="w-full flex justify-center"
                      >
                        <ModuloPreviewCards moduleId={moduloPreview} itens={itens} notificacoes={notificacoes} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Ícones dos módulos — fixos na parte inferior */}
            <div className="fixed bottom-[2vw] left-1/2 -translate-x-1/2 z-[100] transition-all duration-500">
              <div
                ref={dockRef}
                onMouseMove={(e) => setDockMouseX(e.clientX)}
                onMouseLeave={() => setDockMouseX(null)}
                style={{
                  opacity: animandoLauncher ? 0 : 1,
                  transform: animandoLauncher ? 'translateX(-55vw) scale(0.82)' : 'translateX(0) scale(1)',
                  transition: 'opacity 620ms cubic-bezier(0.4, 0, 0.2, 1), transform 620ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                className="flex flex-row items-end gap-4 px-2"
              >
                {LAUNCHER_MODULOS
                  .filter(m => m.roles.includes(tipoParaRole(usuarioAtual.get('tipoUsuario'))))
                  .map((modulo, index) => {
                    const Icon = modulo.icon;
                    const isSelected = moduloPreview === modulo.id;

                    // Calcula escala estilo dock do macOS com base na distância do cursor
                    const ITEM_W = 52 + 16; // largura do ícone + gap
                    const dockScale = (() => {
                      if (dockMouseX === null || !dockRef.current) return 1;
                      const rect = dockRef.current.getBoundingClientRect();
                      const center = rect.left + index * ITEM_W + 24;
                      const dist = Math.abs(dockMouseX - center);
                      const radius = 100;
                      if (dist >= radius) return 1;
                      const t = 1 - dist / radius;
                      return 1 + 0.2 * (t * t);
                    })();

                    return (
                      // group no wrapper — tooltip usa group-hover mas fica fora do scale
                      <div key={modulo.id} className="group relative">

                        {/* Bloco escalado pelo dock */}
                        <div
                          style={{
                            transform: `translateY(-${(dockScale - 1) * 80}px) scale(${dockScale})`,
                            transformOrigin: 'bottom center',
                            transition: dockMouseX === null
                              ? 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                              : 'transform 80ms ease-out',
                          }}
                        >
                          <button
                            onClick={() => {
                              if (isSelected) abrirModuloLauncher(modulo.rota);
                              else handleSetModuloPreview(modulo.id);
                            }}
                            disabled={animandoLauncher}
                            style={{
                              animationName: 'slideUpFade',
                              animationDuration: '0.22s',
                              animationTimingFunction: 'ease',
                              animationDelay: `${index * 55}ms`,
                              animationFillMode: 'both',
                            }}
                            className={`flex items-center justify-center w-[52px] h-[52px] cursor-pointer bg-[var(--bg-card)] rounded-xl ${isSelected ? 'text-[#254E70] dark:text-white shadow-lg' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70] dark:hover:text-white'}`}
                          >
                            <Icon size={20} className="shrink-0" />
                          </button>
                        </div>

                        {/* Tooltip fora do container escalado — sempre no tamanho original */}
                        <div className="absolute bottom-[calc(100%+14px)] left-1/2 -translate-x-1/2 px-[14px] py-[8px] bg-[#0f172a] dark:bg-white text-white dark:text-[#0f172a] text-[12px] font-medium rounded-full whitespace-nowrap pointer-events-none transition-all duration-300 opacity-0 translate-y-2 group-hover:-translate-y-5 group-hover:opacity-100 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)] dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)] border border-white/10 dark:border-black/10 z-[1000000]">
                          {modulo.nome}
                        </div>

                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        ) : (
          <div className={`flex-1 custom-scrollbar ${abaAtiva === 'agenda' || abaAtiva === 'detalhes' || abaAtiva === 'chamados_externos' ? 'overflow-hidden' : 'overflow-y-auto'}`} onClick={() => { setNotificacoesAberto(false); setMenuPerfilPopoverAberto(false); setIsSearchOpen(false); }}>
            <div className={`border-r border-transparent border-b border-transparent flex flex-col ${['agenda', 'detalhes'].includes(abaAtiva) ? 'h-[calc(100vh-82px)] pb-0 m-0 px-[1%] pt-[1%]' : ['chamados_externos', 'saidas', 'estoque'].includes(abaAtiva) ? 'h-[calc(100vh-100px)] pb-[1%] m-[1%]' : 'min-h-full pb-[1%] m-[1%]'}`}>
              <Routes>
                <Route path="/" element={<DashboardMetricas triggerAtualizacao={triggerAtualizacao} usuarioAtual={usuarioAtual} onOpenDetails={abrirDetalhes} />} />
                <Route path="/emprestimos" element={<div className="animate-in fade-in duration-500"><DashboardEmprestimos itens={itens} /></div>} />
                <Route path="/estoque" element={<div className="h-full grid grid-cols-1 xl:grid-cols-3 gap-8 lg:gap-10 animate-in fade-in duration-500 items-stretch"><div className="xl:col-span-1 h-full"><CadastroItem onItemCadastrado={() => setTriggerAtualizacao(t => t + 1)} /></div><div className="xl:col-span-2 h-full"><GestaoEstoqueList itens={itens} onItemEditadoOrExcluido={() => setTriggerAtualizacao(t => t + 1)} onRefresh={() => setTriggerAtualizacao(t => t + 1)} /></div></div>} />
                <Route path="/saidas" element={<div className="h-full animate-in fade-in duration-500 flex flex-col"><NovoEmprestimo itensDisponiveis={itens} usuarioAtual={usuarioAtual} onEmprestimoRealizado={() => { setTriggerAtualizacao(t => t + 1); mudarAba('entradas'); }} onOpenDetails={(tipo, dados) => abrirDetalhes(tipo, dados)} /></div>} />
                <Route path="/entradas" element={<div className="h-full animate-in fade-in duration-500"><ListaEmprestimosAtivos triggerAtualizacao={triggerAtualizacao} onDevolucao={() => setTriggerAtualizacao(t => t + 1)} onOpenDetails={(dados) => abrirDetalhes('emprestimo', dados)} /></div>} />
                <Route path="/agenda" element={<div className="animate-in fade-in duration-500 h-full w-full pb-0"><AgendaEstiloGoogle usuarioAtual={usuarioAtual} /></div>} />
                <Route path="/calendario" element={<div className="animate-in fade-in duration-500"><CalendarioAgendamentos itensDisponiveis={itens} onOpenDetails={(tipo, dados) => abrirDetalhes(tipo, dados)} /></div>} />
                <Route path="/relatorios" element={<div className="animate-in fade-in duration-500"><RelatoriosExportacao /></div>} />
                <Route path="/manutencoes" element={<div className="animate-in fade-in duration-500"><Manutencoes /></div>} />
                <Route path="/portal" element={<div className="animate-in fade-in duration-500 h-full"><PortalSolicitante usuarioAtual={usuarioAtual} isEmbedded={true} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} externalAba={abaPortal} setExternalAba={setAbaPortal} /></div>} />
                <Route path="/bot_conhecimento" element={<div className="animate-in fade-in duration-500"><KnowledgeBot /></div>} />
                <Route path="/chamados_externos" element={<div className="animate-in fade-in duration-700"><ChamadosAdmin onOpenDetails={(dados) => abrirDetalhes('chamado', dados)} /></div>} />
                <Route path="/impressoras" element={<div className="animate-in fade-in duration-700"><PrintersAdmin /></div>} />
                <Route path="/perfil" element={<div className="animate-in fade-in duration-500 pt-4"><EditarPerfil usuarioAtual={usuarioAtual} onPerfilAtualizado={handleUpdatePerfilComplete} /></div>} />
                <Route path="/:ano/:serial" element={itemDetalhado ? <div className="h-full animate-in fade-in duration-500 px-4 md:px-6 pt-0 pb-0"><DetalhesGerencial itemDetalhado={itemDetalhado} setItemDetalhado={setItemDetalhado} onVoltar={voltarDosDetalhes} onUpdateItem={() => setTriggerAtualizacao(t => t + 1)} /></div> : loadingDetalhe ? <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-[var(--accent)]/10 border-t-[var(--accent)] rounded-full animate-spin" /></div> : <Navigate to="/" replace />} />
                <Route path="/:protocoloUnico" element={itemDetalhado ? <div className="h-full animate-in fade-in duration-500 px-4 md:px-6 pt-0 pb-0"><DetalhesGerencial itemDetalhado={itemDetalhado} setItemDetalhado={setItemDetalhado} onVoltar={voltarDosDetalhes} onUpdateItem={() => setTriggerAtualizacao(t => t + 1)} /></div> : loadingDetalhe ? <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-[var(--accent)]/10 border-t-[var(--accent)] rounded-full animate-spin" /></div> : <Navigate to="/" replace />} />
                <Route path="/detalhes" element={itemDetalhado ? <div className="h-full animate-in fade-in duration-500 px-4 md:px-6 pt-0 pb-0"><DetalhesGerencial itemDetalhado={itemDetalhado} setItemDetalhado={setItemDetalhado} onVoltar={voltarDosDetalhes} onUpdateItem={() => setTriggerAtualizacao(t => t + 1)} /></div> : loadingDetalhe ? <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-[var(--accent)]/10 border-t-[var(--accent)] rounded-full animate-spin" /></div> : <Navigate to="/" replace />} />
              </Routes>
            </div>
          </div>
        )}
      </main>
      <ChatBotIA />
    </div>
  );
}

