// src/ListaEmprestimosAtivos.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './utils/supabaseClient';
import { Search, User, Clock, CalendarDays, CheckCircle, Package, Download, X, Printer, ShieldCheck, ArrowDownLeft, List as ListIcon, Grid as GridIcon, AlertTriangle } from 'lucide-react';
import { logAction } from './utils/log';
import HandoverModal from './HandoverModal';
import VoucherPreview from './VoucherPreview';
import { enviarEmailDevolucaoAPI } from './utils/emailClient';

export default function ListaEmprestimosAtivos({ triggerAtualizacao, onDevolucao, onOpenDetails }) {
  const [emprestimos, setEmprestimos] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDevolucaoId, setLoadingDevolucaoId] = useState(null);
  const [modalAssinatura, setModalAssinatura] = useState(null);
  const [viewType, setViewType] = useState(() => localStorage.getItem('ativos_uso_view_pref') || 'list');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [reciboDevolucao, setReciboDevolucao] = useState(null);
  const pdfContainerRef = useRef(null);

  useEffect(() => { localStorage.setItem('ativos_uso_view_pref', viewType); }, [viewType]);

  const wrap = (obj, relationships = {}) => {
    if (!obj) return null;
    return {
      ...obj,
      id: obj.id,
      createdAt: new Date(obj.created_at || obj.createdAt),
      updatedAt: new Date(obj.updated_at || obj.updatedAt),
      get: (field) => {
        if (relationships[field]) return wrap(obj[field]);
        if (field === 'item') return wrap(obj.item);
        if (field === 'data_reserva' && obj.data_reserva) return new Date(obj.data_reserva);
        if (field === 'data_devolucao_prevista' && obj.data_devolucao_prevista) return new Date(obj.data_devolucao_prevista);
        if (field === 'data_hora_retorno' && obj.data_hora_retorno) return new Date(obj.data_hora_retorno);
        return obj[field];
      },
      set: (field, val) => { obj[field] = val; },
      save: async () => { },
      destroy: async () => { }
    };
  };

  // 👇 Função nativa para traduzir entidades HTML vindas da API do GLPI
  const decodeHTML = (html) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  useEffect(() => {
    const fetchEmprestimos = async () => {
      setLoading(true);
      try {
        // Busca todos os empréstimos abertos do Supabase (fonte de verdade única)
        const { data: dbData, error } = await supabase
          .from('emprestimo')
          .select('*, item(*)')
          .eq('status_emprestimo', 'Aberto')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setEmprestimos((dbData || []).map(o => wrap(o)));
      } catch (error) {
        console.error('Erro ao buscar empréstimos ativos:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmprestimos();
  }, [triggerAtualizacao]);

  const handleDevolverGrupo = (grupo) => {
    setModalAssinatura({ tipo: 'devolucao', grupo: grupo });
  };

  const confirmarHandover = async (nomeResponsavel) => {
    const { grupo } = modalAssinatura;
    setLoadingDevolucaoId(grupo.id);
    try {
      const agora = new Date();
      const textoAssinatura = `TERMO DE DEVOLUÇÃO ASSINADO POR AGENTE EM CONJUNTO COM ${nomeResponsavel.toUpperCase()} EM ${agora.toLocaleDateString('pt-BR')} ÀS ${agora.toLocaleTimeString('pt-BR')}`;
      await executarDevolucaoComAssinatura(grupo, nomeResponsavel, textoAssinatura, agora);
      setModalAssinatura(null);
    } catch (e) {
      alert('Erro ao processar assinatura: ' + e.message);
    } finally {
      setLoadingDevolucaoId(null);
    }
  };

  const executarDevolucaoComAssinatura = async (grupo, nomeResponsavel, textoAssinatura, agoraPre) => {
    logAction('Receber Pedido (Lista) - Início', { grupoId: grupo.id, solicitante: grupo.solicitante });
    try {
      const { data: userProfile } = await supabase.from('users').select('username').eq('id', localStorage.getItem('tilend_user_id')).single();
      if (!userProfile) throw new Error('Sessão expirada.');

      // ⏱️ Hora exata do recebimento — usa o timestamp passado pelo confirmarHandover
      const agora = agoraPre || new Date();
      const retornoDate = agora.toISOString();
      const retornoFormatado = agora.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

      for (const emp of grupo.itens) {
        // Devolução: Apenas marca como devolvido. 
        // O estoque disponível é calculado automaticamente (Total - Abertos) no App.jsx.
        // Adicionar aqui causaria duplicação do patrimônio total.

        await supabase.from('emprestimo').update({
          status_emprestimo: 'Devolvido',
          data_hora_retorno: retornoDate,
          nome_tecnico_retorno: userProfile.username,
          assinatura_dev_eletronica: true,
          detalhes_assinatura_dev: textoAssinatura,
          quem_vai_entregar: nomeResponsavel
        }).eq('id', emp.id);
      }

      setEmprestimos(prev => prev.filter(e => !grupo.itens.find(i => i.id === e.id)));

      const dadosRecibo = {
        solicitante: grupo.solicitante,
        setor: grupo.setor,
        data: grupo.itens[0]?.get('data_reserva'),
        data_hora_retorno: retornoDate,
        status_emprestimo: 'Devolvido',
        tecnico_saida: grupo.itens[0]?.get('nome_tecnico_saida'),
        tecnico_retorno: userProfile.username,
        quem_vai_entregar: nomeResponsavel,
        protocolo: grupo.protocolo,
        itens: grupo.itens.map(i => ({
          nome: i.get('item')?.get('nome_equipamento') || i.item_id,
          quantidade: i.quantidade_emprestada,
          numero_serie: i.get('item')?.get('numero_serie'),
          observacoes: i.observacoes
        }))
      };
      setReciboDevolucao(dadosRecibo);

      // ✉️ Envia e-mail de devolução para o GLPI Mailgate
      try {
        const firstEmp = grupo.itens[0];
        const ticketId = firstEmp?.observacoes?.match(/\[GLPI_TICKET: (\d+)\]/)?.[1] || null;

        await enviarEmailDevolucaoAPI({
          protocolo: grupo.protocolo,
          solicitante: nomeResponsavel,
          tecnico: userProfile.username,
          glpiTicketId: ticketId ? parseInt(ticketId) : null,
          assinatura: textoAssinatura,
          comprovante: null
        });
        console.log('[EMAIL] Devolução notificada via Mailgate');
      } catch (emailErr) {
        console.error('Falha no envio de e-mail de devolução:', emailErr);
      }

      if (onDevolucao) onDevolucao();
      logAction('Receber Pedido (Lista) - SUCESSO', { solicitante: grupo.solicitante, retorno: retornoFormatado });
    } catch (error) {
      throw error;
    }
  };





  const emprestimosFiltrados = emprestimos.filter(e => {
    const termo = busca.toLowerCase();
    return (e.nome_solicitante || '').toLowerCase().includes(termo) ||
      (e.setor_solicitante || '').toLowerCase().includes(termo) ||
      (e.item?.nome_equipamento || '').toLowerCase().includes(termo);
  });

  const extractDateFromSignature = (signature) => {
    if (!signature) return null;
    const match = signature.match(/EM (\d{2}\/\d{2}\/\d{4}) ÀS (\d{2}:\d{2})/);
    if (match) {
      const [, dateStr, timeStr] = match;
      const [day, month, year] = dateStr.split('/');
      const [hour, min] = timeStr.split(':');
      return new Date(year, month - 1, day, hour, min);
    }
    return null;
  };

  const gruposDePedidos = [];
  emprestimosFiltrados.forEach(emp => {
    const protocolo = emp.protocolo;
    const dateFromSig = extractDateFromSignature(emp.detalhes_assinatura || emp.verificado_por_agente);
    const actualSaida = dateFromSig || emp.createdAt;

    let g = gruposDePedidos.find(gr => {
      if (protocolo && gr.protocolo) return gr.protocolo === protocolo;
      return gr.solicitante === emp.get('nome_solicitante') &&
        Math.abs(gr.dataSaida.getTime() - actualSaida.getTime()) < 120000;
    });

    if (g) {
      g.itens.push(emp);
    } else {
      const grupoRef = Object.assign({}, emp);

      grupoRef.id = protocolo || emp.id;
      grupoRef.protocolo = protocolo;
      grupoRef.solicitante = emp.get('nome_solicitante');
      grupoRef.setor = emp.get('setor_solicitante');
      grupoRef.dataSaida = actualSaida;
      grupoRef.previsao = emp.get('data_devolucao_prevista');

      grupoRef.assinatura_eletronica = emp.get('assinatura_eletronica');
      grupoRef.detalhes_assinatura = emp.get('detalhes_assinatura');
      grupoRef.nome_tecnico_saida = emp.get('nome_tecnico_saida');
      grupoRef.assinatura_dev_eletronica = emp.get('assinatura_dev_eletronica');
      grupoRef.detalhes_assinatura_dev = emp.get('detalhes_assinatura_dev');
      grupoRef.nome_tecnico_retorno = emp.get('nome_tecnico_retorno');

      grupoRef.itens = [emp];
      gruposDePedidos.push(grupoRef);
    }
  });

  return (
    <div className="bg-[var(--bg-card)] rounded-[2.5rem] shadow-sm flex flex-col h-full overflow-hidden transition-all duration-300 relative">

      <div className="p-6 md:p-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shrink-0 bg-[var(--bg-page)]/50 dark:bg-transparent">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#254E70]/10 rounded-2xl text-[#254E70] shadow-inner shrink-0">
            <ArrowDownLeft size={24} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Ativos em Uso</h2>
            <p className="text-[10px] text-slate-500 dark:text-[#606060] font-black uppercase tracking-[0.2em] mt-1">
              {gruposDePedidos.length} Pedido{gruposDePedidos.length !== 1 && 's'} pendente{gruposDePedidos.length !== 1 && 's'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          <div className="flex bg-[var(--bg-page)] p-1 rounded-2xl border-none shadow-sm">
            {['Todos', 'No Prazo', 'Atrasados'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${statusFilter === s ? 'bg-[var(--bg-card)] dark:bg-[#404040] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white'}`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex bg-[var(--bg-page)] p-1 rounded-2xl border-none shadow-sm">
            <button onClick={() => setViewType('list')} className={`p-2.5 rounded-xl transition-all ${viewType === 'list' ? 'bg-[#254E70] text-white shadow-md' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}><ListIcon size={16} /></button>
            <button onClick={() => setViewType('grid')} className={`p-2.5 rounded-xl transition-all ${viewType === 'grid' ? 'bg-[#254E70] text-white shadow-md' : 'text-slate-500 dark:text-[#606060] hover:text-[#254E70]'}`}><GridIcon size={16} /></button>
          </div>

          <div className="relative w-full lg:w-64 group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#606060] group-focus-within:text-[#8B5CF6] transition-colors" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-[var(--bg-page)] rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#8B5CF6]/50 focus:border-[#8B5CF6] transition-all placeholder:text-slate-400 dark:placeholder:text-[#606060] shadow-sm"
            />
          </div>
        </div>
      </div>

      {(() => {
        const today = new Date();
        const gruposFiltradosFinal = gruposDePedidos.filter(g => {
          if (statusFilter === 'Todos') return true;
          const isAtrasado = g.previsao && new Date(g.previsao) < today;
          if (statusFilter === 'Atrasados') return isAtrasado;
          if (statusFilter === 'No Prazo') return !isAtrasado;
          return true;
        });

        if (loading) {
          return (
            <div className="flex-1 flex flex-col items-center justify-center p-10 opacity-40">
              <div className="w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-[10px] animate-spin mb-4"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#10B981]">Atualizando ativos...</p>
            </div>
          );
        }

        if (gruposFiltradosFinal.length === 0) {
          return (
            <div className="flex-1 flex flex-col items-center justify-center p-10 opacity-40">
              <CheckCircle size={48} className="mb-5 text-emerald-500" strokeWidth={1} />
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Nenhum pedido encontrado nesta categoria</p>
            </div>
          );
        }

        if (viewType === 'grid') {
          const gruposPorSetor = gruposFiltradosFinal.reduce((acc, current) => {
            const setor = current.setor || 'Sem Setor Especificado';
            if (!acc[setor]) acc[setor] = [];
            acc[setor].push(current);
            return acc;
          }, {});

          return (
            <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-10 space-y-10 custom-scrollbar animate-in fade-in duration-500">
              {Object.entries(gruposPorSetor).map(([setor, itens]) => (
                <div key={setor}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-0.5 flex-1 bg-slate-200 dark:bg-white/5 rounded-full px-[2px]"></div>
                    <h3 className="text-[10px] font-black text-slate-500 dark:text-[#606060] uppercase tracking-[0.3em] bg-[var(--bg-card)] px-4">
                      {setor}
                    </h3>
                    <div className="h-0.5 flex-1 bg-slate-200 dark:bg-white/5 rounded-full px-[2px]"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {itens.map((g) => {
                      const isAtrasado = g.previsao && new Date(g.previsao) < today;
                      return (
                        <div
                          key={g.id}
                          className="bg-[var(--bg-page)]/40 p-5 rounded-[2rem] hover:-translate-y-1 transition-all cursor-pointer group flex flex-col min-h-[200px]"
                          onClick={() => onOpenDetails(g)}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <span className="text-[9px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-widest font-mono opacity-80">{g.protocolo || `#${g.id.substring(0, 5)}...`}</span>
                            <div className="flex flex-col items-end gap-1.5">
                              {isAtrasado ? (
                                <span className="inline-flex px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter bg-red-500/10 text-red-500">ATRASADO</span>
                              ) : g.previsao ? (
                                <span className="inline-flex px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter bg-emerald-500/10 text-emerald-500">NO PRAZO</span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter bg-slate-500/10 text-slate-500">P/ HOJE</span>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 mb-4">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight mb-2 group-hover:text-[#254E70] transition-colors line-clamp-2">
                              {g.itens.length > 1 ? `${g.itens.length} Ativos Vinculados` : (() => {
                                const firstItem = g.itens[0];
                                return firstItem?.get('item')?.get('nome_equipamento') || 'Desconhecido';
                              })()}
                            </h4>
                            <p className="text-[10px] text-slate-500 dark:text-[#A0A0A0] line-clamp-2 leading-relaxed font-bold">
                              {g.itens.length > 1 ? g.itens.map(i => i.get('item')?.get('nome_equipamento')).join(', ') : (() => {
                                const firstItem = g.itens[0];
                                return firstItem?.get('item')?.get('modelo_detalhes') || 'N/I';
                              })()}
                            </p>
                          </div>

                          <div className="mt-auto pt-4 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-[var(--bg-main)] flex items-center justify-center text-[var(--text-main)] font-black text-[10px] shadow-md shrink-0">
                                {g.solicitante?.charAt(0)}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase truncate max-w-[100px]">{g.solicitante}</span>
                                <span className="text-[8px] text-slate-400 dark:text-[#606060] font-extrabold uppercase mt-0.5 flex items-center gap-1"><Clock size={8} /> {g.dataSaida.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDevolverGrupo(g); }} disabled={loadingDevolucaoId === g.id} className="w-8 h-8 rounded-xl bg-[var(--bg-page)] text-emerald-600 border border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center shadow-sm disabled:opacity-50">
                              {loadingDevolucaoId === g.id ? '...' : <CheckCircle size={14} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        return (
          <div className="flex-1 overflow-x-auto custom-scrollbar animate-in fade-in duration-500 pb-10">
            <table className="w-full text-left whitespace-nowrap min-w-[900px]">
              <thead className="sticky top-0 z-10 bg-[var(--bg-page)]/90 backdrop-blur-xl">
                <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-8 py-5">Equipamento</th>
                  <th className="px-6 py-5">Solicitante</th>
                  <th className="px-6 py-5">Data de Saída</th>
                  <th className="px-6 py-5">Entrega Prevista</th>
                  <th className="px-8 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/[0.02]">
                {gruposFiltradosFinal.map(g => {
                  const dataSaida = g.dataSaida;
                  return (
                    <tr key={g.id} className="hover:bg-[var(--bg-page)] dark:hover:bg-[var(--bg-card)]/[0.02] transition-colors group">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-xl bg-[var(--bg-soft)] text-slate-400 dark:text-[#606060] flex items-center justify-center shrink-0 shadow-inner group-hover:text-[#10B981] transition-colors">
                            <Package size={14} />
                          </div>
                          <div className="flex flex-col">
                            <p className="text-xs font-black text-slate-900 dark:text-white flex items-center truncate uppercase tracking-tight cursor-pointer hover:opacity-80" onClick={() => onOpenDetails(g)}>
                              <span className="bg-[#254E70]/10 text-[#254E70] dark:text-[#38bdf8] px-2 py-0.5 rounded-md shadow-sm text-[10px] font-black mr-3">
                                PEDIDO #{g.protocolo || g.id.split('-')[0].toUpperCase()}
                              </span>
                              <span className="truncate">{g.itens.length} ATIVO{g.itens.length !== 1 ? 'S' : ''} VINCULADOS</span>
                            </p>
                            <button onClick={() => onOpenDetails(g)} className="text-[10px] font-bold text-slate-500 hover:text-[#10B981] mt-1.5 text-left w-fit transition-colors">Visualizar detalhes do pedido</button>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><User size={12} className="text-slate-400" /> {g.solicitante}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-[#606060] mt-1 ml-4">{g.setor}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{dataSaida.toLocaleDateString('pt-BR')}</span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-[#606060] mt-0.5 flex items-center gap-1"><Clock size={10} /> {dataSaida.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {g.previsao ? (() => {
                          const previsao = g.previsao;
                          const atrasado = previsao < today;
                          return (
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${atrasado ? 'text-[#8D3046] animate-pulse' : 'text-slate-900 dark:text-white'}`}>
                                  {previsao.toLocaleDateString('pt-BR')}
                                </span>
                                {atrasado && <span className="text-[8px] px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded-md font-black uppercase tracking-widest animate-pulse">Atrasado</span>}
                              </div>
                              <span className={`text-[10px] font-bold mt-0.5 flex items-center gap-1 ${atrasado ? 'text-red-400' : 'text-slate-500 dark:text-[#606060]'}`}>
                                <Clock size={10} /> {previsao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })() : (
                          <span className="text-[10px] font-bold text-slate-400 dark:text-[#404040] italic uppercase tracking-widest">N/I</span>
                        )}
                      </td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onOpenDetails(g)} className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-[var(--bg-card)] rounded-xl transition-all shadow-sm" title="Ver Detalhes e Documento">
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={() => handleDevolverGrupo(g)}
                            disabled={loadingDevolucaoId === g.id}
                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 shadow-sm shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                          >
                            {loadingDevolucaoId === g.id ? '...' : <><CheckCircle size={14} /> Receber</>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      <HandoverModal
        isOpen={!!modalAssinatura}
        onClose={() => setModalAssinatura(null)}
        onConfirm={confirmarHandover}
        tipo="devolucao"
        solicitante={modalAssinatura?.grupo?.solicitante}
        setor={modalAssinatura?.grupo?.itens?.[0]?.get?.('setor_solicitante')}
        itens={modalAssinatura?.grupo?.itens}
        loading={loadingDevolucaoId === modalAssinatura?.grupo?.id}
        preAssinado={!!modalAssinatura?.grupo?.itens?.[0]?.get?.('assinatura_dev_eletronica')}
        detalhesAssinaturaPortal={modalAssinatura?.grupo?.itens?.[0]?.get?.('detalhes_assinatura_dev')}
      />

      <div style={{ position: 'absolute', left: '-9999px', top: '0', width: '800px' }}>
        <div ref={pdfContainerRef}>
          {reciboDevolucao && <VoucherPreview dados={reciboDevolucao} isPrintable={true} />}
        </div>
      </div>
    </div>
  );
}