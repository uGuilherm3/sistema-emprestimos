import React, { useState, useEffect } from 'react';
import { api } from './utils/apiClient';
import { FileText, Search, Printer, User, CalendarDays, ShieldCheck, Download, Trash2, CheckCircle2, Package, Filter, ChevronRight } from 'lucide-react';
import VoucherPreview from './VoucherPreview';

export default function DocumentosAssinados() {
  const [documentos, setDocumentos] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [documentoSelecionado, setDocumentoSelecionado] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('Todos'); // 'Todos', 'Retirada', 'Devolucao'

  const fetchDocumentos = async () => {
    setLoading(true);
    try {
      // Busca todos os empréstimos para filtrar por assinatura no cliente
      const { data, error } = await api.emprestimos.list({ limit: 500 });
      if (error) throw new Error(error);
      // Filtra os que têm assinatura eletrônica
      const comAssinatura = (data || []).filter(e => e.assinatura_eletronica || e.assinatura_dev_eletronica || e.comprovante_saida);
      setDocumentos(comAssinatura);
    } catch (err) {
      console.error('Erro ao buscar documentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentos();
  }, []);

  // Agrupar por protocolo para não repetir o mesmo "Termo" na lista
  const grupos = {};
  documentos.forEach(doc => {
    const key = doc.protocolo || doc.id;
    if (!grupos[key]) {
      grupos[key] = {
        protocolo: doc.protocolo,
        solicitante: doc.nome_solicitante,
        setor: doc.setor_solicitante,
        data: doc.created_at,
        assinatura_saida: doc.assinatura_eletronica,
        assinatura_retorno: doc.assinatura_dev_eletronica,
        anexo: doc.comprovante_saida,
        itens: [doc],
        fullObj: doc // Para o preview
      };
    } else {
      grupos[key].itens.push(doc);
    }
  });

  const listaGrupos = Object.values(grupos).filter(g => {
    const termo = busca.toLowerCase();
    const matchBusca = (g.protocolo || '').toLowerCase().includes(termo) ||
                       (g.solicitante || '').toLowerCase().includes(termo) ||
                       (g.itens.some(i => (i.item?.nome_equipamento || '').toLowerCase().includes(termo)));
    
    if (filtroTipo === 'Todos') return matchBusca;
    if (filtroTipo === 'Retirada') return matchBusca && g.assinatura_saida;
    if (filtroTipo === 'Devolucao') return matchBusca && g.assinatura_retorno;
    return matchBusca;
  });

  const formatarData = (d) => {
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (documentoSelecionado) {
    return (
      <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-300">
        <header className="flex items-center justify-between mb-8 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setDocumentoSelecionado(null)}
              className="p-3 bg-[var(--bg-card)] rounded-2xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
            >
              <Trash2 size={20} className="rotate-45" /> 
            </button>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Visualizar Termo</h2>
              <p className="text-[10px] font-black text-[#8D3046] uppercase tracking-[0.2em] mt-1">Protocolo #{documentoSelecionado.protocolo}</p>
            </div>
          </div>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white dark:bg-white dark:text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 shadow-xl transition-all"
          >
            <Printer size={16} /> Imprimir Documento
          </button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex justify-center">
          <div className="w-full max-w-4xl no-print">
            <VoucherPreview dados={{...documentoSelecionado.fullObj, itens: documentoSelecionado.itens}} isPrintable={true} />
          </div>
          {/* Versão de impressão pura */}
          <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
             <VoucherPreview dados={{...documentoSelecionado.fullObj, itens: documentoSelecionado.itens}} isPrintable={true} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-[#8D3046]/10 rounded-[1.5rem] text-[#8D3046] shadow-inner shrink-0">
            <FileText size={28} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Arquivo de Documentos</h1>
            <p className="text-xs text-slate-500 dark:text-[#606060] mt-1 font-medium">Repositório central de termos de responsabilidade e assinaturas.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-[var(--bg-soft)] p-1 rounded-2xl">
            {['Todos', 'Retirada', 'Devolucao'].map(f => (
              <button 
                key={f}
                onClick={() => setFiltroTipo(f)}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filtroTipo === f ? 'bg-[var(--bg-card)] text-[#8D3046] shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {f === 'Devolucao' ? 'Devolução' : f}
              </button>
            ))}
          </div>
          <div className="relative group min-w-[280px]">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#8D3046] transition-colors" />
            <input 
              type="text" 
              placeholder="Protocolo, Solicitante ou Item..." 
              value={busca} 
              onChange={e => setBusca(e.target.value)} 
              className="w-full pl-12 pr-4 py-4 bg-[var(--bg-card)] rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none ring-1 ring-slate-200 dark:ring-white/10 focus:ring-2 focus:ring-[#8D3046]/50 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-40">
           <div className="w-10 h-10 border-4 border-[#8D3046] border-t-transparent rounded-2xl animate-spin mb-4"></div>
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8D3046]">Acessando Arquivos...</p>
        </div>
      ) : listaGrupos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-[var(--bg-soft)] rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-white/5 opacity-50">
           <Inbox size={64} strokeWidth={1} className="text-slate-400 mb-6" />
           <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Nenhum documento assinado localizado.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-3 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
            {listaGrupos.map((g) => (
              <div 
                key={g.protocolo || g.data}
                onClick={() => setDocumentoSelecionado(g)}
                className="bg-[var(--bg-card)] rounded-[2rem] p-6 hover:scale-[1.02] hover:shadow-xl transition-all cursor-pointer group relative border border-transparent hover:border-[#8D3046]/20"
              >
                <div className="flex justify-between items-start mb-5">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center text-white dark:text-black shadow-lg">
                         <FileText size={18} />
                      </div>
                      <div>
                         <p className="text-[10px] font-black text-[#8D3046] uppercase tracking-widest">Protocolo</p>
                         <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight">#{g.protocolo || 'N/I'}</h4>
                      </div>
                   </div>
                   <div className="flex flex-col gap-1.5 items-end">
                      {g.assinatura_saida && <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><ShieldCheck size={10}/> Saída</span>}
                      {g.assinatura_retorno && <span className="bg-[#254E70]/10 text-[#254E70] px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><ShieldCheck size={10}/> Retorno</span>}
                   </div>
                </div>

                <div className="space-y-4 mb-6">
                   <div className="flex items-center gap-3">
                      <User size={14} className="text-slate-400" />
                      <div>
                        <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase truncate max-w-[200px]">{g.solicitante}</p>
                        <p className="text-[9px] font-medium text-slate-500 uppercase tracking-tighter">{g.setor}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <CalendarDays size={14} className="text-slate-400" />
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase letter-spacing-widest">Registrado em {formatarData(g.data)}</p>
                   </div>
                </div>

                <div className="flex-1 min-h-[60px] bg-[var(--bg-page)] rounded-2xl p-4 mb-6 flex flex-col justify-center">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Itens do Termo</p>
                   <p className="text-[10px] font-bold text-slate-700 dark:text-white uppercase line-clamp-2">
                      {g.itens.map(i => i.item?.nome_equipamento || (i.observacoes?.includes('[GLPI]') ? i.observacoes.match(/\[GLPI\] (.*?) \| SN:/)?.[1]?.trim() : 'Equipamento')).join(', ')}
                   </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5 group-hover:border-[#8D3046]/20 transition-colors">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{g.itens.length} ATIVO(S)</span>
                   <div className="flex items-center gap-1 text-[#8D3046] font-black text-[10px] uppercase tracking-widest">
                      Abrir Termo <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
