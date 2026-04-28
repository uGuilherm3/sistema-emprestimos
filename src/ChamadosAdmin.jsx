import React, { useState, useEffect } from 'react';
import {
  Search, Grid, List,
  AlertTriangle, RotateCcw, ArrowRight, ShieldAlert,
  Clock, User, MessageSquare
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_CHAMADOS_API_BASE || "http://localhost:3000/api";

export default function ChamadosAdmin({ onOpenDetails }) {
  const [chamados, setChamados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [viewType, setViewType] = useState(() => localStorage.getItem('helpdesk_view_pref') || 'list');

  useEffect(() => { fetchChamados(); }, []);
  useEffect(() => { localStorage.setItem('helpdesk_view_pref', viewType); }, [viewType]);

  const fetchChamados = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/chamados`);
      if (!resp.ok) throw new Error("Erro ao carregar");
      const data = await resp.json();
      setChamados(data);
    } catch (err) {
      setError("OFFLINE");
    } finally {
      setLoading(false);
    }
  };

  const filtered = chamados.filter(c => {
    const matchStatus = statusFilter === 'Todos' || c.status === statusFilter;
    const matchText = (c.assunto?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (c.nome?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (c.protocolo?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    return matchStatus && matchText;
  });

  const getPriorityStyle = (p) => {
    switch (p) {
      case 'Baixa': return 'bg-slate-500/10 text-slate-500';
      case 'Normal': return 'bg-blue-500/10 text-blue-500';
      case 'Alta': return 'bg-orange-500/10 text-orange-500';
      case 'Urgente': return 'bg-red-500/20 text-red-500 font-black animate-pulse';
      default: return 'bg-slate-500/10 text-slate-500';
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Aberto': return 'bg-[#254E70]/10 text-[#254E70]';
      case 'Em Atendimento': return 'bg-blue-500/10 text-blue-500';
      case 'Concluído': return 'bg-emerald-500/10 text-emerald-500';
      case 'Cancelado': return 'bg-red-500/10 text-red-500';
      default: return 'bg-slate-500/10 text-slate-500';
    }
  };

  if (error === "OFFLINE") {
    return (
      <div className="h-full flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-[var(--corporate-red)]/10 text-[var(--corporate-red)] rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner">
          <ShieldAlert size={48} strokeWidth={1} />
        </div>
        <h2 className="text-2xl font-black text-[var(--text-main)] mb-4 tracking-tighter uppercase">Painel de Chamados</h2>
        <p className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] mb-10 text-center max-w-xs leading-loose">Não foi possível conectar ao servidor de chamados em {API_BASE}</p>
        <button onClick={fetchChamados} className="px-10 py-5 bg-[var(--text-main)] text-[var(--bg-main)] rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-90 active:scale-95 transition-all shadow-xl">Tentar Reconectar</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-700 w-full overflow-hidden">

      <div className="bg-[var(--bg-card)] rounded-[2rem] transition-all duration-300 flex flex-col h-full relative overflow-hidden">

        {/* HEADER PADRONIZADO COM O DASHBOARD */}
        <div className="p-5 md:p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shrink-0 bg-[var(--bg-page)]/50 dark:bg-transparent">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Painel de Chamados</h3>
            <p className="text-[10px] text-slate-500 dark:text-[#606060] font-black uppercase tracking-[0.2em] mt-1">Gestão Integrada de Suporte TI</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            {/* Status Filtros */}
            <div className="flex bg-[var(--bg-page)] p-1 rounded-2xl border-none shadow-sm">
              {['Todos', 'Aberto', 'Em Atendimento', 'Concluído'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${statusFilter === s ? 'bg-[var(--bg-card)] dark:bg-[#404040] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white'}`}
                >
                  {s === 'Todos' ? 'Todos' : s === 'Aberto' ? 'Abertos' : s}
                </button>
              ))}
            </div>

            {/* View Toggle */}
            <div className="flex bg-[var(--bg-page)] p-1 rounded-2xl border-none shadow-sm">
              <button onClick={() => setViewType('list')} className={`p-2.5 rounded-xl transition-all ${viewType === 'list' ? 'bg-[#254E70] text-white shadow-md' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}><List size={16} /></button>
              <button onClick={() => setViewType('grid')} className={`p-2.5 rounded-xl transition-all ${viewType === 'grid' ? 'bg-[#254E70] text-white shadow-md' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}><Grid size={16} /></button>
            </div>

            {/* Busca */}
            <div className="relative flex-1 lg:w-80 group">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#606060] transition-colors" />
              <input
                type="text"
                placeholder="Pesquisar protocolo ou nome..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-[var(--bg-page)] text-xs font-bold text-slate-900 dark:text-white pl-11 pr-4 py-3.5 rounded-2xl border-none outline-none focus:ring-2 focus:ring-[#254E70]/50 transition-all placeholder:text-slate-400 dark:placeholder:text-[#606060]"
              />
            </div>

            <button onClick={() => { setSearchTerm(''); setStatusFilter('Todos'); fetchChamados(); }} className="p-3.5 bg-[var(--bg-page)] text-slate-500 dark:text-[#606060] hover:text-[#254E70] rounded-2xl transition-all shadow-sm"><RotateCcw size={16} /></button>
          </div>
        </div>

        {/* TABELA / GRID */}
        <div className="flex-1 overflow-x-auto custom-scrollbar pb-10">
          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-2 border-[var(--accent)]/10 border-t-[var(--accent)] rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest animate-pulse">Sincronizando Dados...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center p-10 opacity-40">
              <AlertTriangle size={48} className="text-[var(--text-muted)] mb-6" strokeWidth={1} />
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Nenhum chamado encontrado nesta categoria</p>
            </div>
          ) : viewType === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {filtered.map((item) => (
                <div key={item.id} onClick={() => onOpenDetails(item)} className="bg-[var(--bg-page)]/40 backdrop-blur-sm p-5 rounded-[2rem] hover:-translate-y-1.5 transition-all cursor-pointer group flex flex-col min-h-[200px]">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[9px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-widest font-mono opacity-80">{item.protocolo || `#${item.id}`}</span>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${getStatusStyle(item.status)} shadow-sm`}>{item.status}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter ${getPriorityStyle(item.prioridade || 'Normal')}`}>{item.prioridade || 'Normal'}</span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <h4 className="text-lg font-black text-slate-900 dark:text-white leading-tight mb-2 group-hover:text-[#254E70] transition-colors line-clamp-2">{item.assunto}</h4>
                    <p className="text-[12px] text-slate-500 dark:text-[#A0A0A0] line-clamp-3 leading-relaxed font-medium italic opacity-70">"{item.descricao}"</p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-[11px] shadow-md shrink-0">{item.nome?.charAt(0)}</div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase truncate max-w-[140px]">{item.nome}</span>
                        <span className="text-[9px] text-slate-400 dark:text-[#606060] font-extrabold uppercase mt-0.5">{new Date(item.data).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-slate-300 dark:text-[#404040] group-hover:text-[#254E70] group-hover:translate-x-1 transition-all shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          ) : (

            <table className="w-full text-left whitespace-nowrap min-w-[800px] animate-in fade-in duration-500">
              <thead className="sticky top-0 z-10 bg-[var(--bg-page-dark)]/80 backdrop-blur-xl">
                <tr className="text-[10px] font-black uppercase tracking-[0.25em] text-[#606060]">
                  <th className="px-8 py-6">Solicitante</th>
                  <th className="px-6 py-6">Assunto / Detalhes</th>
                  <th className="px-6 py-6 font-mono text-center">Protocolo</th>
                  <th className="px-6 py-6 text-center">Prioridade</th>
                  <th className="px-6 py-6 text-center">Status</th>
                  <th className="px-8 py-6 text-right">Abertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {filtered.map((item) => (
                  <tr key={item.id} onClick={() => onOpenDetails(item)} className="hover:bg-[var(--bg-page)] dark:hover:bg-[var(--bg-card)]/[0.02] transition-colors group cursor-pointer">
                    <td className="px-8 py-3">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[var(--bg-main)] flex items-center justify-center text-[var(--text-main)] font-black text-xs shadow-sm">{item.nome?.charAt(0)}</div>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight group-hover:text-[#254E70] transition-colors">{item.nome}</span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-[#606060] mt-0.5">{item.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col max-w-sm overflow-hidden whitespace-normal">
                        <span className="text-[12px] font-bold text-slate-900 dark:text-white line-clamp-1">{item.assunto}</span>
                        <p className="text-[10px] font-medium text-slate-500 dark:text-[#606060] mt-0.5 line-clamp-1 italic">"{item.descricao}"</p>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="text-[11px] font-black text-[var(--text-muted)] opacity-50 uppercase tracking-tighter font-mono group-hover:opacity-100 transition-opacity">{item.protocolo || `#${item.id}`}</span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.1em] ${getPriorityStyle(item.prioridade || 'Normal')}`}>
                        {item.prioridade || 'Normal'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${getStatusStyle(item.status)}`}>
                        {item.status === 'Aberto' && <div className="w-1.5 h-1.5 rounded-sm bg-[#254E70] animate-pulse"></div>}
                        {item.status === 'Em Atendimento' ? 'ATENDENDO' : item.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{new Date(item.data).toLocaleDateString('pt-BR')}</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-[#606060] mt-0.5">{new Date(item.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
