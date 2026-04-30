// src/App.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './utils/supabaseClient';
import {
  Home, Activity, CalendarDays, FileText, Settings,
  Search, Bell, LogOut,
  ChevronUp, ChevronDown, ArrowUpRight, ArrowDownLeft, X, Trash2,
  Menu, Sun, Moon, Globe, Inbox, AlertTriangle, ArrowRight, ArrowLeft, CheckCircle2, ListChecks, Music, LayoutGrid, Printer, MessageSquare, Sparkles, Calendar
} from 'lucide-react';
import Login from './Login';
import DashboardMetricas from './DashboardMetricas';
import FeedResumo from './FeedResumo';
import CadastroItem from './CadastroItem';
import GestaoEstoqueList from './GestaoEstoqueList';
import NovoEmprestimo from './NovoEmprestimo';
import ListaEmprestimosAtivos from './ListaEmprestimosAtivos';
import EditarPerfil from './EditarPerfil';
import CalendarioAgendamentos from './CalendarioAgendamentos';
import PortalSolicitante from './PortalSolicitante';
import RelatoriosExportacao from './RelatoriosExportacao';
import DocumentosAssinados from './DocumentosAssinados';
import ChamadosAdmin from './ChamadosAdmin';
import PrintersAdmin from './PrintersAdmin';
import DetalhesGerencial from './DetalhesGerencial';
import KnowledgeBot from './KnowledgeBot';
import ChatBotIA from './components/ChatBotIA';
import AgendaEstiloGoogle from './AgendaEstiloGoogle';
import { fetchGLPIInventory } from './utils/glpiClient';
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

const rotasGlobais = [
  { id: 'dashboard', nome: 'Dashboard', icon: Home, keywords: ['home', 'inicio', 'painel', 'metricas', 'resumo'] },
  { id: 'agenda', nome: 'Minha Agenda', icon: Calendar, keywords: ['agenda', 'compromissos', 'google', 'calendario', 'atividades', 'eventos'] },
  { id: 'feed', nome: 'Feed de Operações', icon: Inbox, keywords: ['inbox', 'caixa', 'alertas', 'atrasos', 'notificacoes'] },
  { id: 'estoque', nome: 'Inventário Global', icon: Activity, keywords: ['estoque', 'produtos', 'ativos', 'cadastro', 'lista', 'adicionar'] },
  { id: 'saidas', nome: 'Registro de Saídas', icon: ArrowUpRight, keywords: ['saida', 'saídas', 'emprestimo', 'emprestar', 'retirada', 'checkout', 'novo'] },
  { id: 'entradas', nome: 'Gestão de Devoluções', icon: ArrowDownLeft, keywords: ['entrada', 'entradas', 'devolucao', 'devolucoes', 'receber', 'retorno'] },
  { id: 'localizacoes', nome: 'Localização por Setor', icon: Globe, keywords: ['setor', 'localizacao', 'onde está', 'posse', 'ativos por área'] },
  { id: 'calendario', nome: 'Calendários de Agendamento', icon: CalendarDays, keywords: ['agenda', 'agendamento', 'reserva', 'datas'] },
  { id: 'chamados_externos', nome: 'Chamados', icon: LayoutGrid, keywords: ['chamado', 'externo', 'ajuda', 'suporte', 'helpdesk', 'web', 'tickets'] },
  { id: 'impressoras', nome: 'Impressoras', icon: Printer, keywords: ['impressora', 'toner', 'impressao', 'papel', 'manutencao'] },
  { id: 'bot_conhecimento', nome: 'Bot de Conhecimento', icon: MessageSquare, keywords: ['bot', 'ia', 'ajuda', 'pesquisa', 'conhecimento', 'perguntas', 'pergunta', 'experimental'] },
  { id: 'documentos', nome: 'Arquivo de Documentos', icon: FileText, keywords: ['documento', 'termo', 'assinado', 'arquivo', 'comprovante', 'pdf', 'assinatura'] },
  { id: 'relatorios', nome: 'Inteligência e Relatórios', icon: ListChecks, keywords: ['relatorio', 'exportar', 'csv', 'dados', 'tudo', 'transacoes passadas', 'excel', 'exportação'] },
  { id: 'perfil', nome: 'Configurações de Conta', icon: Settings, keywords: ['perfil', 'conta', 'senha', 'ajustes', 'sair', 'foto', 'username'] },
  { id: 'dashboard#historico-dashboard', nome: 'Histórico de Transações (Dashboard)', icon: ListChecks, keywords: ['historico', 'transacoes', 'auditoria', 'quem pegou', 'quem devolveu', 'entradas e saídas', 'timeline', 'lista de emprestimos'] }
];

export default function App() {
  const [usuarioAtual, setUsuarioAtual] = useState(null);
  const [modoPortal, setModoPortal] = useState(false);
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
  const [itemDetalhado, setItemDetalhado] = useState(null);
  const [triggerAtualizacao, setTriggerAtualizacao] = useState(0);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGestaoOpen, setIsGestaoOpen] = useState(() => {
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

  const [seenFeedIds, setSeenFeedIds] = useState(() => {
    const salvos = localStorage.getItem('tilend_seen_feed_ids');
    return salvos ? JSON.parse(salvos) : [];
  });

  useEffect(() => { localStorage.setItem('tilend_ids_excluidos', JSON.stringify(idsExcluidos)); }, [idsExcluidos]);
  useEffect(() => { localStorage.setItem('tilend_sidebar_open', JSON.stringify(isSidebarOpen)); }, [isSidebarOpen]);
  useEffect(() => { localStorage.setItem('tilend_gestao_open', JSON.stringify(isGestaoOpen)); }, [isGestaoOpen]);

  const [itens, setItens] = useState([]);
  const [hasUnreadFeed, setHasUnreadFeed] = useState(false);
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
  const REDIRECT_URI = 'http://127.0.0.1:5173/sistema-emprestimos/';

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
    const codeVerifier = sessionStorage.getItem('spotify_code_verifier');
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
      }
    } catch (err) {
      console.error('Erro de troca de código:', err);
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
      alert("⚠️ BLOQUEIO DO SPOTIFY: O Spotify não permite login através de endereços de IP (como " + window.location.hostname + ") sem uma conexão segura HTTPS.\n\nPor favor, acesse o sistema através de:\nhttp://localhost:5173/sistema-emprestimos/\nou\n");
      return;
    }

    const codeVerifier = generateRandomString(64);
    sessionStorage.setItem('spotify_code_verifier', codeVerifier);

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
      const idSalvo = localStorage.getItem('tilend_user_id');
      if (idSalvo) {
        const { data: perfil } = await supabase
          .from('perfil')
          .select('*')
          .eq('id', idSalvo)
          .single();

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
        }
      }
    };
    checarUsuario();
  }, []);

  // HEARTBEAT: Atualiza o status "online" do usuário logado (perfil.updated_at)
  useEffect(() => {
    if (!usuarioAtual) return;

    const heartbeat = async () => {
      try {
        await supabase
          .from('perfil')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', usuarioAtual.id);
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

  // MOTOR CENTRAL DE NOTIFICAÇÕES (Híbrido: Supabase Legado + GLPI Oficial)
  useEffect(() => {
    if (usuarioAtual && usuarioAtual.get('tipoUsuario') !== 'solicitante') {
      const fetchData = async () => {
        try {
          const umDiaAtras = new Date(); umDiaAtras.setDate(umDiaAtras.getDate() - 1);
          const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

          // 1. DADOS DO SUPABASE (Fonte de Verdade)
          const queries = [
            supabase.from('item').select('id, nome_equipamento, quantidade, modelo_detalhes, numero_serie, bloqueado_insumo, glpi_id, glpi_type, glpi_ref'),
            supabase.from('emprestimo').select('id, protocolo, item_id, status_emprestimo, quantidade_emprestada, created_at, nome_solicitante, item(id, nome_equipamento), glpi_item_id, observacoes').eq('status_emprestimo', 'Aberto').limit(200),
            supabase.from('emprestimo').select('id, protocolo, item_id, status_emprestimo, quantidade_emprestada, data_hora_retorno, updated_at, nome_solicitante, item(id, nome_equipamento)').eq('status_emprestimo', 'Devolvido').gte('data_hora_retorno', startOfToday.toISOString()).limit(50),
            supabase.from('emprestimo').select('id, protocolo, item_id, nome_solicitante, status_emprestimo, created_at, updated_at, item(id, nome_equipamento)').in('status_emprestimo', ['Pendente', 'Aprovado']).limit(100),
            supabase.from('agenda_eventos').select('*').or(`tecnico.eq.${usuarioAtual.get('username')},participantes.cs.["${usuarioAtual.get('username')}"]`).eq('lembrete', true).gte('inicio', new Date().toISOString()).limit(15)
          ];

          let results = await Promise.all(queries);

          // Fallback para lembretes caso a coluna participantes não exista
          if (results[4].error) {
            console.warn("Erro lembretes participantes, tentando fallback...");
            results[4] = await supabase.from('agenda_eventos').select('*').eq('tecnico', usuarioAtual.get('username')).eq('lembrete', true).gte('inicio', new Date().toISOString()).limit(10);
          }

          const [resItens, resAbertosSupa, resRetornosSupa, resAgendamentosSupa, resLembretesSupa] = results;

          // 2. NOVOS DADOS DO GLPI (Motor Oficial)
          const { fetchGLPITickets } = await import('./utils/glpiClient');
          const [ticketsAbertosGLPI, ticketsFechadosGLPI] = await Promise.all([
            fetchGLPITickets({ status: '1,2,3,4' }), // Não resolvidos
            fetchGLPITickets({ status: '5,6' })      // Solucionados/Fechados
          ]);

          // 3. PROCESSAR DISPONIBILIDADE REAL (Estoque Supabase - Empréstimos Ativos)
          if (resItens.data) {
            const itensBase = resItens.data;
            const emprestimosAtivos = resAbertosSupa.data || [];

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

          // Processar Supabase Legado (Abertos, Retornos, Agendamentos)
          if (resAbertosSupa.data) {
            resAbertosSupa.data.forEach(emp => {
              const createdAt = new Date(emp.created_at);
              const isAtraso = createdAt < umDiaAtras;
              arrayNotificacoesBrutas.push({
                id: `${isAtraso ? 'atraso' : 'saida'}-supa-${emp.id}`,
                tipo: isAtraso ? 'atraso' : 'saida',
                protocolo: emp.protocolo,
                item: emp.item?.nome_equipamento || 'Equipamento',
                solicitante: emp.nome_solicitante || 'LEGADO',
                data: isAtraso ? new Date(createdAt.getTime() + (24 * 60 * 60 * 1000)) : createdAt
              });
            });
          }
          if (resRetornosSupa.data) {
            resRetornosSupa.data.forEach(emp => {
              const dataRetorno = emp.data_hora_retorno ? new Date(emp.data_hora_retorno) : new Date(emp.updated_at);
              arrayNotificacoesBrutas.push({ id: `retorno-supa-${emp.id}`, tipo: 'retorno', protocolo: emp.protocolo, item: emp.item?.nome_equipamento || 'Equipamento', solicitante: emp.nome_solicitante || 'LEGADO', data: dataRetorno });
            });
          }

          // Processar Lembretes de Tarefa (30 minutos antes)
          if (resLembretesSupa.data) {
            const trintaMinutosEmMs = 30 * 60 * 1000;
            const agora = new Date();
            resLembretesSupa.data.forEach(ev => {
              const inicio = new Date(ev.inicio);
              const diff = inicio.getTime() - agora.getTime();

              // Se falta menos de 30 minutos (e ainda não começou)
              if (diff > 0 && diff <= trintaMinutosEmMs) {
                arrayNotificacoesBrutas.push({
                  id: `lembrete-task-${ev.id}`,
                  tipo: 'atraso', // Reutilizando estilo de alerta para chamar atenção
                  protocolo: `AGENDA`,
                  item: ev.titulo,
                  solicitante: `Sua tarefa começa às ${inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
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

          const newNotifs = arrayNotificacoesBrutas.sort((a, b) => b.data.getTime() - a.data.getTime()).slice(0, 40);
          setNotificacoes(newNotifs);

          const unseenList = newNotifs.filter(n => !seenNotifIds.includes(n.id) && !idsExcluidos.includes(n.id));
          const hasUnseenNotifs = unseenList.length > 0;
          setUnreadCount(unseenList.length);

          if (hasUnseenNotifs && !notificacoesAberto) setHasUnreadNotifs(true);
          else setHasUnreadNotifs(false);

          const hasUnseenFeed = newNotifs.some(n => !seenFeedIds.includes(n.id) && !idsExcluidos.includes(n.id));
          if (hasUnseenFeed && abaAtiva !== 'feed') setHasUnreadFeed(true);
          else setHasUnreadFeed(false);

        } catch (e) { console.error(e); }
      };
      fetchData();
    }
  }, [triggerAtualizacao, usuarioAtual]);

  useEffect(() => {
    if (abaAtiva === 'feed' && notificacoes.length > 0) {
      setHasUnreadFeed(false);
      setSeenFeedIds(prev => {
        const newSeen = [...new Set([...prev, ...notificacoes.map(n => n.id)])];
        localStorage.setItem('tilend_seen_feed_ids', JSON.stringify(newSeen));
        return newSeen;
      });
    }
  }, [abaAtiva, notificacoes]);

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
  };

  const abrirDetalhes = (tipo, dados) => {
    setItemDetalhado({ tipo, dados });

    // Se tiver protocolo e não for apenas um ID com hash
    if (dados?.protocolo && !dados.protocolo.startsWith('#')) {
      navigate(`/${dados.protocolo}`);
    } else {
      navigate('/detalhes');
    }
  };

  const voltarDosDetalhes = () => {
    navigate(-1);
  };
  const handleLogout = async () => { localStorage.removeItem('tilend_user_id'); setUsuarioAtual(null); navigate('/'); setModoPortal(false); };


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

  if (!usuarioAtual) {
    return (
      <div key="view-login">
        <Login
          onLoginSucesso={(u) => { setUsuarioAtual(u); setTriggerAtualizacao(t => t + 1); }}
          onAbrirPortal={() => setModoPortal(true)}
          onVoltarLogin={() => setModoPortal(false)}
          isPortal={modoPortal}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
        />
      </div>
    );
  }

  if (usuarioAtual.get('tipoUsuario') === 'solicitante' || modoPortal) {
    return <PortalSolicitante usuarioAtual={usuarioAtual} onLogout={handleLogout} onVoltar={usuarioAtual.get('tipoUsuario') !== 'solicitante' ? () => setModoPortal(false) : undefined} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
  }

  const notificacoesVisiveis = notificacoes.filter(n => !idsExcluidos.includes(n.id));
  const isGestaoActive = abaAtiva === 'estoque' || abaAtiva === 'saidas' || abaAtiva === 'entradas';

  const headerInfo = {
    'dashboard': { label: 'Dashboard', icon: Home },
    'feed': { label: 'Feed de Operações', icon: Inbox },
    'estoque': { label: 'Inventário Global', icon: Activity },
    'saidas': { label: 'Registro de Saídas', icon: ArrowUpRight },
    'entradas': { label: 'Gestão de Devoluções', icon: ArrowDownLeft },
    'localizacoes': { label: 'Localização por Setor', icon: Globe },
    'calendario': { label: 'Calendários de Agendamento', icon: CalendarDays },
    'agenda': { label: 'Agenda', icon: CalendarDays },
    'relatorios': { label: 'Inteligência e Relatórios', icon: FileText },
    'chamados_externos': { label: 'Chamados', icon: LayoutGrid },
    'impressoras': { label: 'Gestão de Impressoras', icon: Printer },
    'bot_conhecimento': { label: 'Bot de Conhecimento', icon: MessageSquare },
    'perfil': { label: 'Configurações de Conta', icon: Settings },
    'detalhes': { label: 'Detalhamento Técnico', icon: ArrowLeft }
  };

  const HeaderIcon = headerInfo[abaAtiva]?.icon || Home;
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

      <aside className={`no-print fixed inset-y-0 left-0 z-[9999] p-[0.6vw] bg-[var(--bg-page)] flex flex-col h-screen transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 overflow-visible ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
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
            <button onClick={() => mudarAba('dashboard')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'dashboard' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'dashboard' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
              <Home size={18} className="shrink-0 transition-transform group-hover:scale-110" />
              <div className="sidebar-pill">Dashboard</div>
            </button>

            <button onClick={() => mudarAba('agenda')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'agenda' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'agenda' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
              <Calendar size={18} className="shrink-0 transition-transform group-hover:scale-110" />
              <div className="sidebar-pill">Agenda</div>
            </button>

            <button onClick={() => mudarAba('feed')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'feed' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'feed' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
              <div className="relative">
                <Inbox size={18} className="shrink-0 transition-transform group-hover:scale-110" />
                {hasUnreadFeed && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#8D3046] rounded-full animate-pulse shadow-[0_0_8px_0_#8D3046]"></div>}
              </div>
              <div className="sidebar-pill">Feed</div>
            </button>

            <div className="transition-all relative group">
              <button onClick={() => setIsGestaoOpen(!isGestaoOpen)} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${isGestaoActive ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                  <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${isGestaoActive ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
                <Activity size={18} className="shrink-0 transition-transform group-hover:scale-110" />
                <div className="sidebar-pill">Empréstimos</div>
              </button>

              {isGestaoOpen && (
                <div className="flex flex-col items-center gap-3 mt-2 pb-4 pt-2">
                  <button onClick={() => mudarAba('estoque')} className={`w-full flex items-center justify-center py-3 transition-all relative group cursor-pointer hover:bg-[var(--bg-soft)] dark:hover:bg-[var(--bg-card)]/5 rounded-xl ${abaAtiva === 'estoque' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white'}`}>
                    <div className={`rounded-sm bg-[#254E70] shrink-0 w-2 h-2 ${abaAtiva === 'estoque' ? 'shadow-[0_0_8px_0_#254E70]' : ''}`}></div>
                    <div className="sidebar-pill">Estoque</div>
                  </button>
                  <button onClick={() => mudarAba('saidas')} className={`w-full flex items-center justify-center py-3 transition-all relative group cursor-pointer hover:bg-[var(--bg-soft)] dark:hover:bg-[var(--bg-card)]/5 rounded-xl ${abaAtiva === 'saidas' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white'}`}>
                    <div className={`rounded-sm bg-[#8D3046] shrink-0 w-2 h-2 ${abaAtiva === 'saidas' ? 'shadow-[0_0_8px_0_#8D3046]' : ''}`}></div>
                    <div className="sidebar-pill">Saídas</div>
                  </button>
                  <button onClick={() => mudarAba('entradas')} className={`w-full flex items-center justify-center py-3 transition-all relative group cursor-pointer hover:bg-[var(--bg-soft)] dark:hover:bg-[var(--bg-card)]/5 rounded-xl ${abaAtiva === 'entradas' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white'}`}>
                    <div className={`rounded-sm bg-[#254E70] shrink-0 w-2 h-2 ${abaAtiva === 'entradas' ? 'shadow-[0_0_8px_0_#254E70]' : ''}`}></div>
                    <div className="sidebar-pill">Entradas</div>
                  </button>
                  <button onClick={() => mudarAba('calendario')} className={`w-full flex items-center justify-center py-3 transition-all relative group cursor-pointer hover:bg-[var(--bg-soft)] dark:hover:bg-[var(--bg-card)]/5 rounded-xl ${abaAtiva === 'calendario' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white'}`}>
                    <div className={`rounded-sm bg-[#8D3046] shrink-0 w-2 h-2 ${abaAtiva === 'calendario' ? 'shadow-[0_0_8px_0_#8D3046]' : ''}`}></div>
                    <div className="sidebar-pill">Reservas</div>
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => mudarAba('chamados_externos')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'chamados_externos' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'chamados_externos' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
              <LayoutGrid size={18} className="shrink-0 transition-transform group-hover:scale-110" />
              <div className="sidebar-pill">Chamados</div>
            </button>

            <button onClick={() => mudarAba('impressoras')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'impressoras' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'impressoras' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
              <Printer size={18} className="shrink-0 transition-transform group-hover:scale-110" />
              <div className="sidebar-pill">Impressoras</div>
            </button>

            <button onClick={() => mudarAba('bot_conhecimento')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'bot_conhecimento' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#254E70] shadow-[0_0_12px_rgba(37,78,112,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'bot_conhecimento' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
              <div className="relative">
                <MessageSquare size={18} className="shrink-0 transition-transform group-hover:scale-110" />
                <Sparkles size={10} className="absolute -top-1.5 -right-1.5 text-[#254E70] animate-pulse" strokeWidth={3} />
              </div>
              <div className="sidebar-pill">Conhecimento</div>
            </button>

            <button onClick={() => mudarAba('relatorios')} className={`w-full flex items-center justify-center py-3.5 transition-all relative group cursor-pointer ${abaAtiva === 'relatorios' ? 'text-[#254E70]' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}>
                <div className={`absolute left-[-0.6vw] w-[5px] rounded-r-full bg-[#8D3046] shadow-[0_0_12_rgba(141,48,70,0.6)] transition-all duration-300 top-1/2 -translate-y-1/2 ${abaAtiva === 'relatorios' ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-6 group-hover:opacity-100'}`}></div>
              <FileText size={18} className="shrink-0 transition-transform group-hover:scale-110" />
              <div className="sidebar-pill">Relatórios</div>
            </button>
          </div>
        </div>

        <div className="shrink-0 flex flex-col gap-1 relative">

          <div className="relative w-full mt-2">
            {menuPerfilPopoverAberto && (
              <div className="absolute bottom-[calc(100%+12px)] left-0 w-56 bg-[var(--bg-card)] rounded-2xl z-50 animate-in slide-in-from-bottom-2 flex flex-col border border-slate-200 dark:border-white/10 shadow-2xl">
                <button onClick={() => { mudarAba('perfil'); setMenuPerfilPopoverAberto(false); }} className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-[var(--bg-hover)] dark:hover:bg-white/5 transition-all duration-300 font-medium border-b border-slate-100 dark:border-white/5 rounded-t-2xl">
                  <Settings size={16} className="shrink-0 text-[#254E70]" /> Editar Perfil
                </button>
                <button onClick={() => { setModoPortal(true); setMenuPerfilPopoverAberto(false); }} className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-[var(--bg-hover)] dark:hover:bg-white/5 transition-all duration-300 font-medium border-b border-slate-100 dark:border-white/5">
                  <Globe size={16} className="shrink-0 text-[#10B981]" /> Ir para Portal Público
                </button>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-[#8D3046] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-400/10 transition-all duration-300 font-medium rounded-b-2xl">
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
        <header className={`no-print flex items-center p-[0.6vw] justify-between shrink-0 bg-[var(--bg-page)]/70 backdrop-blur-xl transition-all duration-300 ${spotifyAberto || notificacoesAberto ? 'z-[10000]' : 'z-30'}`}>
          <div className={`flex items-center gap-4 ${abaAtiva === 'detalhes' ? 'cursor-pointer hover:opacity-70 transition-all' : ''}`} onClick={abaAtiva === 'detalhes' ? voltarDosDetalhes : undefined}>
            <div className="p-3 bg-[var(--bg-card)] rounded-2xl flex items-center gap-2 text-slate-900 dark:text-white shadow-sm transition-all duration-500">
              <HeaderIcon size={18} strokeWidth={2} className={`${abaAtiva === 'saidas' || abaAtiva === 'localizacoes' ? 'text-[#8D3046]' :
                abaAtiva === 'estoque' || abaAtiva === 'entradas' ? 'text-[#254E70]' :
                  'text-slate-900 dark:text-white'
                }`} />
            </div>
            <div className="flex flex-col">
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
          </div>

          <div className="relative w-48 md:w-80 hidden sm:block z-50 ml-auto">
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
          </div>

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
                                const idReal = n.id.split('-').slice(1).join('-');
                                const tipoOrigem = n.tipo === 'pendente' || n.tipo === 'agendado' ? 'agendamento' : 'emprestimo';
                                abrirDetalhes(tipoOrigem, { id: idReal, protocolo: n.protocolo });
                              }}
                              className="p-5 rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-[var(--bg-page)] dark:hover:bg-[var(--bg-card)]/[0.02] bg-[var(--bg-card)] dark:bg-transparent transition-colors flex gap-4 group relative shadow-sm cursor-pointer"
                            >
                              <div className={`p-3 rounded-xl shrink-0 h-fit shadow-inner border border-transparent ${n.tipo === 'atraso' ? 'bg-[#8D3046]/10 text-[#8D3046] border-[#8D3046]/20' :
                                n.tipo === 'pendente' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                  n.tipo === 'agendado' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                    n.tipo === 'saida' ? 'bg-[#254E70]/10 text-[#254E70] border-[#254E70]/20' :
                                      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                                }`}>
                                {n.tipo === 'atraso' ? <AlertTriangle size={16} /> : n.tipo === 'pendente' ? <Globe size={16} /> : n.tipo === 'agendado' ? <CalendarDays size={16} /> : n.tipo === 'saida' ? <ArrowUpRight size={16} /> : <CheckCircle2 size={16} />}
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
                className="p-2.5 rounded-full text-slate-500 dark:text-[#A0A0A0] hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shrink-0"
                title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
              >
                {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
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

        <div className={`flex-1 custom-scrollbar ${abaAtiva === 'agenda' || abaAtiva === 'detalhes' || abaAtiva === 'chamados_externos' ? 'overflow-hidden' : 'overflow-y-auto'}`} onClick={() => { setNotificacoesAberto(false); setMenuPerfilPopoverAberto(false); setIsSearchOpen(false); }}>
          <div className={`border-r border-transparent border-b border-transparent flex flex-col ${abaAtiva === 'agenda' ? 'h-[calc(100vh-82px)] pb-0' : ['detalhes', 'chamados_externos', 'saidas', 'estoque'].includes(abaAtiva) ? 'h-[calc(100vh-100px)] pb-[1%]' : 'min-h-full pb-[1%]'} m-[1%]`}>
            <Routes>
              <Route path="/" element={<DashboardMetricas triggerAtualizacao={triggerAtualizacao} usuarioAtual={usuarioAtual} onOpenDetails={abrirDetalhes} />} />
              <Route path="/feed" element={<div className="animate-in fade-in duration-500"><FeedResumo onNavigate={mudarAba} triggerUpdate={triggerAtualizacao} onOperacaoFeed={() => setTriggerAtualizacao(t => t + 1)} onOpenDetails={abrirDetalhes} /></div>} />
              <Route path="/estoque" element={<div className="h-full grid grid-cols-1 xl:grid-cols-3 gap-8 lg:gap-10 animate-in fade-in duration-500 items-stretch"><div className="xl:col-span-1 h-full"><CadastroItem onItemCadastrado={() => setTriggerAtualizacao(t => t + 1)} /></div><div className="xl:col-span-2 h-full"><GestaoEstoqueList itens={itens} onItemEditadoOrExcluido={() => setTriggerAtualizacao(t => t + 1)} onRefresh={() => setTriggerAtualizacao(t => t + 1)} /></div></div>} />
              <Route path="/saidas" element={<div className="h-full animate-in fade-in duration-500 flex flex-col"><NovoEmprestimo itensDisponiveis={itens} usuarioAtual={usuarioAtual} onEmprestimoRealizado={() => { setTriggerAtualizacao(t => t + 1); mudarAba('entradas'); }} onOpenDetails={(tipo, dados) => abrirDetalhes(tipo, dados)} /></div>} />
              <Route path="/entradas" element={<div className="h-full animate-in fade-in duration-500"><ListaEmprestimosAtivos triggerAtualizacao={triggerAtualizacao} onDevolucao={() => setTriggerAtualizacao(t => t + 1)} onOpenDetails={(dados) => abrirDetalhes('emprestimo', dados)} /></div>} />

              <Route path="/agenda" element={<div className="animate-in fade-in duration-500 h-full w-full pb-0"><AgendaEstiloGoogle usuarioAtual={usuarioAtual} /></div>} />
              <Route path="/calendario" element={<div className="animate-in fade-in duration-500"><CalendarioAgendamentos itensDisponiveis={itens} onOpenDetails={(tipo, dados) => abrirDetalhes(tipo, dados)} /></div>} />
              <Route path="/relatorios" element={<div className="animate-in fade-in duration-500"><RelatoriosExportacao /></div>} />
              <Route path="/documentos" element={<div className="animate-in fade-in duration-500"><DocumentosAssinados /></div>} />
              <Route path="/bot_conhecimento" element={<div className="animate-in fade-in duration-500"><KnowledgeBot /></div>} />
              <Route path="/chamados_externos" element={<div className="animate-in fade-in duration-700"><ChamadosAdmin onOpenDetails={(dados) => abrirDetalhes('chamado', dados)} /></div>} />
              <Route path="/impressoras" element={<div className="animate-in fade-in duration-700"><PrintersAdmin /></div>} />
              <Route path="/perfil" element={<div className="animate-in fade-in duration-500 pt-4"><EditarPerfil usuarioAtual={usuarioAtual} onPerfilAtualizado={handleUpdatePerfilComplete} /></div>} />

              {/* Rota de Protocolo (Novo Padrão) */}
              <Route path="/:ano/:serial" element={<div className="h-full animate-in fade-in duration-500 px-4 md:px-6 pt-0 pb-10"><DetalhesGerencial itemDetalhado={itemDetalhado} setItemDetalhado={setItemDetalhado} onVoltar={voltarDosDetalhes} onUpdateItem={() => setTriggerAtualizacao(t => t + 1)} /></div>} />

              {/* Rota de Protocolo Único (Chamados) */}
              <Route path="/:protocoloUnico" element={<div className="h-full animate-in fade-in duration-500 px-4 md:px-6 pt-0 pb-10"><DetalhesGerencial itemDetalhado={itemDetalhado} setItemDetalhado={setItemDetalhado} onVoltar={voltarDosDetalhes} onUpdateItem={() => setTriggerAtualizacao(t => t + 1)} /></div>} />

              {/* Fallback para Detalhes Legado ou URL Direta */}
              <Route path="/detalhes" element={<div className="h-full animate-in fade-in duration-500 px-4 md:px-6 pt-0 pb-10"><DetalhesGerencial itemDetalhado={itemDetalhado} setItemDetalhado={setItemDetalhado} onVoltar={voltarDosDetalhes} onUpdateItem={() => setTriggerAtualizacao(t => t + 1)} /></div>} />
            </Routes>
          </div>
        </div>
      </main>
      <ChatBotIA />
    </div>
  );
}

