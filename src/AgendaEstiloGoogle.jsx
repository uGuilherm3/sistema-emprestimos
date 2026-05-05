import React, { useState, useEffect, useMemo } from 'react';
import { api } from './utils/apiClient';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Clock,
  User,
  MoreHorizontal,
  X,
  Filter,
  CheckCircle2,
  Calendar as CalendarIcon,
  Edit2,
  AlertTriangle,
  Trash2,
  ExternalLink,
  MoreVertical,
  Upload,
  Heart,
  Plus,
  Bell
} from 'lucide-react';

const AgendaEstiloGoogle = ({ usuarioAtual }) => {
  // SIMULAÇÃO DE USUÁRIO LOGADO (Agora vindo das props se disponível)
  const currentUser = usuarioAtual?.get('username') || 'Guilherme';
  const isAdmin = usuarioAtual?.get('tipoUsuario') === 'adm';

  const getFotoPerfilUrl = () => {
    if (!usuarioAtual) return null;
    const foto = usuarioAtual.get('foto_perfil');
    return (foto && typeof foto.url === 'function') ? foto.url() : null;
  };

  const arredondarHorario = (timeString) => {
    if (!timeString) return timeString;
    const [h, m] = timeString.split(':');
    let hour = parseInt(h);
    let mins = parseInt(m);

    if (mins >= 15 && mins < 45) {
      mins = 30;
    } else if (mins >= 45) {
      mins = 0;
      hour = (hour + 1) % 24;
    } else {
      mins = 0;
    }

    return `${hour.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // ESTADOS
  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [abaAgenda, setAbaAgenda] = useState('Agenda');
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [mouseY, setMouseY] = useState(null);
  const [mouseCol, setMouseCol] = useState(null);
  const [mouseTime, setMouseTime] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [perfis, setPerfis] = useState({}); // Mapa de username -> dados do perfil (incluindo foto)

  // ESTADO DO CLIMA REAL
  const [clima, setClima] = useState({
    temp: '--',
    condicao: 'Carregando...',
    icon: 'overcast',
    fallbackIcon: <CalendarIcon size={24} />
  });

  // ESTADOS DE ARRASTE (ESTILO GOOGLE CALENDAR)
  const [dragState, setDragState] = useState({
    isDragging: false,
    startCol: null,
    startTime: null,
    endTime: null,
    yStart: 0,
    yCurrent: 0
  });

  useEffect(() => {
    const fetchWeather = async (lat, lon) => {
      try {
        const dateStr = dataSelecionada.toISOString().split('T')[0];
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataSelMeiaNoite = new Date(dataSelecionada);
        dataSelMeiaNoite.setHours(0, 0, 0, 0);

        const diffDays = Math.ceil((hoje - dataSelMeiaNoite) / (1000 * 60 * 60 * 24));

        // Determina qual API usar: Archive para passado distante (> 2 dias), Forecast para o resto
        const isArchive = diffDays > 2;
        const baseUrl = isArchive
          ? 'https://archive-api.open-meteo.com/v1/archive'
          : 'https://api.open-meteo.com/v1/forecast';

        const response = await fetch(`${baseUrl}?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&hourly=temperature_2m,weathercode&timezone=auto`);
        const data = await response.json();

        if (!data.hourly) return;

        // Pegamos o clima das 12:00 para representar o dia
        const weatherCode = data.hourly.weathercode[12];
        const temp = data.hourly.temperature_2m[12];
        const isDay = true; // No resumo diário, focamos no clima do dia

        const mapping = {
          0: { label: 'Céu Limpo', icon: isDay ? 'clear-day' : 'clear-night', fallback: <CheckCircle2 /> },
          1: { label: 'Limpo', icon: isDay ? 'clear-day' : 'clear-night', fallback: <CheckCircle2 /> },
          2: { label: 'Nublado', icon: isDay ? 'partly-cloudy-day' : 'partly-cloudy-night', fallback: <Filter /> },
          3: { label: 'Encoberto', icon: 'overcast', fallback: <Filter /> },
          45: { label: 'Nevoeiro', icon: 'fog', fallback: <Filter /> },
          48: { label: 'Nevoeiro', icon: 'fog', fallback: <Filter /> },
          51: { label: 'Garoa', icon: 'drizzle', fallback: <Clock /> },
          61: { label: 'Chuva', icon: 'rain', fallback: <Clock /> },
          63: { label: 'Chuva', icon: 'rain', fallback: <Clock /> },
          71: { label: 'Neve', icon: 'snow', fallback: <Clock /> },
          80: { label: 'Pancadas de Chuva', icon: 'rain', fallback: <Clock /> },
          95: { label: 'Tempestade', icon: 'thunderstorms', fallback: <AlertTriangle /> },
        };

        const current = mapping[weatherCode] || { label: 'Nublado', icon: 'cloudy', fallback: <Filter /> };

        setImgError(false);
        setClima({
          temp: Math.round(temp),
          condicao: current.label,
          icon: current.icon,
          fallbackIcon: current.fallback
        });
      } catch (error) {
        console.error("Erro ao buscar clima histórico:", error);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(-23.5505, -46.6333)
      );
    } else {
      fetchWeather(-23.5505, -46.6333);
    }
  }, [dataSelecionada]); // Agora dispara ao mudar de data!

  // CORES PRÉ-DEFINIDAS
  const PRESET_COLORS = ['#EAE4E4', '#DCE4F1', '#ECF9CE', '#FFE2FF', '#FFFFD9', '#FFCBCA', '#D3F2D9', '#E0DAE8', '#C5D8DB', '#DBD1C2', '#E2DBF4', '#FAD4BA', '#C4CFE0', '#C6D6C3'];

  // ESTADOS DO FORMULÁRIO
  const [isFormAberto, setIsFormAberto] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    titulo: '',
    categoria: 'Tarefa',
    data: new Date().toISOString().split('T')[0],
    inicio: '10:00',
    fim: '11:00',
    cor: '#EAE4E4',
    descricao: '',
    detalhes: '',
    link: '',
    fixado: false,
    lembrete: false,
    banner: '',
    apresentacao: '',
    participantes: []
  });

  // PALETA DE CORES
  const categorias = [
    { id: 'Todas', nome: 'Todas' },
    {
      id: 'Eventos',
      nome: 'Eventos',
      bg: 'bg-[#F0FFF4] dark:bg-[#1A2E21]',
      accent: '#38A169'
    },
    {
      id: 'Tarefa',
      nome: 'Tarefa',
      bg: 'bg-[#F2F2F2] dark:bg-[#1A1A1A]',
      accent: 'var(--accent)'
    },
    {
      id: 'Urgente',
      nome: 'Urgente',
      bg: 'bg-[#FFF5F5] dark:bg-[#3A1E1E]',
      accent: '#E53E3E'
    }
  ];

  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchEventos = async () => {
    setLoading(true);
    try {
      const { data, error } = await api.agenda.list({ tecnico: currentUser });
      if (error) throw new Error(error);
      processarEventos(data);
    } catch (err) {
      console.error("Erro inesperado ao buscar eventos:", err);
      setErrorMessage("Erro ao buscar eventos da agenda.");
    } finally {
      setLoading(false);
    }
  };

  const processarEventos = (data) => {
    const eventosFormatados = (data || []).map(ev => ({
      ...ev,
      inicio: new Date(ev.inicio),
      fim: new Date(ev.fim),
      descricao: Array.isArray(ev.descricao) ? ev.descricao : (ev.descricao ? JSON.parse(ev.descricao) : []),
      participantes: Array.isArray(ev.participantes) ? ev.participantes : (ev.participantes ? (typeof ev.participantes === 'string' ? JSON.parse(ev.participantes) : []) : [])
    }));
    setEventos(eventosFormatados);
  };

  const handleLike = async (evento) => {
    try {
      const novosEventos = eventos.map(e =>
        e.id === evento.id ? { ...e, likes: (e.likes || 0) + 1 } : e
      );
      setEventos(novosEventos);
      const { error } = await api.agenda.update(evento.id, { likes: (evento.likes || 0) + 1 });
      if (error) { setEventos(eventos); console.error("Erro ao salvar curtida:", error); }
    } catch (err) {
      console.error("Erro inesperado ao curtir:", err);
    }
  };

  // BUSCAR PERFIS DOS TÉCNICOS
  const fetchPerfis = async () => {
    try {
      const { data } = await api.agenda.perfis();
      if (data) {
        const map = {};
        data.forEach(p => { map[p.username] = p.foto_perfil; });
        setPerfis(map);
      }
    } catch (e) { console.error("Erro ao buscar perfis:", e); }
  };

  useEffect(() => {
    fetchEventos();
    fetchPerfis();
  }, []);

  const getDiasSemana = (data) => {
    const d = new Date(data);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const start = new Date(d.setDate(diff));
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    });
  };

  const diasExibidos = useMemo(() => getDiasSemana(dataSelecionada), [dataSelecionada]);
  const horas = Array.from({ length: 17 }, (_, i) => i + 7);

  const formatHora = (h) => `${h.toString().padStart(2, '0')}:00`;

  const eventosFiltrados = useMemo(() => {
    return eventos.filter(e => filtroCategoria === 'Todas' || e.categoria === filtroCategoria);
  }, [eventos, filtroCategoria]);

  const eventosNoDiaSelecionado = useMemo(() => {
    return eventos.filter(ev => ev.inicio.toDateString() === dataSelecionada.toDateString());
  }, [eventos, dataSelecionada]);

  const [apresentacaoIdx, setApresentacaoIdx] = useState(0);

  // Efeito para carrossel de apresentações no resumo do dia
  useEffect(() => {
    const comApres = eventosNoDiaSelecionado.filter(e => e.apresentacao);
    if (comApres.length <= 1) {
      setApresentacaoIdx(0);
      return;
    }

    const timer = setInterval(() => {
      setApresentacaoIdx(prev => (prev + 1) % comApres.length);
    }, 10000);

    return () => clearInterval(timer);
  }, [eventosNoDiaSelecionado, dataSelecionada]);

  const handleFileUpload = async (e) => {
    setErrorMessage("Upload de banners requer MinIO/armazenamento local no servidor.");
    setTimeout(() => setErrorMessage(null), 4000);
  };

  const handleApresentacaoUpload = async (e) => {
    setErrorMessage("Upload de apresentações requer MinIO/armazenamento local no servidor.");
    setTimeout(() => setErrorMessage(null), 4000);
  };

  // Função para lidar com a edição
  const handleEdit = (evento) => {
    if (evento.tecnico === currentUser || isAdmin) {
      setFormData({
        id: evento.id,
        titulo: evento.titulo,
        categoria: evento.categoria,
        data: evento.inicio.toISOString().split('T')[0],
        inicio: `${evento.inicio.getHours().toString().padStart(2, '0')}:${evento.inicio.getMinutes().toString().padStart(2, '0')}`,
        fim: `${evento.fim.getHours().toString().padStart(2, '0')}:${evento.fim.getMinutes().toString().padStart(2, '0')}`,
        cor: evento.cor || PRESET_COLORS[0],
        descricao: Array.isArray(evento.descricao) ? evento.descricao.join('\n') : (evento.descricao || ''),
        detalhes: evento.detalhes || '',
        link: evento.link || '',
        fixado: evento.fixado || false,
        banner: evento.banner || '',
        apresentacao: evento.apresentacao || '',
        lembrete: evento.lembrete || false,
        participantes: evento.participantes || []
      });
      setIsFormAberto(true);
      setEventoSelecionado(evento);
    } else {
      setErrorMessage(`Ação negada: Este evento pertence ao técnico ${evento.tecnico}.`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleSave = async () => {
    if (!formData.titulo.trim()) {
      setErrorMessage("Por favor, insira um título para a tarefa.");
      return;
    }

    const dataBase = new Date(formData.data + 'T00:00:00');
    const [hIni, mIni] = formData.inicio.split(':');
    const [hFim, mFim] = formData.fim.split(':');

    const inicio = new Date(new Date(dataBase).setHours(parseInt(hIni), parseInt(mIni)));
    const fim = new Date(new Date(dataBase).setHours(parseInt(hFim), parseInt(mFim)));

    const payload = {
      titulo: formData.titulo,
      categoria: formData.categoria,
      cor: formData.cor,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      tecnico: currentUser,
      descricao: formData.descricao.split('\n').filter(l => l.trim()),
      detalhes: formData.detalhes,
      link: formData.link,
      fixado: formData.fixado,
      banner: formData.banner,
      apresentacao: formData.apresentacao,
      lembrete: formData.lembrete,
      participantes: formData.participantes
    };

    setLoading(true);
    try {
      if (formData.id) {
        const { error } = await api.agenda.update(formData.id, payload);
        if (error) throw new Error(error);
      } else {
        const { error } = await api.agenda.insert({ ...payload, id: crypto.randomUUID() });
        if (error) throw new Error(error);
      }

      await fetchEventos();
      setIsFormAberto(false);
      setFormData({
        id: null,
        titulo: '',
        categoria: 'Tarefa',
        data: new Date().toISOString().split('T')[0],
        inicio: '10:00',
        fim: '11:00',
        cor: '#EAE4E4',
        descricao: '',
        detalhes: '',
        link: '',
        fixado: false,
        lembrete: false,
        banner: '',
        apresentacao: '',
        participantes: []
      });
    } catch (error) {
      console.error("Erro ao salvar evento:", error);
      setErrorMessage("Erro ao salvar no Supabase. Verifique a tabela 'agenda_eventos'.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (evento) => {
    if (!evento?.id) return;

    if (evento.tecnico !== currentUser && !isAdmin) {
      setErrorMessage(`Ação negada: Este evento pertence ao técnico ${evento.tecnico}.`);
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    if (!window.confirm("Tem certeza que deseja excluir este evento?")) return;

    setLoading(true);
    try {
      const { error } = await api.agenda.delete(evento.id);
      if (error) throw new Error(error);

      await fetchEventos();
      setEventoSelecionado(null);
    } catch (error) {
      console.error("Erro ao excluir evento:", error);
      setErrorMessage("Erro ao excluir do Supabase.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden animate-in fade-in duration-700 items-stretch rounded-t-[1.5rem]" style={{ color: 'var(--text-main)' }}>

      {/* ALERTA DE ERRO (CAIXINHA VERMELHA) */}
      {errorMessage && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[5000] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-rose-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <AlertTriangle size={20} />
            <span className="text-sm font-bold">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="ml-4 hover:opacity-50"><X size={16} /></button>
          </div>
        </div>
      )}

      {/* PAINEL PRINCIPAL */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* HEADER */}
        <div className="pl-8 pr-0 pt-2 pb-6 bg-transparent">
          <div className="flex items-center justify-between gap-4">

            <div className="flex items-center gap-6 overflow-hidden">
              <span className="text-2xl font-bold tracking-tight shrink-0" style={{ color: 'var(--text-main)' }}>
                {diasExibidos[0].getDate()}-{diasExibidos[6].getDate()} {dataSelecionada.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')}
              </span>

              <div className="flex p-1 rounded-2xl shrink-0" style={{ backgroundColor: 'var(--bg-soft)' }}>
                <button onClick={() => { const d = new Date(dataSelecionada); d.setDate(d.getDate() - 7); setDataSelecionada(d); setAbaAgenda('Agenda'); }} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all" style={{ color: 'var(--text-muted)' }}><ChevronLeft size={18} /></button>
                <button onClick={() => { setDataSelecionada(new Date()); setEventoSelecionado(null); setAbaAgenda('Agenda'); }} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors" style={{ color: 'var(--text-muted)' }}>Hoje</button>
                <button onClick={() => { const d = new Date(dataSelecionada); d.setDate(d.getDate() + 7); setDataSelecionada(d); setAbaAgenda('Agenda'); }} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all" style={{ color: 'var(--text-muted)' }}><ChevronRight size={18} /></button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pl-2">
                {categorias.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setFiltroCategoria(cat.id)}
                    className="px-5 py-2.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap"
                    style={{
                      backgroundColor: filtroCategoria === cat.id ? 'var(--bg-selected)' : 'var(--bg-soft)',
                      color: filtroCategoria === cat.id ? 'var(--text-selected)' : 'var(--text-muted)'
                    }}
                  >
                    {cat.nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {loading && (
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl text-[10px] font-bold uppercase tracking-widest animate-in fade-in duration-300">
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Sincronizando...
                </div>
              )}

              <div className="flex items-center gap-2 mr-2">
                <button
                  onClick={() => setAbaAgenda('Fixados')}
                  className="px-5 py-2.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap"
                  style={{
                    backgroundColor: abaAgenda === 'Fixados' ? 'var(--bg-selected)' : 'var(--bg-soft)',
                    color: abaAgenda === 'Fixados' ? 'var(--text-selected)' : 'var(--text-muted)'
                  }}
                >
                  Fixados
                </button>
                <button
                  onClick={() => setAbaAgenda('Agenda')}
                  className="px-5 py-2.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap"
                  style={{
                    backgroundColor: abaAgenda === 'Agenda' ? 'var(--bg-selected)' : 'var(--bg-soft)',
                    color: abaAgenda === 'Agenda' ? 'var(--text-selected)' : 'var(--text-muted)'
                  }}
                >
                  Agenda
                </button>
              </div>

              <div className="relative group hidden md:block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" size={16} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                <input type="text" placeholder="Buscar agenda..." className="pl-12 pr-6 py-3 rounded-[1.2rem] text-xs outline-none transition-all w-64 placeholder:opacity-50" style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--text-main)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* GRADE OU FIXADOS */}
        {abaAgenda === 'Agenda' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar relative">

            <div className="flex sticky top-0 z-[150] backdrop-blur-md" style={{ backgroundColor: 'rgba(var(--bg-soft-rgb), 0.8)' }}>
              <div className="w-20 shrink-0" />
              <div className="flex-1 grid grid-cols-7">
                {diasExibidos.map((dia, idx) => {
                  const isHoje = dia.toDateString() === new Date().toDateString();
                  const isSelecionado = dia.toDateString() === dataSelecionada.toDateString() && !eventoSelecionado;
                  return (
                    <div key={idx} onClick={() => { setDataSelecionada(dia); setEventoSelecionado(null); }} className="py-2.5 px-4 text-center cursor-pointer transition-all mx-1"
                      style={{
                        backgroundColor: isSelecionado ? 'var(--bg-selected)' : 'transparent',
                        color: isSelecionado ? 'var(--text-selected)' : 'inherit',
                        borderRadius: isSelecionado ? '0px' : '12px'
                      }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest`} style={{ color: isSelecionado ? 'var(--text-selected)' : (isHoje ? 'var(--accent)' : 'var(--text-muted)') }}>
                          {dia.toLocaleString('pt-BR', { weekday: 'short' }).replace('.', '')}
                        </span>
                        <span className={`text-lg font-bold`} style={{ color: isHoje && !isSelecionado ? 'var(--accent)' : 'inherit' }}>{dia.getDate()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex min-h-full relative">
              <div className="w-20 shrink-0 flex flex-col items-center sticky left-0 z-[80]" style={{ backgroundColor: 'var(--bg-main)' }}>
                {horas.map(h => (
                  <div key={h} className="h-24 w-full flex justify-center items-start relative">
                    <span className="text-[10px] font-bold absolute top-0 -translate-y-1/2" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{formatHora(h)}</span>
                  </div>
                ))}
              </div>

              <div
                className="flex-1 grid grid-cols-7 relative select-none z-[90]"
                onMouseDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const colWidth = rect.width / 7;
                  const currentCol = Math.floor(x / colWidth);

                  let y = e.clientY - rect.top;
                  const totalMinutes = (y / 96) * 60;
                  let hours = Math.floor(totalMinutes / 60) + 7;
                  let minutes = Math.round((totalMinutes % 60) / 30) * 30;
                  if (minutes === 60) { minutes = 0; hours += 1; }

                  const time = hours + (minutes / 60);
                  const snappedY = (hours - 7) * 96 + (minutes / 60) * 96;

                  setDragState({
                    isDragging: true,
                    startCol: currentCol,
                    startTime: time,
                    endTime: time + 0.5,
                    dragOriginTime: time,
                    yStart: snappedY,
                    yCurrent: snappedY + 48,
                    dragOriginY: snappedY
                  });

                  setDataSelecionada(diasExibidos[currentCol]);
                  setEventoSelecionado(null);
                  setIsFormAberto(false);
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const colWidth = rect.width / 7;
                  const currentCol = Math.floor(x / colWidth);

                  let y = e.clientY - rect.top;
                  const totalMinutes = (y / 96) * 60;
                  let hours = Math.floor(totalMinutes / 60) + 7;
                  let minutes = Math.round((totalMinutes % 60) / 30) * 30;
                  if (minutes === 60) { minutes = 0; hours += 1; }
                  const time = hours + (minutes / 60);

                  const snappedY = (hours - 7) * 96 + (minutes / 60) * 96;

                  if (dragState.isDragging) {
                    setDragState(prev => ({
                      ...prev,
                      startTime: Math.min(prev.dragOriginTime, time),
                      endTime: Math.max(prev.dragOriginTime + 0.5, time + 0.5),
                      yStart: Math.min(prev.dragOriginY, snappedY),
                      yCurrent: Math.max(prev.dragOriginY + 48, snappedY + 48)
                    }));
                  }

                  if (hours >= 7 && hours <= 24) {
                    setMouseY(snappedY);
                    setMouseCol(currentCol);
                    setMouseTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
                  }
                }}
                onMouseUp={() => {
                  if (dragState.isDragging) {
                    let startH = Math.floor(dragState.startTime);
                    let startM = Math.round((dragState.startTime % 1) * 60 / 30) * 30;
                    let endH = Math.floor(dragState.endTime);
                    let endM = Math.round((dragState.endTime % 1) * 60 / 30) * 30;

                    if (startM === 60) { startH += 1; startM = 0; }
                    if (endM === 60) { endH += 1; endM = 0; }

                    setFormData({
                      id: null,
                      titulo: '',
                      categoria: 'Tarefa',
                      data: `${diasExibidos[dragState.startCol].getFullYear()}-${String(diasExibidos[dragState.startCol].getMonth() + 1).padStart(2, '0')}-${String(diasExibidos[dragState.startCol].getDate()).padStart(2, '0')}`,
                      inicio: `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`,
                      fim: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`,
                      cor: PRESET_COLORS[0],
                      descricao: '',
                      link: ''
                    });
                    setIsFormAberto(true);
                    setDragState({ isDragging: false, startCol: null, startTime: null, endTime: null, dragOriginTime: null, yStart: 0, yCurrent: 0, dragOriginY: 0 });
                  }
                }}
                onMouseLeave={() => {
                  if (!dragState.isDragging) {
                    setMouseY(null);
                    setMouseCol(null);
                  }
                }}
              >
                {/* Linhas de Fundo */}
                {horas.map(h => (
                  <div key={h} className="absolute left-0 right-0 border-t border-dotted border-black/[0.04] dark:border-white/[0.04]" style={{ top: `${(h - 7) * 96}px` }} />
                ))}

                {diasExibidos.map((dia, diaIdx) => (
                  <div key={diaIdx} className="h-full relative group hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                    {horas.map(h => (
                      <div key={h} className="h-24 w-full" />
                    ))}

                    {(() => {
                      const eventosDoDia = eventosFiltrados.filter(e => e.inicio.toDateString() === dia.toDateString());

                      const calcularPosicoes = (eventos) => {
                        const sorted = [...eventos].sort((a, b) => a.inicio - b.inicio);
                        const positioned = [];
                        const groups = [];

                        sorted.forEach(ev => {
                          let group = groups.find(g => g.some(gev => (ev.inicio < gev.fim && gev.inicio < ev.fim)));
                          if (group) group.push(ev);
                          else groups.push([ev]);
                        });

                        groups.forEach(group => {
                          const columns = [];
                          group.forEach(ev => {
                            let placed = false;
                            for (let i = 0; i < columns.length; i++) {
                              if (!columns[i].some(cev => (ev.inicio < cev.fim && cev.inicio < ev.fim))) {
                                columns[i].push(ev);
                                positioned.push({ ...ev, colIdx: i, totalCols: group.length });
                                placed = true;
                                break;
                              }
                            }
                            if (!placed) {
                              columns.push([ev]);
                              positioned.push({ ...ev, colIdx: columns.length - 1, totalCols: group.length });
                            }
                          });

                          const groupSize = columns.length;
                          positioned.forEach(p => {
                            if (group.some(g => g.id === p.id)) {
                              p.totalCols = groupSize;
                            }
                          });
                        });
                        return positioned;
                      };

                      return calcularPosicoes(eventosDoDia).map(evento => {
                        const top = (evento.inicio.getHours() - 7) * 96 + (evento.inicio.getMinutes() / 60) * 96;
                        const durationInHours = (evento.fim - evento.inicio) / (1000 * 60 * 60);
                        const height = durationInHours * 96;
                        const config = categorias.find(c => c.id === evento.categoria) || categorias[1];
                        const isShort = durationInHours <= 1;

                        const isSelected = eventoSelecionado?.id === evento.id;
                        // Lógica de Divisão Vertical: Eventos simultâneos dividem a altura disponível
                        const finalHeight = height / (evento.totalCols || 1);
                        const finalTop = top + ((evento.colIdx || 0) * finalHeight);

                        return (
                          <div
                            key={evento.id}
                            onClick={(e) => { e.stopPropagation(); setEventoSelecionado(evento); setIsFormAberto(false); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                              top: `${finalTop}px`,
                              height: `${finalHeight}px`,
                              left: '0%',
                              width: '100%',
                              backgroundColor: evento.cor || config.accent,
                              zIndex: isSelected ? 100 : (10 + (evento.colIdx || 0))
                            }}
                            className={`absolute rounded-[2.5rem] transition-all duration-300 cursor-pointer flex flex-col group overflow-hidden hover:z-[100]
                            ${isShort ? 'justify-center items-center text-center p-2' : 'p-5'}
                          `}
                          >
                            {(() => {
                              const duration = (evento.fim - evento.inicio) / (1000 * 60 * 60);

                              // 1. ESTILO COMPACTO (Até 1 hora)
                              if (duration <= 1) {
                                return (
                                  <div className="flex items-center justify-between w-full h-full gap-2">
                                    <h4 className={`${duration <= 0.5 ? 'text-[11px]' : 'text-sm'} font-bold truncate leading-tight flex-1 text-[#1A1A1A]`}>
                                      {evento.titulo}
                                    </h4>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleEdit(evento); }}
                                      className="p-1 hover:bg-black/5 rounded-full transition-colors"
                                    >
                                      <MoreVertical size={14} className="text-black/30 shrink-0" />
                                    </button>
                                  </div>
                                );
                              }

                              // 2. ESTILO INTERMEDIÁRIO (1.5h a 2h)
                              if (duration < 2.5) {
                                return (
                                  <div className="flex flex-col w-full h-full gap-2 overflow-hidden">
                                    <div className="flex items-start justify-between">
                                      <span className="flex items-center justify-center px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-black text-white leading-none">
                                        {evento.categoria}
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleEdit(evento); }}
                                        className="p-1 hover:bg-black/5 rounded-full transition-colors"
                                      >
                                        <MoreVertical size={14} className="text-black/20" />
                                      </button>
                                    </div>
                                    <div className="space-y-1">
                                      <h4 className="text-sm font-bold tracking-tight text-[#1A1A1A] truncate">
                                        {evento.titulo}
                                      </h4>
                                      <p className="text-[9px] font-bold text-black/30 uppercase tracking-widest">
                                        {evento.inicio.getHours().toString().padStart(2, '0')}:{evento.inicio.getMinutes().toString().padStart(2, '0')} — {evento.fim.getHours().toString().padStart(2, '0')}:{evento.fim.getMinutes().toString().padStart(2, '0')}
                                      </p>

                                      {duration >= 2 && ((evento.descricao && evento.descricao.length > 0) || evento.detalhes) && (
                                        <div className="mt-1">
                                          <p className="text-[10px] font-medium text-black/40 leading-tight line-clamp-2">
                                            {evento.descricao && evento.descricao.length > 0 ? evento.descricao[0] : evento.detalhes}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }

                              // 3. ESTILO COMPLETO / DESIGN PROCESS (Mais de 2.5h)
                              return (
                                <div className="flex flex-col w-full h-full gap-3 overflow-hidden">
                                  <div className="flex items-start justify-between">
                                    <span className="flex items-center justify-center px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-black text-white leading-none">
                                      {evento.categoria}
                                    </span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleEdit(evento); }}
                                      className="p-1 hover:bg-black/5 rounded-full transition-colors"
                                    >
                                      <MoreVertical size={14} className="text-black/20" />
                                    </button>
                                  </div>

                                  <div className="space-y-1">
                                    <h4 className="text-base font-bold tracking-tight text-[#1A1A1A]">
                                      {evento.titulo}
                                    </h4>
                                    <p className="text-[9px] font-bold text-black/30 uppercase tracking-widest">
                                      {evento.inicio.getHours().toString().padStart(2, '0')}:{evento.inicio.getMinutes().toString().padStart(2, '0')} — {evento.fim.getHours().toString().padStart(2, '0')}:{evento.fim.getMinutes().toString().padStart(2, '0')}
                                    </p>
                                  </div>

                                  {((evento.descricao && evento.descricao.length > 0) || evento.detalhes) && (
                                    <div className="space-y-3">
                                      {evento.detalhes && (
                                        <p className="text-[10px] font-medium text-black/40 leading-tight line-clamp-4">
                                          {evento.detalhes}
                                        </p>
                                      )}

                                      {evento.descricao && evento.descricao.length > 0 && (
                                        <div className="space-y-2">
                                          {evento.descricao.slice(0, 3).map((line, idx) => (
                                            <div key={idx} className="flex gap-2 items-start">
                                              <div className="w-1 h-1 rounded-full bg-black/20 mt-1.5 shrink-0" />
                                              <p className="text-[10px] font-medium text-black/50 leading-tight line-clamp-1">
                                                {line}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {duration >= 4 && evento.link && (
                                    <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-black/30 truncate">
                                      <ExternalLink size={12} className="shrink-0 opacity-40" />
                                      <span className="truncate">{evento.link.replace(/^https?:\/\//, '')}</span>
                                    </div>
                                  )}

                                </div>
                              );
                            })()}
                          </div>
                        );
                      });
                    })()}

                    {mouseY !== null && mouseCol === diaIdx && (
                      <>
                        {/* Linha da Régua (atrás dos eventos) */}
                        <div className="absolute left-0 right-0 z-[1] pointer-events-none" style={{ top: `${mouseY}px` }}>
                          <div className="w-full h-[2px] bg-black dark:bg-white opacity-20"></div>
                        </div>

                        {/* Pílula de Horário (na frente dos eventos) */}
                        <div className="absolute left-0 z-[200] pointer-events-none" style={{ top: `${mouseY}px` }}>
                          <div className="absolute left-0 -translate-x-full -translate-y-1/2 bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold px-3 py-1.5 rounded-full shadow-2xl">
                            {mouseTime}
                          </div>
                        </div>
                      </>
                    )}

                    {((dragState.isDragging && dragState.startCol === diaIdx) || (isFormAberto && !formData.id && formData.data === `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`)) && (
                      <div
                        className={`absolute left-2 right-2 rounded-2xl bg-black/10 dark:bg-white/10 border-2 border-dashed border-black/20 dark:border-white/20 z-10 flex items-center justify-center ${!dragState.isDragging ? 'transition-all duration-300' : ''}`}
                        style={{
                          top: dragState.isDragging ? `${dragState.yStart}px` : `${(parseInt(formData.inicio.split(':')[0]) - 7) * 96 + (parseInt(formData.inicio.split(':')[1]) / 60) * 96}px`,
                          height: dragState.isDragging ? `${Math.max(48, dragState.yCurrent - dragState.yStart)}px` : `${Math.max(48, ((parseInt(formData.fim.split(':')[0]) * 60 + parseInt(formData.fim.split(':')[1])) - (parseInt(formData.inicio.split(':')[0]) * 60 + parseInt(formData.inicio.split(':')[1]))) / 60 * 96)}px`
                        }}
                      >
                        <Plus size={24} className="text-black/30 dark:text-white/30 animate-pulse" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar pl-8 pr-2 py-8 w-full">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 w-full auto-rows-max">
              {eventos.filter(e => e.fixado).map(evento => (
                <div
                  key={evento.id}
                  onClick={() => { setEventoSelecionado(evento); setIsFormAberto(false); }}
                  className="relative w-full aspect-[9/16] rounded-none overflow-hidden group cursor-pointer transition-all duration-500"
                >
                  {evento.banner ? (
                    evento.banner.match(/\.(mp4|webm|ogg)$/i) ? (
                      <video src={evento.banner} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <img src={evento.banner} alt={evento.titulo} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    )
                  ) : (
                    <div className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" style={{ backgroundColor: evento.cor || 'var(--bg-soft)' }} />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="absolute top-4 right-4 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-[11px] font-bold text-white drop-shadow-md">
                      {evento.likes || 0}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLike(evento); }}
                      className="p-2.5 bg-white/10 hover:bg-white/30 backdrop-blur-md rounded-full transition-all text-white group/like"
                    >
                      <Heart size={16} className="group-hover/like:fill-white transition-all" />
                    </button>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                    <span className="text-[9px] font-bold text-white/60 uppercase tracking-[0.2em]">
                      {new Date(evento.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                    </span>
                    <h3 className="text-white font-medium text-[19px] leading-tight line-clamp-2">{evento.titulo}</h3>

                    {/* RESPONSÁVEL */}
                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100">
                      <div className="w-[27px] h-[27px] rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                        {perfis[evento.tecnico] ? (
                          <img src={perfis[evento.tecnico]} alt={evento.tecnico} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] font-bold text-white/40">{evento.tecnico?.substring(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="text-xs font-normal text-white/50 tracking-wide">
                        {evento.tecnico}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {eventos.filter(e => e.fixado).length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center h-[60vh] text-[var(--text-muted)] opacity-50">
                  <p className="font-bold tracking-widest uppercase text-sm">Nenhum evento fixado</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PAINEL DIREITO */}
      <div className="w-[380px] flex flex-col shrink-0 overflow-y-auto custom-scrollbar" style={{ backgroundColor: 'rgba(var(--bg-soft-rgb), 0.2)', backdropBlur: '20px' }}>
        <div className="px-8 pb-8 pt-2 space-y-12">

          {/* CABEÇALHO FIXO: DATA E CLIMA */}
          <div className="flex items-end justify-between animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex flex-col">
              <span className="text-7xl font-bold tracking-tighter" style={{ color: 'var(--text-main)' }}>
                {dataSelecionada.getDate()}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-widest opacity-30 mt-1">
                {dataSelecionada.toLocaleString('pt-BR', { weekday: 'long' })}
              </span>
            </div>

            <div className="flex flex-col items-end">
              {!imgError ? (
                <img
                  src={`https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/${clima.icon}.svg`}
                  alt={clima.condicao}
                  className="w-20 h-20 object-contain -mr-2"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-16 h-16 flex items-center justify-center opacity-30">
                  {clima.fallbackIcon}
                </div>
              )}
              <div className="flex flex-col items-end -mt-3">
                <span className="text-lg font-bold tracking-tighter">{clima.temp}°</span>
                <span className="text-[8px] font-bold uppercase tracking-widest opacity-30">{clima.condicao}</span>
              </div>
            </div>
          </div>

          {/* CONTEÚDO DINÂMICO */}
          <div className="min-h-0 flex-1">
            {isFormAberto ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-main)', opacity: 0.3 }}>{formData.id ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
                  <div className="flex items-center gap-1">
                    {formData.id && (
                      <button
                        onClick={() => handleDelete(eventoSelecionado)}
                        className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-full transition-colors opacity-40 hover:opacity-100"
                        title="Excluir tarefa"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    <button onClick={() => setIsFormAberto(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors opacity-30 hover:opacity-100">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[8px] font-bold uppercase opacity-30 ml-1">Título</label>
                    <input
                      type="text"
                      value={formData.titulo}
                      onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                      placeholder="O que você vai fazer?"
                      className="w-full px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 outline-none focus:ring-2 ring-[var(--accent)]/20 transition-all text-sm font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[8px] font-bold uppercase opacity-30 ml-1">Data</label>
                      <input
                        type="date"
                        value={formData.data}
                        onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                        className="w-full px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 outline-none transition-all text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-bold uppercase opacity-30 ml-1">Categoria</label>
                      <select
                        value={formData.categoria}
                        onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                        className="w-full px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 outline-none transition-all text-xs font-bold appearance-none cursor-pointer"
                      >
                        {categorias.filter(c => c.id !== 'Todas').map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[8px] font-bold uppercase opacity-30 ml-1">Início</label>
                      <input
                        type="time"
                        value={formData.inicio}
                        onChange={(e) => setFormData({ ...formData, inicio: e.target.value })}
                        className="w-full px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 outline-none transition-all text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-bold uppercase opacity-30 ml-1">Fim</label>
                      <input
                        type="time"
                        value={formData.fim}
                        onChange={(e) => setFormData({ ...formData, fim: e.target.value })}
                        className="w-full px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 outline-none transition-all text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[8px] font-bold uppercase opacity-30 ml-1">Cor</label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => setFormData({ ...formData, cor: color })}
                          className={`w-8 h-8 rounded-lg transition-all ${formData.cor === color ? 'ring-2 ring-black/20 dark:ring-white/40 scale-110' : 'hover:scale-105'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* OPÇÃO LEMBRETE */}
                  <div className="pt-2">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-[8px] font-bold uppercase opacity-30 group-hover:opacity-100 transition-opacity ml-1">
                        ATIVAR LEMBRETE
                      </span>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={formData.lembrete}
                        onChange={(e) => setFormData({ ...formData, lembrete: e.target.checked })}
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors relative ${formData.lembrete ? 'bg-black dark:bg-white' : 'bg-black/10 dark:bg-white/10'}`}>
                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-all ${formData.lembrete ? 'translate-x-4 bg-white dark:bg-black' : 'bg-white'}`} />
                      </div>
                    </label>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[8px] font-bold uppercase opacity-30 ml-1">Descrição</label>
                      <textarea
                        value={formData.detalhes}
                        onChange={(e) => setFormData({ ...formData, detalhes: e.target.value })}
                        placeholder="Descrição detalhada..."
                        rows={3}
                        className="w-full px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 outline-none focus:ring-2 ring-[var(--accent)]/20 transition-all text-sm font-medium resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-bold uppercase opacity-30 ml-1">Tópicos (Lista)</label>
                      <textarea
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        placeholder="Um item por linha..."
                        rows={3}
                        className="w-full px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 outline-none focus:ring-2 ring-[var(--accent)]/20 transition-all text-sm font-medium resize-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[8px] font-bold uppercase opacity-30 ml-1">Link</label>
                    <input
                      type="url"
                      value={formData.link}
                      onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 outline-none focus:ring-2 ring-[var(--accent)]/20 transition-all text-sm font-medium"
                    />
                  </div>

                  <div className="pt-2 flex flex-col gap-6">
                    {/* OPÇÃO APRESENTAÇÃO */}
                    <div className="space-y-2">
                      <label className="text-[8px] font-bold uppercase opacity-30 ml-1">Apresentação no Resumo (URL Imagem/Vídeo)</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={formData.apresentacao}
                          onChange={(e) => setFormData({ ...formData, apresentacao: e.target.value })}
                          placeholder="Link da apresentação..."
                          className="flex-1 px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 outline-none focus:ring-2 ring-[var(--accent)]/20 transition-all text-sm font-medium"
                        />
                        <div className="relative shrink-0 flex items-center justify-center w-14 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer group" title="Fazer upload do PC">
                          <Upload size={16} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                          <input
                            type="file"
                            accept="image/*,video/*"
                            onChange={handleApresentacaoUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* OPÇÃO FIXAR */}
                    <div className="space-y-4">
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-[8px] font-bold uppercase opacity-30 group-hover:opacity-100 transition-opacity ml-1">
                          FIXAR
                        </span>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={formData.fixado}
                          onChange={(e) => setFormData({ ...formData, fixado: e.target.checked })}
                        />
                        <div className={`w-10 h-6 rounded-full transition-colors relative ${formData.fixado ? 'bg-black dark:bg-white' : 'bg-black/10 dark:bg-white/10'}`}>
                          <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-all ${formData.fixado ? 'translate-x-4 bg-white dark:bg-black' : 'bg-white'}`} />
                        </div>
                      </label>

                      {formData.fixado && (
                        <div className="space-y-3 animate-in slide-in-from-top-2 fade-in duration-300">
                          <label className="text-[8px] font-bold uppercase opacity-30 ml-1">Banner (URL Imagem ou Vídeo)</label>
                          <div className="flex gap-2">
                            <input
                              type="url"
                              value={formData.banner}
                              onChange={(e) => setFormData({ ...formData, banner: e.target.value })}
                              placeholder="Cole aqui o link do banner..."
                              className="flex-1 px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 outline-none focus:ring-2 ring-[var(--accent)]/20 transition-all text-sm font-medium"
                            />
                            <div className="relative shrink-0 flex items-center justify-center w-14 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer group" title="Fazer upload do PC (Max 3MB)">
                              <Upload size={16} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                              <input
                                type="file"
                                accept="image/*,video/*"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PARTICIPANTES SELECTION */}
                  <div className="space-y-4 pt-2">
                    {(() => {
                      const normalize = (v) => {
                        if (!v) return [];
                        if (Array.isArray(v)) return v;
                        if (typeof v !== 'string') return [];
                        const trimmed = v.trim();
                        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                          try { return JSON.parse(trimmed); } catch (e) { return []; }
                        }
                        return trimmed ? [trimmed] : [];
                      };
                      const lista = normalize(formData.participantes);
                      return (
                        <>
                          <div className="flex justify-between items-end ml-1">
                            <p className="text-[8px] font-black uppercase tracking-widest opacity-30">Quer adicionar participantes?</p>
                            <div className="text-[9px] font-bold opacity-30 uppercase tracking-widest animate-in fade-in slide-in-from-right-2">
                              {1 + lista.length} ATIVOS ENVOLVIDOS
                            </div>
                          </div>

                          {/* VISUALIZAÇÃO EM PILHA (CRIADOR + PARTICIPANTES) */}
                          <div className="flex items-center gap-3 pl-1 animate-in fade-in slide-in-from-top-2">
                            <div className="flex -space-x-3">
                              {[currentUser, ...lista].map((username, i) => (
                                <div key={username} className="w-12 h-12 rounded-full border-4 border-[var(--bg-card)] overflow-hidden bg-black/5 relative shadow-sm" style={{ zIndex: i }}>
                                  {perfis[username] ? (
                                    <img src={perfis[username]} alt={username} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold uppercase bg-[var(--bg-soft)]">
                                      {typeof username === 'string' ? username.substring(0, 2) : '??'}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="w-px h-6 bg-black/5 dark:bg-white/5 mx-1" />
                          </div>
                        </>
                      );
                    })()}

                    <div className="flex flex-wrap gap-3">
                      {Object.keys(perfis)
                        .filter(u => u.toUpperCase() !== currentUser.toUpperCase())
                        .sort((a, b) => {
                          const hasA = perfis[a] ? 1 : 0;
                          const hasB = perfis[b] ? 1 : 0;
                          return hasB - hasA;
                        })
                        .map(username => (
                          <button
                            key={username}
                            type="button"
                            onClick={() => {
                              const current = formData.participantes || [];
                              if (current.includes(username)) {
                                setFormData({ ...formData, participantes: current.filter(u => u !== username) });
                              } else {
                                setFormData({ ...formData, participantes: [...current, username] });
                              }
                            }}
                            className={`group relative flex flex-col items-center gap-1 transition-all ${(formData.participantes || []).includes(username) ? 'scale-110' : ''}`}
                          >
                            <div className="w-12 h-12 rounded-full transition-all p-0.5">
                              <div className="w-full h-full rounded-full overflow-hidden bg-black/5 dark:bg-white/5">
                                {perfis[username] ? (
                                  <img src={perfis[username]} alt={username} className={`w-full h-full object-cover transition-all ${(formData.participantes || []).includes(username) ? 'grayscale-0' : 'grayscale opacity-40 group-hover:opacity-100 group-hover:grayscale-0'}`} />
                                ) : (
                                  <div className={`w-full h-full flex items-center justify-center text-[10px] font-bold uppercase transition-all ${(formData.participantes || []).includes(username) ? 'opacity-100 text-[var(--accent)]' : 'opacity-30'}`}>
                                    {username.substring(0, 2)}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className={`text-[7px] font-bold uppercase tracking-tighter truncate max-w-[50px] transition-all ${(formData.participantes || []).includes(username) ? 'opacity-100' : 'opacity-30'}`}>{username}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setIsFormAberto(false)}
                    className="flex-1 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex-[2] py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-black/10 disabled:opacity-50"
                    style={{ backgroundColor: '#1A1A1A', color: 'white' }}
                  >
                    {loading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            ) : eventoSelecionado ? (
              <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">



                <div className="space-y-6">
                  <div className="mb-4">
                    <span className="px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/60">
                      {eventoSelecionado.categoria}
                    </span>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: eventoSelecionado.cor }} />
                    <div className="flex flex-col">
                      <h2 className="text-xl font-bold tracking-tight leading-tight" style={{ color: 'var(--text-main)' }}>
                        {eventoSelecionado.titulo}
                      </h2>
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-30 mt-1">
                        {eventoSelecionado.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — {eventoSelecionado.fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {eventoSelecionado.lembrete && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] w-fit animate-in fade-in slide-in-from-left-2">
                      <Bell size={12} className="animate-bounce" />
                      <span className="text-[9px] font-bold uppercase tracking-widest">Lembrete Ativado</span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-30">Descrição e Notas</p>
                  <div className="space-y-4">
                    {/* Exibe Descrição Longa se existir */}
                    {eventoSelecionado.detalhes && (
                      <p className="text-[13px] font-medium leading-relaxed opacity-80 mb-2">
                        {eventoSelecionado.detalhes}
                      </p>
                    )}

                    {/* Exibe Tópicos se existir */}
                    {Array.isArray(eventoSelecionado.descricao) && eventoSelecionado.descricao.length > 0 ? (
                      <div className="space-y-3">
                        {eventoSelecionado.descricao.map((d, i) => (
                          <div key={i} className="flex gap-4 group">
                            <div className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 opacity-20 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100" />
                            <p className="text-[13px] font-medium leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">{d}</p>
                          </div>
                        ))}
                      </div>
                    ) : !eventoSelecionado.detalhes && (
                      <p className="text-[13px] font-medium leading-relaxed opacity-60 italic">Nenhuma descrição ou tópicos.</p>
                    )}
                  </div>
                </div>

                {eventoSelecionado.link && (
                  <div className="space-y-4">
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-30">Links do dia</p>
                    <a
                      href={eventoSelecionado.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 text-[10px] font-bold truncate hover:bg-black/10 transition-all flex items-center gap-3"
                    >
                      <ExternalLink size={12} className="opacity-30" />
                      <span className="truncate">{eventoSelecionado.link.replace(/^https?:\/\//, '')}</span>
                    </a>
                  </div>
                )}

                <div className="space-y-4 pt-6">
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-30">Responsável</p>
                    {(() => {
                      const normalize = (v) => {
                        if (!v) return [];
                        if (Array.isArray(v)) return v;
                        if (typeof v !== 'string') return [];
                        const trimmed = v.trim();
                        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                          try { return JSON.parse(trimmed); } catch (e) { return []; }
                        }
                        return trimmed ? [trimmed] : [];
                      };
                      const lista = normalize(eventoSelecionado.participantes);
                      
                      return (
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-3">
                            {[eventoSelecionado.tecnico, ...lista].map((username, i) => (
                              <div 
                                key={username} 
                                className="w-12 h-12 rounded-full border-4 border-[var(--bg-card)] overflow-hidden bg-black/5 relative hover:z-50 transition-all cursor-help shadow-sm" 
                                title={username === eventoSelecionado.tecnico ? `${username} (Criador)` : username}
                                style={{ zIndex: i }}
                              >
                                {perfis[username] ? (
                                  <img src={perfis[username]} alt={username} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold uppercase bg-[var(--bg-soft)]">
                                    {typeof username === 'string' ? username.substring(0, 2) : '??'}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="pl-2 text-[9px] font-bold opacity-30 uppercase tracking-widest">
                            {lista.length > 0 ? `${1 + lista.length} Ativos` : eventoSelecionado.tecnico}
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                {/* APRESENTAÇÃO DO DIA (CARROSSEL) */}
                {(() => {
                  const eventosComApres = eventosNoDiaSelecionado.filter(e => e.apresentacao);
                  const eventoAtual = eventosComApres[apresentacaoIdx % (eventosComApres.length || 1)];

                  if (eventoAtual) {
                    return (
                      <div key={eventoAtual.id} className="w-full -mt-6 aspect-video rounded-[2rem] overflow-hidden bg-black/5 dark:bg-white/5 animate-in fade-in duration-1000">
                        {eventoAtual.apresentacao.match(/\.(mp4|webm|ogg)$/i) ? (
                          <video key={eventoAtual.apresentacao} src={eventoAtual.apresentacao} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        ) : (
                          <img key={eventoAtual.apresentacao} src={eventoAtual.apresentacao} alt="Apresentação do Dia" className="w-full h-full object-cover" />
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="space-y-8">
                  <div className="space-y-4">
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-30">Tarefas/Eventos do dia</p>
                    <div className="flex flex-col gap-3">
                      {eventosNoDiaSelecionado.length > 0 ? (
                        eventosNoDiaSelecionado.map(ev => (
                          <div
                            key={ev.id}
                            onClick={() => setEventoSelecionado(ev)}
                            className="py-4 px-6 rounded-full cursor-pointer transition-all border border-transparent hover:border-black/5 dark:hover:border-white/5"
                            style={{
                              backgroundColor: ev.cor || 'var(--bg-soft)',
                              filter: document.documentElement.classList.contains('dark') ? 'brightness(0.9) saturate(1.1)' : 'none'
                            }}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <h5 className="text-[13px] font-semibold tracking-tight truncate flex-1" style={{ color: '#1A1A1A' }}>
                                {ev.titulo}
                              </h5>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEdit(ev); }}
                                className="p-1 hover:bg-black/5 rounded-full transition-colors shrink-0"
                              >
                                <ChevronRight size={16} className="text-black/40" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center rounded-[2.2rem] border-2 border-dashed border-black/5 dark:border-white/5 shrink-0" style={{ color: 'var(--text-muted)', opacity: 0.3 }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest">Sem Eventos</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SEÇÃO DE LINKS DINÂMICOS */}
                  {(() => {
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const allLinks = eventosNoDiaSelecionado.flatMap(ev => {
                      const linksDesc = (Array.isArray(ev.descricao) ? ev.descricao : []).flatMap(line => line.match(urlRegex) || []);
                      if (ev.link) linksDesc.push(ev.link);
                      return linksDesc;
                    });

                    if (allLinks.length > 0) {
                      return (
                        <div className="space-y-4">
                          <p className="text-[8px] font-black uppercase tracking-widest opacity-30">Links do Dia</p>
                          <div className="flex flex-col gap-2">
                            {[...new Set(allLinks)].map((link, idx) => (
                              <a key={idx} href={link} target="_blank" rel="noopener noreferrer"
                                className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 text-[10px] font-bold truncate hover:bg-black/10 transition-all flex items-center gap-3">
                                <ExternalLink size={12} className="opacity-30" />
                                <span className="truncate">{link.replace(/^https?:\/\//, '')}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* PARTICIPANTES DO DIA */}
                  {eventosNoDiaSelecionado.length > 0 && (
                    <div className="space-y-4 pt-6">
                      <p className="text-[8px] font-black uppercase tracking-widest opacity-30">Participantes</p>
                      <div className="flex items-center -space-x-2">
                        {[...new Set(eventosNoDiaSelecionado.map(ev => ev.tecnico))].map((tecnico, idx) => (
                          <div key={idx} className="w-10 h-10 rounded-full border-2 border-white dark:border-[#1A1A1A] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center overflow-hidden cursor-help relative shadow-sm ring-1 ring-black/5">
                            {perfis[tecnico] ? (
                              <img src={perfis[tecnico]} alt={tecnico} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400">
                                {tecnico.substring(0, 2)}
                              </span>
                            )}
                          </div>
                        ))}
                        <div className="pl-4 text-[9px] font-bold opacity-30 uppercase tracking-widest">
                          {[...new Set(eventosNoDiaSelecionado.map(ev => ev.tecnico))].length} ativos
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default AgendaEstiloGoogle;
