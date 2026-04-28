// src/FeedResumo.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './utils/supabaseClient';
import { Clock, CalendarClock, ArrowRight, Globe, CheckCircle2, CalendarDays, User, AlertTriangle, Printer, ShieldCheck, X, CheckCircle, ArrowDownLeft, ArrowUpRight, PenLine } from 'lucide-react';
import { logAction } from './utils/log';
import HandoverModal from './HandoverModal';

// Intervalo do polling de fingerprint (ms). Só faz fetch completo quando muda.
const FINGERPRINT_INTERVAL_MS = 30000;

export default function FeedResumo({ onNavigate, triggerUpdate, onOperacaoFeed, onOpenDetails }) {
  const [proximasRetiradas, setProximasRetiradas] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [emUsoHoje, setEmUsoHoje] = useState([]);
  const [devolucoesHoje, setDevolucoesHoje] = useState([]);
  const [atrasados, setAtrasados] = useState([]);
  const [loading, setLoading] = useState(true);

  const [cobradosIds, setCobradosIds] = useState([]);
  const [loadingAcaoId, setLoadingAcaoId] = useState(null);
  const [modalAssinatura, setModalAssinatura] = useState(null); // { tipo: 'retirada'|'devolucao', grupo: any }

  // Ref para guardar o último fingerprint sem provocar re-render
  const lastFingerprintRef = useRef(null);

  // Helper to wrap object in a Parse-like adapter
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
        // Mapeia data_inicio_prevista (emprestimo Pendente/Aprovado) e data_inicio (legado agendamento) como data_reserva
        if ((field === 'data_reserva' || field === 'data_inicio') && (obj.data_inicio_prevista || obj.data_inicio || obj.data_reserva)) 
          return new Date(obj.data_inicio_prevista || obj.data_inicio || obj.data_reserva);
        if (field === 'data_devolucao_prevista' && obj.data_devolucao_prevista) return new Date(obj.data_devolucao_prevista);
        if (field === 'data_hora_retorno' && obj.data_hora_retorno) return new Date(obj.data_hora_retorno);
        // emprestimo usa nome_solicitante; legado agendamento usava 'solicitante'
        if (field === 'nome_solicitante') return obj.nome_solicitante || obj.solicitante || null;
        return obj[field];
      },
      set: (field, val) => { obj[field] = val; },
      save: async () => { /* Handled in specific functions */ },
      destroy: async () => { /* Handled in specific functions */ }
    };
  };

  // -----------------------------------------------------------------------
  // Fingerprint: conta registros + updatedAt mais recente de cada coleção.
  // -----------------------------------------------------------------------
  const calcFingerprint = useCallback(async () => {
    try {
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      
      const [
        { count: cntAprov }, { count: cntPend }, { count: cntAberto }, { count: cntDev },
        { data: latAprov }, { data: latPend }, { data: latAberto }, { data: latDev }
      ] = await Promise.all([
        // Tudo em emprestimo agora
        supabase.from('emprestimo').select('id', { count: 'exact', head: true }).eq('status_emprestimo', 'Aprovado'),
        supabase.from('emprestimo').select('id', { count: 'exact', head: true }).eq('status_emprestimo', 'Pendente'),
        supabase.from('emprestimo').select('id', { count: 'exact', head: true }).eq('status_emprestimo', 'Aberto'),
        supabase.from('emprestimo').select('id', { count: 'exact', head: true }).eq('status_emprestimo', 'Devolvido').gte('updated_at', startOfToday.toISOString()),
        supabase.from('emprestimo').select('updated_at').eq('status_emprestimo', 'Aprovado').order('updated_at', { ascending: false }).limit(1),
        supabase.from('emprestimo').select('updated_at').eq('status_emprestimo', 'Pendente').order('updated_at', { ascending: false }).limit(1),
        supabase.from('emprestimo').select('updated_at').eq('status_emprestimo', 'Aberto').order('updated_at', { ascending: false }).limit(1),
        supabase.from('emprestimo').select('updated_at').eq('status_emprestimo', 'Devolvido').gte('updated_at', startOfToday.toISOString()).order('updated_at', { ascending: false }).limit(1),
      ]);

      return [
        cntAprov, cntPend, cntAberto, cntDev,
        new Date(latAprov?.[0]?.updated_at).getTime() ?? 0,
        new Date(latPend?.[0]?.updated_at).getTime() ?? 0,
        new Date(latAberto?.[0]?.updated_at).getTime() ?? 0,
        new Date(latDev?.[0]?.updated_at).getTime() ?? 0,
      ].join('|');
    } catch (e) { return 'error'; }
  }, []);

  // -----------------------------------------------------------------------
  // Fetch completo dos dados do Feed
  // -----------------------------------------------------------------------
  const fetchFeedData = useCallback(async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setLoading(true);
    try {
      const agora = new Date();
      const umDiaAtras = new Date();
      umDiaAtras.setDate(agora.getDate() - 1);
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

      const empFields = 'id, protocolo, item_id, status_emprestimo, quantidade_emprestada, data_inicio_prevista, data_devolucao_prevista, nome_solicitante, setor_solicitante, created_at, updated_at, assinatura_eletronica, detalhes_assinatura, nome_tecnico_saida, quem_vai_buscar, item(id, nome_equipamento, modelo_detalhes, quantidade)';
      const [resProximos, resPendentes, resEmprestimos, resDevolvidos] = await Promise.all([
        // Tudo em emprestimo agora
        supabase.from('emprestimo').select(empFields).eq('status_emprestimo', 'Aprovado').order('data_inicio_prevista', { ascending: true }).limit(15),
        supabase.from('emprestimo').select(empFields).eq('status_emprestimo', 'Pendente').order('created_at', { ascending: true }),
        supabase.from('emprestimo').select('id, protocolo, item_id, status_emprestimo, quantidade_emprestada, created_at, nome_solicitante, setor_solicitante, assinatura_eletronica, detalhes_assinatura, nome_tecnico_saida, data_hora_retorno, assinatura_dev_eletronica, detalhes_assinatura_dev, nome_tecnico_retorno, item(id, nome_equipamento, modelo_detalhes, quantidade)').eq('status_emprestimo', 'Aberto'),
        supabase.from('emprestimo').select('id, protocolo, item_id, status_emprestimo, quantidade_emprestada, data_hora_retorno, created_at, nome_solicitante, setor_solicitante, updated_at, assinatura_eletronica, detalhes_assinatura, nome_tecnico_saida, assinatura_dev_eletronica, detalhes_assinatura_dev, nome_tecnico_retorno, item(id, nome_equipamento, modelo_detalhes, quantidade)').eq('status_emprestimo', 'Devolvido').gte('updated_at', startOfToday.toISOString()).order('updated_at', { ascending: false }),
      ]);

      const wrapList = (list) => (list || []).map(o => wrap(o));

      const agruparItens = (lista) => {
          const grupos = [];
          lista.forEach(emp => {
             const protocolo = emp.protocolo;
             // Tudo em emprestimo: usa nome_solicitante
             const nome = emp.get('nome_solicitante') || emp.solicitante || '';
             const dataRefDate = emp.get('data_reserva') || emp.createdAt;
             const dataRef = dataRefDate?.getTime() || 0;
             
             let g = grupos.find(gr => {
                if (protocolo && gr.protocolo) return gr.protocolo === protocolo;
                return gr.solicitante === nome && Math.abs(gr.dataRef - dataRef) < 120000;
             });

             if (g) {
                 g.itens.push(emp);
             } else {
                 const grupoRef = Object.assign(Object.create(emp), emp);
                 grupoRef.itens = [emp];
                 grupoRef.solicitante = nome;
                 grupoRef.dataRef = dataRef;
                 grupoRef.protocolo = protocolo;
                 grupos.push(grupoRef);
             }
          });
          return grupos;
      };

      const empsFull = wrapList(resEmprestimos.data);
      const listaAtrasados = empsFull.filter(emp => emp.createdAt < umDiaAtras).sort((a, b) => a.createdAt - b.createdAt);
      const listaEmUsoHoje = empsFull.filter(emp => emp.createdAt >= umDiaAtras).sort((a, b) => b.createdAt - a.createdAt);

      setProximasRetiradas(agruparItens(wrapList(resProximos.data)));
      setPendentes(agruparItens(wrapList(resPendentes.data)));
      setEmUsoHoje(agruparItens(listaEmUsoHoje));
      setAtrasados(agruparItens(listaAtrasados));
      setDevolucoesHoje(agruparItens(wrapList(resDevolvidos.data)));
    } catch (error) { console.error("Erro critico no Feed:", error); }
    finally { setLoading(false); }
  }, []);

  const setupFeed = useCallback(async () => {
    const fpr = await calcFingerprint();
    if (fpr !== 'error' && fpr !== lastFingerprintRef.current) {
        lastFingerprintRef.current = fpr;
        await fetchFeedData(lastFingerprintRef.current === null); 
    } else {
        setLoading(false);
    }
  }, [calcFingerprint, fetchFeedData]);

  useEffect(() => {
    setupFeed();
    const interval = setInterval(setupFeed, FINGERPRINT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [setupFeed]);

  useEffect(() => {
    if (triggerUpdate !== undefined) setupFeed();
  }, [triggerUpdate, setupFeed]);
  // Handlers de ação
  // -----------------------------------------------------------------------
  const handleAprovar = async (ag) => {
    setLoadingAcaoId(ag.id);
    logAction('Aprovar solicitação (Feed) - Início', { agendamentoId: ag.id });
    try {
      const ids = ag.itens.map(i => i.id);
      // Tudo em emprestimo
      const { error } = await supabase.from('emprestimo').update({ status_emprestimo: 'Aprovado' }).in('id', ids);
      if (error) throw error;

      setPendentes(prev => prev.filter(a => a.id !== ag.id));
      setProximasRetiradas(prev => [...prev, ag].sort((a, b) => a.dataRef - b.dataRef));
      if (onOperacaoFeed) onOperacaoFeed();
      logAction('Aprovar solicitação (Feed) - Sucesso', { count: ids.length, solicitante: ag.solicitante });
    } catch (e) {
      logAction('Aprovar solicitação (Feed) - Erro', { agendamentoId: ag.id, error: e.message });
      alert('Erro ao aprovar: ' + e.message);
    } finally {
      setLoadingAcaoId(null);
    }
  };

  const handleRejeitar = async (ag) => {
    if (!window.confirm('Tem certeza que deseja recusar este pedido?')) return;
    setLoadingAcaoId(ag.id);
    logAction('Rejeitar solicitação (Feed) - Início', { agendamentoId: ag.id });
    try {
      const ids = ag.itens.map(i => i.id);
      // Marca como Recusado em emprestimo (não deleta para manter histórico)
      const { error } = await supabase.from('emprestimo').update({ status_emprestimo: 'Recusado' }).in('id', ids);
      if (error) throw error;
      
      setPendentes(prev => prev.filter(a => a.id !== ag.id));
      if (onOperacaoFeed) onOperacaoFeed();
      logAction('Rejeitar solicitação (Feed) - Sucesso', { agendamentoId: ag.id });
    } catch (e) {
      logAction('Rejeitar solicitação (Feed) - Erro', { agendamentoId: ag.id, error: e.message });
      alert('Erro: ' + e.message);
    } finally {
      setLoadingAcaoId(null);
    }
  };

  const handleEfetivarSaidaAgenda = (ag) => {
    setModalAssinatura({ tipo: 'retirada', grupo: ag });
  };
  const confirmarHandover = async (nomeResponsavel, modoVerificacao = false) => {
    const { tipo, grupo } = modalAssinatura;
    setLoadingAcaoId(grupo.id);
    
    try {
      const agora = new Date();
      const agora_str = `${agora.toLocaleDateString('pt-BR')} ÀS ${agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`;
      const labelAcaoTermo = tipo === 'retirada' ? 'RETIRADA' : 'DEVOLUÇÃO';

      let textoAssinatura;
      if (modoVerificacao) {
        // Usuário já pré-assinou — agente apenas verifica/confirma a entrega física
        textoAssinatura = `VERIFICADO E ENTREGUE POR AGENTE EM ${agora_str} PARA ${nomeResponsavel.toUpperCase()}`;
      } else {
        // Assinatura completa pelo agente
        textoAssinatura = `TERMO DE ${labelAcaoTermo} ASSINADO POR AGENTE EM CONJUNTO COM ${nomeResponsavel.toUpperCase()} EM ${agora_str}`;
      }

      if (tipo === 'retirada') {
        await executarSaidaComAssinatura(grupo, nomeResponsavel, textoAssinatura, modoVerificacao);
      } else {
        await executarDevolucaoComAssinatura(grupo, nomeResponsavel, textoAssinatura, modoVerificacao);
      }

      setModalAssinatura(null);
    } catch (e) {
      alert('Erro ao processar: ' + e.message);
    } finally {
      setLoadingAcaoId(null);
    }
  };

  const executarSaidaComAssinatura = async (ag, nomeResponsavel, textoAssinatura, modoVerificacao = false) => {
    logAction('Efetivar Saída (Aprovado→Aberto) - Início', { 
      grupoId: ag.id, solicitante: ag.solicitante, protocolo: ag.protocolo,
      item_nome: ag.itens?.map(i => i.get?.('item')?.get?.('nome_equipamento') || '?').join(', '),
      modo: modoVerificacao ? 'VERIFICAÇÃO (portal pré-assinado)' : 'ASSINATURA COMPLETA',
      responsavel_retirada: nomeResponsavel
    });
    try {
      const { data: userProfile } = await supabase.from('perfil').select('username').eq('id', localStorage.getItem('tilend_user_id')).single();
      const mockEmps = [];

      for (const itemAg of ag.itens) {
          // Verifica estoque físico real no momento da entrega
          const { data: itemBanco } = await supabase.from('item').select('id, nome_equipamento, quantidade').eq('id', itemAg.item_id).single();
          const qtdDesejada = itemAg.get('quantidade_emprestada') || itemAg.quantidade_emprestada || 1;
          const qtdAtual = itemBanco.quantidade || 0;

          if (qtdAtual < qtdDesejada) {
            // Busca empréstimos ativos para distinguir: dados inconsistentes x item realmente em uso
            const { data: empAtivos } = await supabase
              .from('emprestimo')
              .select('quantidade_emprestada, nome_solicitante')
              .eq('item_id', itemBanco.id)
              .eq('status_emprestimo', 'Aberto');
            const qtdEmUso = (empAtivos || []).reduce((acc, e) => acc + (e.quantidade_emprestada || 1), 0);

            if (qtdEmUso > 0) {
              // Item genuinamente em posse de outra pessoa — bloquear
              const nomes = (empAtivos || []).map(e => e.nome_solicitante).filter(Boolean).join(', ');
              throw new Error(
                `Não é possível entregar "${itemBanco.nome_equipamento}": ` +
                `item atualmente em uso por ${nomes || 'outro colaborador'}. ` +
                `Aguarde a devolução antes de prosseguir.`
              );
            }
            // qtdEmUso === 0 → contador dessincronizado no banco, mas item fisicamente disponível.
            // Prossegue com a entrega e recalcula para 0 (correto após a saída).
          }

          const novaQtd = Math.max(0, qtdAtual - qtdDesejada);
          await supabase.from('item').update({ quantidade: novaQtd }).eq('id', itemBanco.id);

          // Atualiza o próprio registro de emprestimo: Aprovado → Aberto
          const updateData = {
            status_emprestimo: 'Aberto',
            nome_tecnico_saida: userProfile.username,
            quem_vai_buscar: nomeResponsavel
          };

          if (modoVerificacao) {
            // Usuário já pré-assinou — apenas registra verificação do agente, preserva assinatura original
            updateData.verificado_por_agente = `VERIFICADO POR ${userProfile.username} — ${textoAssinatura}`;
          } else {
            // Assinatura completa gerada pelo agente
            updateData.assinatura_eletronica = true;
            updateData.detalhes_assinatura = textoAssinatura;
          }

          const { error: errEmp } = await supabase.from('emprestimo').update(updateData).eq('id', itemAg.id);
          if (errEmp) throw errEmp;

          logAction('SAÍDA EFETIVADA', {
            item_nome: itemBanco.nome_equipamento,
            detalhes: `Qtd: ${qtdDesejada} | Solicitante: ${ag.solicitante} | Responsavel retirada: ${nomeResponsavel} | Agente: ${userProfile.username} | Protocolo: ${ag.protocolo || '-'} | Modo: ${modoVerificacao ? 'Verificação' : 'Assinatura Completa'}`
          });

          // Cria referência local para atualizar o UI
          const empAtualizado = wrap({ ...itemAg, ...updateData, item: itemAg.item });
          mockEmps.push(empAtualizado);
      }

      const groupMock = Object.assign(Object.create(mockEmps[0]), mockEmps[0]);
      groupMock.itens = mockEmps;
      groupMock.solicitante = ag.solicitante;
      groupMock.dataRef = groupMock.createdAt?.getTime() || Date.now();

      setProximasRetiradas(prev => prev.filter(a => a.id !== ag.id));
      setEmUsoHoje(prev => [groupMock, ...prev]);
      if (onOpenDetails) onOpenDetails('emprestimo', groupMock);
      if (onOperacaoFeed) onOperacaoFeed();
    } catch (e) {
      throw e;
    }
  };

  const executarDevolucaoComAssinatura = async (grupo, nomeResponsavel, textoAssinatura, modoVerificacao = false) => {
    logAction('Devolução (Feed) - Início', { 
      grupoId: grupo.id, solicitante: grupo.solicitante, protocolo: grupo.protocolo,
      item_nome: grupo.itens?.map(i => i.get?.('item')?.get?.('nome_equipamento') || '?').join(', '),
      responsavel: nomeResponsavel, modo: modoVerificacao ? 'Verificação' : 'Assinatura'
    });
    try {
      const { data: userProfile } = await supabase.from('perfil').select('username').eq('id', localStorage.getItem('tilend_user_id')).single();
      
      for (const emp of grupo.itens) {
        const { data: itemBanco } = await supabase.from('item').select('id, quantidade').eq('id', emp.item_id).single();
        await supabase.from('item').update({ quantidade: (itemBanco.quantidade || 0) + (emp.quantidade_emprestada || 1) }).eq('id', itemBanco.id);
      }

      const updateDev = {
        status_emprestimo: 'Devolvido',
        data_hora_retorno: new Date().toISOString(),
        nome_tecnico_retorno: userProfile.username,
        quem_vai_entregar: nomeResponsavel
      };

      if (modoVerificacao) {
        updateDev.verificado_por_agente_dev = `DEVOLUÇÃO VERIFICADA POR ${userProfile.username} — ${textoAssinatura}`;
      } else {
        updateDev.assinatura_dev_eletronica = true;
        updateDev.detalhes_assinatura_dev = textoAssinatura;
      }

      const ids = grupo.itens.map(i => i.id);
      const { error } = await supabase.from('emprestimo').update(updateDev).in('id', ids);
      if (error) throw error;

      // Log detalhado por item
      for (const emp of grupo.itens) {
        logAction('DEVOLUÇÃO EFETIVADA', {
          item_nome: emp.get?.('item')?.get?.('nome_equipamento') || emp.nome_equipamento || '?',
          detalhes: `Solicitante: ${grupo.solicitante} | Responsavel entrega: ${nomeResponsavel} | Agente: ${userProfile.username} | Protocolo: ${grupo.protocolo || '-'} | Modo: ${modoVerificacao ? 'Verificação' : 'Assinatura'}`
        });
      }

      setEmUsoHoje(prev => prev.filter(g => g.id !== grupo.id));
      setDevolucoesHoje(prev => [grupo, ...prev].slice(0, 10));
      if (onOperacaoFeed) onOperacaoFeed();
    } catch (e) {
      throw e;
    }
  };

  const handleDevolver = (grupo) => {
    setModalAssinatura({ tipo: 'devolucao', grupo: grupo });
  };

  const handleCobrar = async (grupo) => {
    try {
      const diasAtraso = Math.floor(Math.abs(new Date() - grupo.createdAt) / (1000 * 60 * 60 * 24));
      const alerta = `Pedido com ${diasAtraso} dia(s) de atraso.`;
      await supabase.from('emprestimo').update({ alerta_cobranca: alerta }).in('id', grupo.itens.map(i => i.id));
      setCobradosIds(prev => [...prev, grupo.id]);
    } catch (error) {
      alert('Erro ao cobrar: ' + error.message);
    }
  };

  // -----------------------------------------------------------------------
  // Cria um objeto adaptador para exibir Agendamento no modal de impressão
  // -----------------------------------------------------------------------
  const criarAdaptadorAgenda = (ag) => {
    const itemPrincipal = ag.itens?.[0] || ag;
    return {
      get: (campo) => ({
        'item': itemPrincipal.get('item'),
        'nome_solicitante': ag.solicitante,
        'setor_solicitante': ag.get('setor_solicitante'),
        'quantidade_emprestada': ag.itens?.reduce((acc, i) => acc + (i.get('quantidade') || 1), 0) || ag.get('quantidade'),
        'status_emprestimo': 'Aprovado',
        'assinatura_eletronica': ag.get('assinatura_eletronica'),
        'detalhes_assinatura': ag.get('detalhes_assinatura'),
        'assinatura_dev_eletronica': null,
        'detalhes_assinatura_dev': null,
        'quem_vai_buscar': ag.get('quem_vai_buscar'),
        'quem_vai_entregar': null,
        'data_hora_retorno': ag.get('data_devolucao_prevista'),
        'nome_tecnico_saida': null,
        'tecnico_saida': null,
        'nome_tecnico_retorno': null,
        'tecnico_retorno': null,
        'protocolo': ag.protocolo,
      }[campo] ?? null),
      itens: ag.itens,
      createdAt: ag.get('data_reserva'),
      id: ag.id,
    };
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-full pb-10">
        <div className="flex flex-col gap-8">
           {[1, 2, 3].map(i => (
             <div key={i} className="bg-[var(--bg-card)] rounded-[2.5rem] p-8 space-y-4">
                <div className="flex justify-between items-center pb-4">
                   <div className="w-32 h-4 skeleton-box opacity-40 rounded"></div>
                   <div className="w-8 h-6 skeleton-box opacity-30 rounded"></div>
                </div>
                <div className="space-y-4">
                   {[1, 2].map(j => (
                      <div key={j} className="h-24 bg-[var(--bg-page)] rounded-[1.5rem] p-5 flex flex-col justify-between">
                        <div className="w-1/2 h-3 skeleton-box opacity-40 rounded"></div>
                        <div className="w-1/4 h-2 skeleton-box opacity-20 rounded"></div>
                        <div className="w-1/3 h-2 skeleton-box opacity-30 rounded"></div>
                     </div>
                   ))}
                </div>
             </div>
           ))}
        </div>
        <div className="flex flex-col gap-8">
           {[1, 2].map(i => (
             <div key={i} className="bg-[var(--bg-card)] rounded-[2.5rem] p-8 space-y-4">
                <div className="h-4 w-32 skeleton-box opacity-40 rounded mb-4"></div>
                <div className="h-32 bg-[var(--bg-page)] rounded-[1.5rem] skeleton-box opacity-10"></div>
             </div>
           ))}
        </div>
      </div>
    );
  }

  const tudoLimpo = proximasRetiradas.length === 0 && pendentes.length === 0 && emUsoHoje.length === 0 && atrasados.length === 0 && devolucoesHoje.length === 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-full animate-in fade-in duration-500 pb-10 transition-colors duration-300">
      
      {tudoLimpo ? (
        <div className="xl:col-span-2 bg-[var(--bg-card)] rounded-[2.5rem] shadow-sm p-16 flex flex-col items-center justify-center transition-colors duration-300">
           <div className="w-24 h-24 bg-[var(--bg-page)] text-slate-400 dark:text-[#606060] rounded-[2rem] flex items-center justify-center mb-6">
              <CheckCircle2 size={40} strokeWidth={1.5} />
           </div>
           <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Caixa de Entrada Limpa!</h3>
           <p className="text-xs text-slate-500 dark:text-[#A0A0A0]">Você não tem solicitações, saídas para efetivar ou atrasos pendentes.</p>
        </div>
      ) : (
        <>
          {/* LADO ESQUERDO */}
          <div className="flex flex-col gap-8">
            
            {/* APROVAÇÕES PENDENTES */}
            <div className="bg-[var(--bg-card)] rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col transition-all duration-300 h-fit max-h-[400px]">
               <div className="p-6 md:p-8 flex justify-between items-center bg-[var(--bg-page)]/50 /50 shrink-0">
                  <div className="flex items-center gap-3 text-blue-500">
                     <Globe size={18} />
                     <h3 className="font-bold text-sm uppercase tracking-widest text-slate-900 dark:text-white">Aprovações do Portal</h3>
                  </div>
                  {pendentes.length > 0 && <span className="bg-slate-900 dark:bg-[var(--bg-card)] text-white dark:text-black text-[10px] font-black px-2 py-1 rounded-md shadow-sm">{pendentes.length}</span>}
               </div>
               <div className="p-6 md:p-8 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
                  {pendentes.length === 0 ? (
                      <p className="text-xs text-slate-500 italic text-center py-4">Nenhuma solicitação aguardando aprovação.</p>
                  ) : (
                      pendentes.map(ag => (
                          <div key={ag.id} onClick={() => onOpenDetails('emprestimo', ag)} className="flex flex-col xl:flex-row xl:items-center justify-between p-5 bg-[var(--bg-page)] rounded-[1.5rem] transition-all gap-5 shadow-sm cursor-pointer hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card-dark)] group">
                             <div className="flex-1 overflow-hidden pr-2">
                                <div className="flex flex-col">
                                   <p className="text-xs font-black text-slate-900 dark:text-white flex items-center truncate uppercase tracking-tight">
                                      <span className="bg-[#254E70]/10 text-[#254E70] dark:text-[#38bdf8] px-2 py-0.5 rounded-md shadow-sm text-[10px] font-black mr-2">PEDIDO #{ag.protocolo || ag.id.split('-')[0].toUpperCase()}</span> 
                                      <span className="truncate">{ag.itens?.length || 1} ATIVO{(ag.itens?.length || 1) !== 1 ? 'S' : ''} VINCULADOS</span>
                                   </p>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-[#A0A0A0] mt-2 uppercase flex items-center gap-1.5 truncate"><User size={12}/> {ag.solicitante} ({ag.get('setor_solicitante')})</p>
                                <p className="text-[10px] text-[#254E70] mt-1 uppercase font-bold flex items-center gap-1.5 truncate"><CalendarDays size={12}/> Início: {ag.get('data_reserva')?.toLocaleDateString('pt-BR')} às {ag.get('data_reserva')?.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                             </div>
                             <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                <button onClick={() => handleRejeitar(ag)} disabled={loadingAcaoId === ag.id} className="px-5 py-3 bg-[var(--bg-card)] text-[#8D3046] hover:bg-red-50 dark:hover:bg-[#8D3046]/10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm">Recusar</button>
                                <button onClick={() => handleAprovar(ag)} disabled={loadingAcaoId === ag.id} className="px-5 py-3 bg-[#254E70] text-white hover:opacity-90 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-md">Aprovar</button>
                             </div>
                          </div>
                      ))
                  )}
               </div>
            </div>

            {/* SAÍDAS DA AGENDA */}
            <div className="bg-[var(--bg-card)] rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col transition-all duration-300 h-fit max-h-[500px]">
               <div className="p-6 md:p-8 flex justify-between items-center bg-[var(--bg-page)]/50 /50 shrink-0">
                  <div className="flex items-center gap-3 text-emerald-500">
                     <CalendarDays size={18} />
                     <h3 className="font-bold text-sm uppercase tracking-widest text-slate-900 dark:text-white">Saídas da Agenda</h3>
                  </div>
                  {proximasRetiradas.length > 0 && <span className="bg-slate-900 dark:bg-[var(--bg-card)] text-white dark:text-black text-[10px] font-black px-2 py-1 rounded-md shadow-sm">{proximasRetiradas.length}</span>}
               </div>
               <div className="p-6 md:p-8 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
                  {proximasRetiradas.length === 0 ? (
                      <p className="text-xs text-slate-500 italic text-center py-4">Nenhuma retirada prevista para hoje.</p>
                  ) : (
                      proximasRetiradas.map(ag => {
                         const dataAg = ag.get('data_reserva');
                         const isHoje = dataAg.getDate() === new Date().getDate() && dataAg.getMonth() === new Date().getMonth();
                         const isAtrasado = dataAg < new Date();

                         return (
                            <div key={ag.id} onClick={() => onOpenDetails('emprestimo', ag)} className="flex flex-col xl:flex-row xl:items-center justify-between p-5 bg-[var(--bg-page)] rounded-[1.5rem] transition-all gap-5 shadow-sm group cursor-pointer hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card-dark)]">
                               <div className="flex-1 overflow-hidden pr-2">
                                  <div className="flex flex-col">
                                     <p className="text-xs font-black text-slate-900 dark:text-white flex items-center truncate uppercase tracking-tight">
                                        <span className="bg-[#254E70]/10 text-[#254E70] dark:text-[#38bdf8] px-2 py-0.5 rounded-md shadow-sm text-[10px] font-black mr-2">PEDIDO #{ag.protocolo || ag.id.split('-')[0].toUpperCase()}</span> 
                                        <span className="truncate">{ag.itens?.length || 1} ATIVO{(ag.itens?.length || 1) !== 1 ? 'S' : ''} VINCULADOS</span>
                                     </p>
                                  </div>
                                  <p className="text-[10px] text-slate-500 dark:text-[#A0A0A0] mt-2 uppercase flex items-center gap-1.5 truncate"><User size={12}/> {ag.solicitante} ({ag.get('setor_solicitante')})</p>
                                  <p className={`text-[10px] font-bold uppercase mt-1 flex items-center gap-1.5 ${isAtrasado && !isHoje ? 'text-[#8D3046]' : 'text-slate-600 dark:text-[#A0A0A0]'}`}>
                                     <Clock size={12}/> {isHoje ? 'Para Hoje' : dataAg.toLocaleDateString('pt-BR')} às {dataAg.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                  </p>
                                  {ag.get('assinatura_eletronica') && (
                                     <p className="text-[9px] font-black text-emerald-500 mt-1.5 flex items-center gap-1.5 uppercase tracking-widest">
                                        <ShieldCheck size={11}/> Retirada Pré-Assinada
                                     </p>
                                  )}
                               </div>
                               <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                  <button
                                     onClick={() => onOpenDetails('emprestimo', ag)}
                                     className="p-3 text-slate-400 hover:text-[#10B981] bg-[var(--bg-card)] rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                     title="Ver Termo"
                                  ><Printer size={16}/></button>
                                  <button onClick={() => handleEfetivarSaidaAgenda(ag)} disabled={loadingAcaoId === ag.id} className="flex items-center gap-2 px-5 py-3 bg-[#10B981] text-white hover:bg-[#059669] rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-md transition-all shrink-0">
                                     <ArrowUpRight size={14} /> Entregar Ativo
                                  </button>
                               </div>
                            </div>
                         )
                      })
                  )}
               </div>
            </div>

            {/* EM USO HOJE */}
            <div className="bg-[var(--bg-card)] rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col transition-all duration-300 h-fit max-h-[500px]">
               <div className="p-6 md:p-8 flex justify-between items-center bg-[var(--bg-page)]/50 /50 shrink-0">
                  <div className="flex items-center gap-3 text-[#254E70]">
                     <Clock size={18} />
                     <h3 className="font-bold text-sm uppercase tracking-widest text-slate-900 dark:text-white">Saídas Recentes (Em Uso)</h3>
                  </div>
                  {emUsoHoje.length > 0 && <span className="bg-[#254E70] text-white text-[10px] font-black px-2 py-1 rounded-md shadow-sm">{emUsoHoje.length}</span>}
               </div>
               <div className="p-6 md:p-8 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
                  {emUsoHoje.length === 0 ? (
                      <p className="text-xs text-slate-500 italic text-center py-4">Nenhuma saída realizada nas últimas horas.</p>
                  ) : (
                      emUsoHoje.map(emp => {
                        return (
                          <div key={emp.id} onClick={() => onOpenDetails('emprestimo', emp)} className="flex flex-col xl:flex-row xl:items-center justify-between p-4 bg-[var(--bg-page)] rounded-[1.5rem] group transition-all gap-4 shadow-sm cursor-pointer hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card-dark)]">
                             <div className="flex-1 overflow-hidden pr-2">
                                <div className="flex flex-col">
                                   <p className="text-xs font-black text-slate-900 dark:text-white flex items-center truncate uppercase tracking-tight">
                                      <span className="bg-[#254E70]/10 text-[#254E70] dark:text-[#38bdf8] px-2 py-0.5 rounded-md shadow-sm text-[10px] font-black mr-2">PEDIDO #{emp.protocolo || emp.id.split('-')[0].toUpperCase()}</span> 
                                      <span className="truncate">{emp.itens?.length || 1} ATIVO{(emp.itens?.length || 1) !== 1 ? 'S' : ''} VINCULADOS</span>
                                   </p>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2 uppercase flex items-center gap-1.5 truncate"><User size={12}/> {emp.solicitante || emp.get('nome_solicitante')} ({emp.get('setor_solicitante')})</p>
                                <p className="text-[10px] font-bold uppercase mt-1 flex items-center gap-1.5 text-[#8D3046]"><Clock size={12}/> Saiu às {emp.createdAt?.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                             </div>
                             <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                <button onClick={() => onOpenDetails('emprestimo', emp)} className="p-3 text-slate-400 hover:text-[#254E70] bg-[var(--bg-card)] rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100" title="Ver Detalhes"><Printer size={16}/></button>
                                <button onClick={() => handleDevolver(emp)} disabled={loadingAcaoId === emp.id} className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 shadow-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20">
                                  {loadingAcaoId === emp.id ? '...' : <><CheckCircle size={14}/> Receber</>}
                                </button>
                             </div>
                          </div>
                        )
                      })
                  )}
               </div>
            </div>

          </div>

          {/* LADO DIREITO */}
          <div className="flex flex-col gap-8">
             
             {/* ATRASOS CRÍTICOS */}
             <div className="bg-[var(--bg-card)] rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col transition-all duration-300 h-fit max-h-[500px]">
               <div className="p-6 md:p-8 flex justify-between items-center bg-[var(--bg-page)]/50 /50 shrink-0">
                  <div className={`flex items-center gap-3 ${atrasados.length > 0 ? 'text-[#8D3046]' : 'text-slate-500'}`}>
                     <AlertTriangle size={18} />
                     <h3 className="font-bold text-sm uppercase tracking-widest text-slate-900 dark:text-white">Atrasos Críticos</h3>
                  </div>
                  {atrasados.length > 0 && <span className="bg-[#8D3046] text-white text-[10px] font-black px-2 py-1 rounded-md shadow-sm">{atrasados.length}</span>}
               </div>

               <div className="p-6 md:p-8 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
                  {atrasados.length === 0 ? (
                      <p className="text-xs text-slate-500 italic text-center py-4">Nenhum equipamento em atraso.</p>
                  ) : (
                      atrasados.map(emp => {
                        const diasAtraso = Math.floor((new Date() - emp.createdAt) / (1000 * 60 * 60 * 24));
                        const isCobrado = cobradosIds.includes(emp.id) || !!emp.get('alerta_cobranca');
                        
                        return (
                          <div key={emp.id} onClick={() => onOpenDetails('emprestimo', emp)} className="flex flex-col xl:flex-row xl:items-center justify-between p-5 bg-[var(--bg-page)] rounded-[1.5rem] transition-all gap-5 shadow-sm cursor-pointer hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card-dark)] group">
                             <div className="flex-1 overflow-hidden pr-2">
                                <div className="flex flex-col">
                                   <p className="text-xs font-black text-slate-900 dark:text-white flex items-center truncate uppercase tracking-tight">
                                      <span className="bg-[#254E70]/10 text-[#254E70] dark:text-[#38bdf8] px-2 py-0.5 rounded-md shadow-sm text-[10px] font-black mr-2">PEDIDO #{emp.protocolo || emp.id.split('-')[0].toUpperCase()}</span> 
                                      <span className="truncate">{emp.itens?.length || 1} ATIVO{(emp.itens?.length || 1) !== 1 ? 'S' : ''} VINCULADOS</span>
                                   </p>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2 uppercase flex items-center gap-1.5 truncate"><User size={12} className="shrink-0"/> {emp.solicitante || emp.get('nome_solicitante')} ({emp.get('setor_solicitante')})</p>
                                <p className="text-[10px] font-bold uppercase mt-1 flex items-center gap-1.5 text-[#8D3046]"><Clock size={12}/> Atrasado há {diasAtraso} dia(s)</p>
                             </div>
                             
                             <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                                <button onClick={() => onOpenDetails('emprestimo', emp)} className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-[var(--bg-card)] rounded-xl transition-all shadow-sm" title="Ver Termo"><Printer size={16}/></button>
                                
                                <button onClick={() => handleCobrar(emp)} disabled={isCobrado} className={`flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm ${isCobrado ? 'bg-slate-200 dark:bg-[var(--bg-card)]/5 text-slate-500 cursor-not-allowed' : 'bg-[var(--bg-card)] text-slate-700 dark:text-slate-300 hover:bg-[var(--bg-page)]'}`}>
                                   {isCobrado ? <><CheckCircle2 size={14}/> Cobrado</> : 'Cobrar'}
                                </button>
                                <button onClick={() => handleDevolver(emp)} disabled={loadingAcaoId === emp.id} className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-md bg-[#8D3046] hover:bg-red-600 text-white">
                                   {loadingAcaoId === emp.id ? '...' : <><ArrowDownLeft size={14}/> Receber</>}
                                </button>
                             </div>
                          </div>
                        )
                      })
                  )}
               </div>
             </div>

             {/* DEVOLUÇÕES CONCLUÍDAS HOJE */}
             <div className="bg-[var(--bg-card)] rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col transition-all duration-300 h-fit max-h-[500px]">
               <div className="p-6 md:p-8 flex justify-between items-center bg-[var(--bg-page)]/50 /50 shrink-0">
                  <div className="flex items-center gap-3 text-emerald-500">
                     <CalendarClock size={18} />
                     <h3 className="font-bold text-sm uppercase tracking-widest text-slate-900 dark:text-white">Devoluções Diárias</h3>
                  </div>
                  {devolucoesHoje.length > 0 && <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-md shadow-sm">{devolucoesHoje.length}</span>}
               </div>

               <div className="p-6 md:p-8 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
                  {devolucoesHoje.length === 0 ? (
                      <p className="text-xs text-slate-500 italic text-center py-4">Nenhum equipamento foi devolvido hoje.</p>
                  ) : (
                      devolucoesHoje.map(emp => {
                        return (
                          <div key={emp.id} onClick={() => onOpenDetails('emprestimo', emp)} className="flex flex-col xl:flex-row xl:items-center justify-between p-5 bg-[var(--bg-page)] rounded-[1.5rem] transition-all gap-5 shadow-sm cursor-pointer hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card-dark)] group">
                             <div className="flex-1 overflow-hidden pr-2">
                                <div className="flex flex-col">
                                   <p className="text-xs font-black text-slate-900 dark:text-white flex items-center truncate uppercase tracking-tight">
                                      <span className="bg-[#254E70]/10 text-[#254E70] dark:text-[#38bdf8] px-2 py-0.5 rounded-md shadow-sm text-[10px] font-black mr-2">PEDIDO #{emp.protocolo || emp.id.split('-')[0].toUpperCase()}</span> 
                                      <span className="truncate">{emp.itens?.length || 1} ATIVO{(emp.itens?.length || 1) !== 1 ? 'S' : ''} VINCULADOS</span>
                                   </p>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2 uppercase flex items-center gap-1.5 truncate"><User size={12}/> Devolvido por: {emp.solicitante || emp.get('nome_solicitante')}</p>
                                <p className="text-[10px] font-bold uppercase mt-1 flex items-center gap-1.5 text-emerald-500"><CheckCircle2 size={12}/> Recebido às {emp.get('data_hora_retorno')?.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                             </div>
                             
                             <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                                <button onClick={() => onOpenDetails('emprestimo', emp)} className="flex items-center gap-2 p-3 text-slate-500 hover:text-emerald-500 bg-[var(--bg-card)] rounded-xl transition-all shadow-sm" title="Ver Detalhes">
                                  <Printer size={16}/> <span className="text-[10px] font-bold uppercase tracking-widest">Detalhes</span>
                                </button>
                             </div>
                          </div>
                        )
                      })
                  )}
               </div>
            </div>
          </div>
        </>
      )}

      <HandoverModal 
        isOpen={!!modalAssinatura} 
        onClose={() => setModalAssinatura(null)}
        onConfirm={confirmarHandover}
        tipo={modalAssinatura?.tipo}
        solicitante={modalAssinatura?.grupo?.solicitante || modalAssinatura?.grupo?.get?.('nome_solicitante')}
        setor={modalAssinatura?.grupo?.get?.('setor_solicitante')}
        itens={modalAssinatura?.grupo?.itens}
        loading={!!loadingAcaoId}
        preAssinado={!!modalAssinatura?.grupo?.itens?.[0]?.get?.('assinatura_eletronica') || !!modalAssinatura?.grupo?.assinatura_eletronica}
        detalhesAssinaturaPortal={modalAssinatura?.grupo?.itens?.[0]?.get?.('detalhes_assinatura') || modalAssinatura?.grupo?.get?.('detalhes_assinatura')}
      />
    </div>
  );
}
