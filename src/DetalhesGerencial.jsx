import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from './utils/apiClient';
import {
  ArrowLeft, Calendar, FileText, User,
  MapPin, Clock, ShieldCheck, Printer,
  Trash2, Save, Send, CheckCircle2, AlertTriangle, Package,
  Circle, CheckCircle
} from 'lucide-react';
import VoucherPreview from './VoucherPreview';
import TicketPreview from './TicketPreview';
import HandoverModal from './HandoverModal';
import { logAction } from './utils/log';
import { solveGLPITicket } from './utils/glpiClient';
import { generateAndUploadPDF } from './utils/pdfArchive';
import { useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_CHAMADOS_API_BASE || 'http://localhost:3000/api';

export default function DetalhesGerencial({ itemDetalhado: itemProp, setItemDetalhado, onVoltar, onUpdateItem }) {
  const navigate = useNavigate();
  const { ano, serial, protocoloUnico } = useParams();
  const [internalItem, setInternalItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [showModalDevolucao, setShowModalDevolucao] = useState(false);
  const [showModalRetirada, setShowModalRetirada] = useState(false);
  const pdfContainerRef = useRef(null);

  // Variável padronizada para os títulos/labels, com as classes EXATAS do Sidebar
  const titleSidebarStyle = "text-[13px] font-bold tracking-tight text-slate-500 dark:text-[#606060] block px-1 mb-2 normal-case";

  // Helper para envolver objetos (mesmo do NovoEmprestimo)
  const wrap = (obj, relationships = {}) => {
    if (!obj) return null;
    return {
      ...obj,
      id: obj.id,
      createdAt: new Date(obj.created_at),
      updatedAt: new Date(obj.updated_at),
      get: (field) => {
        if (relationships[field]) return wrap(obj[field]);
        if (field === 'item') return wrap(obj.item);
        if (field === 'tecnico_saida') return wrap(obj.tecnico_saida);
        if (field === 'tecnico_retorno') return wrap(obj.tecnico_retorno);
        if (field === 'data_reserva' || field === 'data_inicio_prevista') return obj.data_inicio_prevista ? new Date(obj.data_inicio_prevista) : null;
        if (field === 'data_devolucao_prevista' && obj.data_devolucao_prevista) return new Date(obj.data_devolucao_prevista);
        if (field === 'data_hora_retorno' && obj.data_hora_retorno) return new Date(obj.data_hora_retorno);
        return obj[field];
      }
    };
  };

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

  const fetchByProtocol = async () => {
    // 🚀 INSPIRAÇÃO NOS EMPRÉSTIMOS: Se já temos os dados via prop e não estamos em uma URL de busca, usamos o que temos.
    if (itemProp && !ano && !serial && !protocoloUnico) {
      setInternalItem(itemProp);
      setLoading(false);
      return;
    }

    const protocoloQuery = (ano && serial) ? `${ano}/${serial}` : (protocoloUnico || null);
    const targetId = itemProp?.dados?.id;

    // Se não tem protocolo nem ID para buscar, para o loading
    if (!protocoloQuery && !targetId) {
      setLoading(false);
      return;
    }

    if (targetId && !protocoloQuery) {
      setLoading(true);
      try {
      const { data: empData } = await api.emprestimos.list({ id_eq: targetId });
      // Fallback: busca por ID direto
      const result_data = empData || [];
      // Tenta GET por ID direto
      const { data: single } = await api.emprestimos.get(targetId);
      const rows = single ? [single] : result_data;
        if (empData && empData.length > 0) {
          const result = { tipo: 'emprestimo', dados: { ...wrap(rows[0]), itens: rows.map(o => wrap(o)) } };
          setInternalItem(result);
          if (setItemDetalhado) setItemDetalhado(result);
        }
      } catch (err) { console.error("Erro ao buscar por ID:", err); }
      setLoading(false);
      return;
    }

    if (protocoloQuery) {
      setLoading(true);
      try {
        // Se o protocolo tiver hífen ou NÃO tiver barra, tratamos como CHAMADO
        if (protocoloQuery.includes('-') || !protocoloQuery.includes('/')) {
          const API_BASE = import.meta.env.VITE_CHAMADOS_API_BASE || 'http://localhost:3000/api';
          const resp = await fetch(`${API_BASE}/chamados`);
          if (resp.ok) {
            const chamados = await resp.json();
            const chamadoEncontrado = chamados.find(c => c.protocolo?.toLowerCase() === protocoloQuery.toLowerCase());
            if (chamadoEncontrado) {
              const result = { tipo: 'chamado', dados: chamadoEncontrado };
              setInternalItem(result);
              if (setItemDetalhado) setItemDetalhado(result);
              setLoading(false);
              return;
            }
          }
        }

        const { data: emps } = await api.emprestimos.list({ protocolo: protocoloQuery });

        if (emps && emps.length > 0) {
          const base = emps[0];
          const grouped = {
            ...wrap(base),
            id: base.protocolo || base.id,
            protocolo: base.protocolo,
            nome_solicitante: base.nome_solicitante,
            setor_solicitante: base.setor_solicitante,
            status_emprestimo: base.status_emprestimo,
            dataSaida: base.created_at,
            created_at: base.created_at,
            assinatura_eletronica: base.assinatura_eletronica,
            detalhes_assinatura: base.detalhes_assinatura,
            verificado_por_agente: base.verificado_por_agente,
            quem_vai_buscar: base.quem_vai_buscar,
            nome_tecnico_saida: base.nome_tecnico_saida,
            assinatura_dev_eletronica: base.assinatura_dev_eletronica,
            detalhes_assinatura_dev: base.detalhes_assinatura_dev,
            quem_vai_entregar: base.quem_vai_entregar,
            nome_tecnico_retorno: base.nome_tecnico_retorno,
            data_hora_retorno: base.data_hora_retorno,
            observacoes: base.observacoes,
            itens: emps.map(o => wrap(o))
          };
          const result = { tipo: 'emprestimo', dados: grouped };
          setInternalItem(result);
          if (setItemDetalhado) setItemDetalhado(result);
        }
      } catch (e) {
        console.error('Erro ao buscar por protocolo:', e);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchByProtocol();
  }, [ano, serial, protocoloUnico]);

  // Redirecionamento automático para URL de protocolo se disponível
  useEffect(() => {
    if (itemProp?.dados?.protocolo && !ano && !serial) {
      navigate(`/${itemProp.dados.protocolo}`, { replace: true });
    }
  }, [itemProp, ano, serial, navigate]);

  const itemDetalhado = internalItem || itemProp;

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-10">
        <Clock size={48} className="mb-4 animate-spin text-[#8D3046]" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Buscando protocolo {ano}/{serial}...</p>
      </div>
    );
  }

  if (!itemDetalhado || !itemDetalhado.dados) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-10 opacity-40">
        <AlertTriangle size={48} className="mb-4" />
        <p className="text-xs font-black uppercase tracking-widest">Nenhum dado selecionado</p>
        <button onClick={onVoltar} className="mt-6 px-6 py-3 bg-[var(--bg-soft)] rounded-xl text-[10px] font-black uppercase tracking-widest">Voltar</button>
      </div>
    );
  }

  const { tipo, dados } = itemDetalhado;
  const itens = dados?.itens || (dados ? [dados] : []);

  // NORMALIZAÇÃO DE DADOS (Diferentes estruturas para Empréstimo vs Chamado)
  const isEmprestimo = tipo === 'emprestimo';
  const primeiroItem = (isEmprestimo && itens && itens.length > 0) ? itens[0] : null;

  const tryExtractFromText = (text) => {
    if (!text) return {};
    const extract = (regex) => {
      const match = text.match(regex);
      return match ? match[1].trim() : null;
    };
    return {
      solicitante: extract(/SOLICITANTE:\s*(.+)/i),
      setor: extract(/SETOR:\s*(.+)/i),
      tecnico: extract(/TÉCNICO:\s*(.+)/i),
      protocolo: extract(/PROTOCOLO:\s*([^\s]+)/i)
    };
  };

  const extraData = tryExtractFromText(dados.observacoes || dados.descricao || '');

  const protocoloExibicao = extraData.protocolo || (tipo === 'chamado' && String(dados.id)) || dados.protocolo || 'N/I';

  // Se veio do GLPI mas pegou o título errado, tenta sobrescrever com os dados extraídos do texto
  let nomeNormalizado = dados.nome_solicitante || dados.solicitante || dados.nome || 'N/I';
  if (nomeNormalizado.toUpperCase().includes('PROTOCOLO') && extraData.solicitante) {
    nomeNormalizado = extraData.solicitante;
  } else if (nomeNormalizado === 'N/I' && extraData.solicitante) {
    nomeNormalizado = extraData.solicitante;
  }

  const setorNormalizado = extraData.setor || dados.setor_solicitante || dados.setor || 'N/I';

  const tecnicoSaida = isEmprestimo
    ? (primeiroItem?.get?.('nome_tecnico_saida') || dados.nome_tecnico_saida || primeiroItem?.get?.('tecnico_saida')?.username || extraData.tecnico || 'SISTEMA')
    : (dados.tecnico || dados.tecnico_atendimento || extraData.tecnico || 'SISTEMA');

  // Técnico de Retorno
  const tecnicoRetorno = isEmprestimo
    ? (primeiroItem?.get?.('nome_tecnico_retorno') || dados.nome_tecnico_retorno || primeiroItem?.get?.('tecnico_retorno')?.username || 'PENDENTE')
    : 'N/A';

  const statusNormalizado = isEmprestimo ? (dados.status_emprestimo || primeiroItem?.get?.('status_emprestimo')) : dados.status;
  const isAberto = statusNormalizado === 'Aberto';
  const isAprovado = statusNormalizado === 'Aprovado';
  const isPendente = statusNormalizado === 'Pendente';

  // Datas
  const dataCriacao = isEmprestimo ? (dados.created_at) : (dados.criado_em || dados.data || dados.created_at);
  const dataSaidaReal = isEmprestimo
    ? (statusNormalizado === 'Devolvido' || statusNormalizado === 'Aberto' || statusNormalizado === 'Consumido'
      ? (extractDateFromSignature(dados.detalhes_assinatura || dados.verificado_por_agente) || dados.dataSaida || dados.created_at)
      : null)
    : (dados.finalizado_em || dados.atualizado_em || dados.updated_at);
  const dataRetornoReal = isEmprestimo ? (primeiroItem?.get?.('data_hora_retorno') || dados.data_hora_retorno) : (statusNormalizado === 'Concluído' ? (dados.finalizado_em || dados.atualizado_em) : null);



  const handleConfirmRetirada = async (nomeResponsavel) => {
    setLoadingAction(true);
    try {
      const agora = new Date();
      const textoAssinatura = `EQUIPAMENTO RETIRADO E TERMO ASSINADO POR AGENTE EM CONJUNTO COM ${nomeResponsavel.toUpperCase()} EM ${agora.toLocaleDateString('pt-BR')} ÀS ${agora.toLocaleTimeString('pt-BR')}`;

      const { data: userProfile } = await api.users.get(localStorage.getItem('tilend_user_id'));

      for (const emp of itens) {
        await api.emprestimos.update(emp.id, {
          status_emprestimo: 'Aberto',
          nome_tecnico_saida: userProfile?.username || 'SISTEMA',
          assinatura_eletronica: true,
          detalhes_assinatura: textoAssinatura,
          quem_vai_buscar: nomeResponsavel,
          created_at: agora.toISOString()
        });
      }

      // PDF removido para evitar o erro do OKLCH e travamentos.

      if (onUpdateItem) onUpdateItem();
      setShowModalRetirada(false);
      setTimeout(fetchByProtocol, 500);
    } catch (e) {
      console.error('Erro na retirada:', e);
      alert('Erro ao registrar saída: ' + e.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleConfirmDevolucao = async (nomeResponsavel) => {
    setLoadingAction(true);
    try {
      const agora = new Date();
      const textoAssinatura = `TERMO DE DEVOLUÇÃO ASSINADO POR AGENTE EM CONJUNTO COM ${nomeResponsavel.toUpperCase()} EM ${agora.toLocaleDateString('pt-BR')} ÀS ${agora.toLocaleTimeString('pt-BR')}`;

      const { data: userProfile } = await api.users.get(localStorage.getItem('tilend_user_id'));
      const retornoDate = agora.toISOString();

      logAction('Devolução via Detalhes - Início', { protocolo: dados.protocolo });

      for (const emp of itens) {
        await api.emprestimos.update(emp.id, {
          status_emprestimo: 'Devolvido',
          data_hora_retorno: retornoDate,
          nome_tecnico_retorno: userProfile?.username || 'SISTEMA',
          assinatura_dev_eletronica: true,
          detalhes_assinatura_dev: textoAssinatura,
          quem_vai_entregar: nomeResponsavel
        });
      }

      // Automação GLPI (Solução Imediata)
      const firstEmp = itens[0];
      const obsRaw = firstEmp?.observacoes || dados.observacoes || '';
      const ticketMatch = obsRaw.match(/\[GLPI_TICKET: (\d+)\]/);
      const glpiTicketId = ticketMatch ? ticketMatch[1] : null;

      if (glpiTicketId) {
        try {
          const ticketIdInt = parseInt(glpiTicketId);
          await solveGLPITicket(ticketIdInt, `Equipamento devolvido e termo assinado. Protocolo: ${dados.protocolo}. Recebido por: ${nomeResponsavel}.`);
          console.log("Chamado GLPI solucionado via Detalhes!");
        } catch (err) {
          console.error("Erro na automação GLPI (Solution):", err);
        }
      }

      logAction('Devolução via Detalhes - SUCESSO', { protocolo: dados.protocolo });
      setShowModalDevolucao(false);

      if (onUpdateItem) onUpdateItem();
      setTimeout(fetchByProtocol, 500);
    } catch (e) {
      console.error('Erro na devolução:', e);
      alert('Erro ao registrar devolução: ' + e.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAprovar = async () => {
    if (!window.confirm('Tem certeza que deseja APROVAR esta requisição?')) return;
    setLoadingAction(true);
    try {
      logAction('Aprovação de Requisição - Início', { protocolo: dados.protocolo });

      for (const emp of itens) {
        await api.emprestimos.update(emp.id, { status_emprestimo: 'Aprovado' });
      }

      logAction('Aprovação de Requisição - SUCESSO', { protocolo: dados.protocolo });
      if (onUpdateItem) onUpdateItem();
      await fetchByProtocol(); // Atualiza os dados localmente sem recarregar a página
    } catch (e) {
      console.error('Erro na aprovação:', e);
      alert('Erro ao aprovar requisição: ' + e.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRecusar = async () => {
    if (!window.confirm('Tem certeza que deseja RECUSAR esta requisição? Os itens voltarão para o estoque e o pedido será cancelado.')) return;
    setLoadingAction(true);
    try {
      logAction('Recusa de Requisição - Início', { protocolo: dados.protocolo });

      for (const emp of itens) {
        const itemId = emp.item_id || emp.get?.('item_id');

        if (itemId) {
          const { data: itemBanco } = await api.items.get(itemId);
          if (itemBanco) {
            const qtdReservada = emp.quantidade_emprestada || emp.get?.('quantidade_emprestada') || 1;
            await api.items.update(itemBanco.id, { quantidade: (itemBanco.quantidade || 0) + qtdReservada });
          }
        }
        await api.emprestimos.update(emp.id, { status_emprestimo: 'Recusado' });
      }

      logAction('Recusa de Requisição - SUCESSO', { protocolo: dados.protocolo });
      if (onUpdateItem) onUpdateItem();
      await fetchByProtocol(); // Atualiza os dados localmente sem recarregar a página
    } catch (e) {
      console.error('Erro ao recusar:', e);
      alert('Erro ao recusar requisição: ' + e.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const formatarDataSegura = (d) => {
    if (!d) return 'Pendente';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return 'Não registrada';
    return dateObj.toLocaleDateString('pt-BR') + ' às ' + dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatarHoraApenas = (d) => {
    if (!d) return '--:--';
    // Se for uma string ISO longa ou formato brasileiro, o Date() costuma resolver
    const dateObj = new Date(d);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    // Fallback caso venha algo muito estranho
    console.warn("Data inválida detectada na timeline:", d);
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatarDataApenas = (d) => {
    if (!d) return '-';
    const dateObj = new Date(d);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
    return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // COMPONENTE LOCAL DE TIMELINE FINA
  const LifecycleTimeline = () => {
    let milestones = [];

    if (tipo === 'chamado') {
      const histRaw = Array.isArray(dados.historico) ? dados.historico : (typeof dados.historico === 'string' ? JSON.parse(dados.historico) : []);

      if (histRaw.length > 0) {
        // Timeline dinâmica vinda do backend (exibindo do mais antigo para o mais recente)
        milestones = [...histRaw].map((h, i) => ({
          id: `hist-${i}`,
          label: h.status?.toUpperCase(),
          date: h.data || h.criado_em || h.created_at || new Date().toISOString(),
          text: h.observacao,
          active: true,
          completed: true
        }));
      } else {
        // Fallback p/ chamados s/ histórico ou erro de carregamento (Mostra o marco atual dinamicamente)
        milestones = [
          {
            id: 'create', label: 'TICKET ABERTO',
            date: dataCriacao,
            active: true,
            completed: true
          },
          {
            id: 'current',
            label: statusNormalizado?.toUpperCase() || 'ABERTO',
            date: dados.atualizado_em || dataRetornoReal || dataSaidaReal || new Date().toISOString(),
            active: statusNormalizado !== 'Aberto',
            completed: true,
            text: dados.resolucao || dados.parecer
          }
        ];
      }
    } else {
      milestones = [
        {
          id: 'create', label: 'Pedido Criado',
          date: dataCriacao, active: true, completed: true
        },
        {
          id: 'approved', label: 'Pedido Aprovado',
          date: dados.updated_at || dataCriacao,
          active: statusNormalizado !== 'Pendente' && statusNormalizado !== 'Recusado',
          completed: statusNormalizado !== 'Pendente' && statusNormalizado !== 'Recusado'
        },
        {
          id: 'out', label: statusNormalizado === 'Consumido' ? 'Material Fornecido' : 'Pedido Retirado',
          date: dataSaidaReal,
          active: !!tecnicoSaida && tecnicoSaida !== 'SISTEMA',
          completed: !!tecnicoSaida && tecnicoSaida !== 'SISTEMA'
        },
        ...(statusNormalizado === 'Consumido' ? [] : [{
          id: 'in', label: 'Pedido Devolvido',
          date: dataRetornoReal,
          active: !!dataRetornoReal, completed: !!dataRetornoReal
        }]),
        {
          id: 'done', label: 'Concluído',
          date: (statusNormalizado === 'Fechado' || statusNormalizado === 'Concluído' || statusNormalizado === 'Consumido') ? (dataRetornoReal || dados.updated_at || dataSaidaReal) : null,
          active: (statusNormalizado === 'Fechado' || statusNormalizado === 'Concluído' || statusNormalizado === 'Consumido'),
          completed: (statusNormalizado === 'Fechado' || statusNormalizado === 'Concluído' || statusNormalizado === 'Consumido')
        }
      ];
    }

    const activeMilestones = milestones.filter(m => m.active);

    return (
      <div className="flex flex-col h-full py-2">
        <div className="flex-1 relative ml-1 pt-4">

          <div className="space-y-12 relative">
            {activeMilestones.map((m, idx) => {
              const isLast = idx === activeMilestones.length - 1;
              return (
                <div key={m.id} className="flex gap-4 relative animate-in slide-in-from-right-2 duration-300">

                  {/* Container do Ponto e Linha */}
                  <div className="flex flex-col items-center shrink-0 relative">
                    {/* Linha Conectora (Segmentada) */}
                    {!isLast && (
                      <div className="absolute top-3 w-0.5 h-[calc(100%+48px)] bg-slate-100 dark:bg-white/5" />
                    )}

                    {/* Ponto (Indicador) */}
                    <div className={`z-10 w-2.5 h-2.5 rounded-full mt-[5px] transition-all duration-500 ${isLast
                      ? 'bg-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.3)] dark:bg-emerald-500' // Verde pra destaque no mais recente
                      : 'bg-slate-300 dark:bg-[#404040]'
                      }`} />
                  </div>

                  {/* Labels */}
                  <div className="flex flex-col mb-4">
                    <div className="flex items-center gap-4 justify-between w-full">
                      <span className={`text-[11px] font-black uppercase tracking-tight leading-tight ${isLast ? 'text-slate-900 dark:text-white' : 'text-[#254E70] dark:text-blue-400'
                        }`}>
                        {m.label}
                      </span>
                      <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {formatarDataApenas(m.date)} ÀS {formatarHoraApenas(m.date)}
                      </span>
                    </div>
                    {m.text && (
                      <p className="text-[11px] mt-1 text-slate-500 dark:text-[#808080] italic leading-relaxed">
                        {m.text}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500 overflow-hidden relative">
      {/* PAINEL DIVIDIDO (SPLIT SCREEN) */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden min-h-0">

        {/* LADO ESQUERDO: PREVISUALIZAÇÃO (DOCUMENTO) - EXPANDE NA IMPRESSÃO */}
        <div className="xl:flex-[0.6] h-full flex flex-col min-h-0 overflow-hidden rounded-[2.5rem] print-full-width print-container" ref={pdfContainerRef}>
          <div className="flex-1 overflow-y-auto custom-scrollbar-thin">
            <div className="h-full transform-gpu">
              {tipo === 'emprestimo' ? (
                <VoucherPreview dados={dados} isPrintable={true} />
              ) : (
                <TicketPreview dados={dados} />
              )}
            </div>
          </div>
        </div>

        {/* LADO DIREITO: GRID COCKPIT (DADOS + TIMELINE) - OCULTO NA IMPRESSÃO */}
        <div className="no-print flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-page)] dark:bg-transparent">

          {/* CONTEÚDO ESTRUTURADO COM GRID DUPLO */}
          <div className="flex-1 overflow-y-auto custom-scrollbar-thin px-6 md:px-10 pt-4 pb-2">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-12 items-start h-full pb-10">

              {/* COLUNA DE DADOS TÉCNICOS - COMPACTADA */}
              <div className="space-y-12 max-w-lg ml-auto w-full pt-4">
                {/* SEÇÃO 2: DADOS DO REQUISITANTE */}
                <section className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 text-left">
                    <div className="space-y-2">
                      <label className={titleSidebarStyle}>Nome Completo</label>
                      <div className="bg-[var(--bg-card)] dark:bg-white/5 p-4 rounded-xl min-h-[52px] flex items-center">
                        <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase truncate">{nomeNormalizado}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={titleSidebarStyle}>{tipo === 'chamado' ? 'Email de Contato' : 'Setor / Área'}</label>
                      <div className="bg-[var(--bg-card)] dark:bg-white/5 p-4 rounded-xl min-h-[52px] flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase truncate">{tipo === 'chamado' ? (dados.email || 'N/I') : setorNormalizado}</span>
                        {tipo === 'emprestimo' && (
                          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500 bg-slate-200 dark:bg-white/5 px-2 py-0.5 rounded ml-auto">
                            {statusNormalizado === 'Consumido' || (dados.protocolo && dados.protocolo.endsWith('IS')) ? 'INSUMO' : 'ATIVO'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* SEÇÃO 3: AUDITORIA DE MOVIMENTAÇÃO */}
                <section className="space-y-6">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                    <div className="col-span-2 space-y-2">
                      <label className={titleSidebarStyle}>Abertura do Chamado</label>
                      <div className="bg-[var(--bg-card)] dark:bg-white/5 p-4 rounded-xl min-h-[52px] flex items-center gap-3">
                        <Clock size={12} className="text-slate-400" />
                        <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase truncate">{formatarDataSegura(dataCriacao)}</span>
                      </div>
                    </div>

                    {tipo === 'emprestimo' && (
                      <>
                        <div className="space-y-2">
                          <label className={titleSidebarStyle}>Técnico (Saída)</label>
                          <div className="bg-[var(--bg-card)] dark:bg-white/5 p-4 rounded-xl min-h-[52px] flex items-center gap-3">
                            <User size={12} className="text-slate-400" />
                            <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase truncate">{tecnicoSaida}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className={titleSidebarStyle}>Data/Hora Saída</label>
                          <div className="bg-[var(--bg-card)] dark:bg-white/5 p-4 rounded-xl min-h-[52px] flex items-center gap-3">
                            <Clock size={12} className="text-emerald-500" />
                            <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase">{formatarDataSegura(dataSaidaReal)}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className={titleSidebarStyle}>Técnico (Retorno)</label>
                          <div className="bg-[var(--bg-card)] dark:bg-white/5 p-4 rounded-xl min-h-[52px] flex items-center gap-3">
                            <User size={12} className="text-slate-400" />
                            <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase truncate">
                              {statusNormalizado === 'Consumido' ? 'INSUMO' : tecnicoRetorno}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className={titleSidebarStyle}>Data/Hora Retorno</label>
                          <div className="bg-[var(--bg-card)] dark:bg-white/5 p-4 rounded-xl min-h-[52px] flex items-center gap-3">
                            <Clock size={12} className={statusNormalizado === 'Consumido' ? 'text-slate-400' : 'text-blue-500'} />
                            <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase">
                              {statusNormalizado === 'Consumido' ? 'INSUMO' : formatarDataSegura(dataRetornoReal)}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                {/* SEÇÃO 4: RECURSOS OU CONTEXTO */}
                <section className="space-y-6">
                  {tipo === 'emprestimo' && (
                    <div className="bg-[var(--bg-card)] dark:bg-white/5 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                      {itens?.map((item, idx) => (
                        <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400"><Package size={16} /></div>
                            <div>
                              <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{item.nome || item.get?.('item')?.get?.('nome_equipamento')}</p>
                              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                                {item.modelo || item.get?.('item')?.get?.('modelo_detalhes') || 'Mod: N/I'}
                                {(item.numero_serie || item.get?.('item')?.get?.('numero_serie') || item.get?.('numero_serie')) && ` | SN: ${item.numero_serie || item.get?.('item')?.get?.('numero_serie') || item.get?.('numero_serie')}`}
                              </p>
                            </div>
                          </div>
                          <div className="px-3 py-1 bg-[var(--bg-page)] dark:bg-white/5 rounded-lg">
                            <span className="text-[11px] font-black text-[#254E70] dark:text-blue-400">x{item.quantidade || item.get?.('quantidade_emprestada') || 1}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Observações do Empréstimo */}
                  {tipo === 'emprestimo' && dados.observacoes && (
                    <div className="space-y-2">
                      <label className={titleSidebarStyle}>Observações</label>
                      <div className="bg-[var(--bg-card)] dark:bg-white/5 p-4 rounded-xl">
                        <p className="text-[11px] font-bold text-slate-700 dark:text-[#A0A0A0] leading-relaxed">
                          {dados.observacoes.replace('[PORTAL] ', '').replace('[PORTAL]', '').trim()}
                        </p>
                      </div>
                    </div>
                  )}
                  {tipo === 'chamado' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className={titleSidebarStyle}>Novo Status</label>
                          <select
                            id="ticket-status-select"
                            className="w-full bg-[var(--bg-card)] dark:bg-white/5 p-4 rounded-xl text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#254E70]/50"
                            defaultValue={statusNormalizado}
                            disabled={statusNormalizado === 'Concluído'}
                          >
                            <option className="bg-[var(--bg-card)] dark:bg-slate-900 text-slate-900 dark:text-white" value="Aberto">Aberto</option>
                            <option className="bg-[var(--bg-card)] dark:bg-slate-900 text-slate-900 dark:text-white" value="Em Atendimento">Em Atendimento</option>
                            <option className="bg-[var(--bg-card)] dark:bg-slate-900 text-slate-900 dark:text-white" value="Pendente">Pendente</option>
                            <option className="bg-[var(--bg-card)] dark:bg-slate-900 text-slate-900 dark:text-white" value="Pendencia Concluída">Pendencia Concluída</option>
                            <option className="bg-[var(--bg-card)] dark:bg-slate-900 text-slate-900 dark:text-white" value="Concluído">Concluído</option>
                            <option className="bg-[var(--bg-card)] dark:bg-slate-900 text-slate-900 dark:text-white" value="Cancelado">Cancelado</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className={titleSidebarStyle}>Definir Prioridade</label>
                          <select
                            id="ticket-priority-select"
                            className="w-full bg-[var(--bg-card)] dark:bg-white/5 p-4 rounded-xl text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#254E70]/50"
                            defaultValue={dados.prioridade || 'Normal'}
                          >
                            <option className="bg-[var(--bg-card)] dark:bg-slate-900 text-slate-900 dark:text-white" value="Baixa">Baixa</option>
                            <option className="bg-[var(--bg-card)] dark:bg-slate-900 text-slate-900 dark:text-white" value="Normal">Normal</option>
                            <option className="bg-[var(--bg-card)] dark:bg-slate-900 text-slate-900 dark:text-white" value="Alta">Alta</option>
                            <option className="bg-[var(--bg-card)] dark:bg-slate-900 text-slate-900 dark:text-white" value="Urgente">🚨 Urgente</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {dados.observacao && (
                          <div className="space-y-2 mb-2 animate-in fade-in slide-in-from-top-2 duration-500">
                            <label className={titleSidebarStyle}>Parecer / Última Atualização</label>
                            <div className="bg-[var(--bg-page)] dark:bg-white/5 border border-slate-100 dark:border-white/5 p-4 rounded-xl">
                              <p className="text-[10px] font-bold text-slate-600 dark:text-[#A0A0A0] leading-relaxed italic">
                                "{dados.observacao}"
                              </p>
                            </div>
                          </div>
                        )}
                        <label className={titleSidebarStyle}>Resolução / Parecer Técnico</label>
                        <textarea
                          className="w-full bg-[var(--bg-card)] dark:bg-white/5 p-4 rounded-xl min-h-[120px] text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#254E70]/50 resize-none transition-colors"
                          placeholder="Descreva o procedimento realizado para adicionar ao histórico..."
                          id="ticket-resolution-text"
                          disabled={statusNormalizado === 'Concluído'}
                        />
                      </div>
                    </div>
                  )}

                  {/* ANEXOS (MOVIDO DA ESQUERDA PARA A DIREITA) */}
                  {tipo === 'chamado' && (dados.imagens || dados.imagen) && (dados.imagens || dados.imagen).length > 0 && (
                    <div className="space-y-3 mt-8">
                      <label className={titleSidebarStyle}>Arquivos e Documentos Anexados</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(dados.imagens || dados.imagen).map((imgUrl, idx) => {
                          const isPdf = imgUrl.toLowerCase().endsWith('.pdf');
                          const fullUrl = imgUrl.startsWith('http') ? imgUrl : `${API_BASE_URL}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;

                          return (
                            <a key={idx} href={fullUrl} target="_blank" rel="noopener noreferrer" className="relative group block w-full h-14 bg-[var(--bg-card)] dark:bg-white/5 rounded-xl overflow-hidden hover:opacity-80 transition-all border border-slate-100 dark:border-white/5">
                              {isPdf ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <FileText size={18} className="text-[#254E70] dark:text-blue-400 mb-1" />
                                  <span className="text-[7px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest text-center w-full truncate px-1">PDF</span>
                                </div>
                              ) : (
                                <img src={fullUrl} alt={`Anexo ${idx + 1}`} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity group-hover:scale-105 duration-300" />
                              )}
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* COLUNA 2: LINHA DO TEMPO FINA (MILESTONES) */}
              <div className="h-full flex flex-col min-h-0">
                <LifecycleTimeline />
              </div>

            </div>
          </div>

          {/* RODAPÉ DE AÇÕES - FIXO E TRANSPARENTE */}
          <div className="no-print pt-6 px-6 md:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-12 items-start">
              <div className="max-w-lg ml-auto w-full">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handlePrint}
                    className="p-4 bg-[var(--bg-card)] dark:bg-white/5 text-slate-500 dark:text-[#606060] hover:text-[#254E70] rounded-2xl transition-all flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest"
                  >
                    <Printer size={18} /> Imprimir
                  </button>

                  {tipo === 'emprestimo' && isAberto && (
                    <button
                      onClick={() => setShowModalDevolucao(true)}
                      disabled={loadingAction}
                      className="flex-1 py-4 bg-[#8D3046] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {loadingAction ? 'Processando...' : <><CheckCircle2 size={18} /> Registrar Devolução</>}
                    </button>
                  )}

                  {tipo === 'emprestimo' && isAprovado && (
                    <button
                      onClick={() => setShowModalRetirada(true)}
                      disabled={loadingAction}
                      className="flex-1 py-4 bg-[#254E70] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {loadingAction ? 'Processando...' : <><Send size={18} /> Efetivar Retirada</>}
                    </button>
                  )}

                  {tipo === 'emprestimo' && !isAberto && !isAprovado && !isPendente && statusNormalizado !== 'Recusado' && (
                    <div className="flex-1 py-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3">
                      <ShieldCheck size={18} /> Pedido Concluído
                    </div>
                  )}

                  {tipo === 'emprestimo' && statusNormalizado === 'Recusado' && (
                    <div className="flex-1 py-4 bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3">
                      <AlertTriangle size={18} /> Pedido Recusado
                    </div>
                  )}

                  {tipo === 'emprestimo' && isPendente && (
                    <>
                      <button
                        onClick={handleRecusar}
                        disabled={loadingAction}
                        className="py-4 px-6 bg-red-500/10 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 flex z-10 items-center justify-center gap-2 disabled:opacity-50 transition-colors shrink-0"
                      >
                        <Trash2 size={16} /> <span className="hidden md:inline">Recusar</span>
                      </button>
                      <button
                        onClick={handleAprovar}
                        disabled={loadingAction}
                        className="flex-1 py-4 bg-[#10B981] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                        {loadingAction ? 'Processando...' : <><CheckCircle2 size={18} /> Aprovar Pedido</>}
                      </button>
                    </>
                  )}

                  {tipo === 'chamado' && (
                    <button
                      disabled={loadingAction || statusNormalizado === 'Concluído'}
                      onClick={async () => {
                        if (statusNormalizado === 'Concluído') return;

                        const statusSelectValue = document.getElementById('ticket-status-select')?.value;
                        const prioritySelectValue = document.getElementById('ticket-priority-select')?.value;
                        const novoStatus = statusSelectValue || (statusNormalizado === 'Aberto' ? 'Em Atendimento' : 'Concluído');

                        setLoadingAction(true);
                        try {
                          const observacaoText = document.getElementById('ticket-resolution-text')?.value;
                          const payload = {
                            status: novoStatus,
                            prioridade: prioritySelectValue
                          };
                          if (observacaoText && observacaoText.trim() !== '') {
                            payload.observacao = observacaoText;
                          }

                          const API_BASE = import.meta.env.VITE_CHAMADOS_API_BASE || 'http://localhost:3000/api';
                          const resp = await fetch(`${API_BASE}/chamados/${dados.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                          });

                          if (!resp.ok) throw new Error('Erro na requisição');

                          const dadosAtualizados = await resp.json();

                          // 🚀 ATUALIZAÇÃO IMEDIATA: Atualiza o estado local e global
                          const result = { tipo: 'chamado', dados: dadosAtualizados };
                          setInternalItem(result);
                          if (setItemDetalhado) setItemDetalhado(result);

                          // Limpa o campo de resolução após o sucesso
                          const textarea = document.getElementById('ticket-resolution-text');
                          if (textarea) textarea.value = '';

                          if (onUpdateItem) onUpdateItem();

                          // Força uma nova busca para garantir integridade total
                          setTimeout(fetchByProtocol, 100);
                        } catch (e) {
                          console.error("Erro Update:", e);
                          alert("Erro ao atualizar o chamado. Verifique a conexão com o servidor.");
                        }
                        setLoadingAction(false);
                      }}
                      className={`flex-1 py-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-colors ${statusNormalizado === 'Concluído' ? 'bg-slate-300 dark:bg-white/5 opacity-50 cursor-not-allowed text-slate-500' : 'bg-[#254E70] hover:opacity-90'}`}
                    >
                      {loadingAction ? 'Processando...' : <><CheckCircle2 size={18} /> ATUALIZAR STATUS DO TICKET</>}
                    </button>
                  )}
                </div>
              </div>
              <div className="hidden lg:block w-[220px]" />
            </div>
          </div>
        </div>
      </div>

      <HandoverModal
        isOpen={showModalDevolucao}
        onClose={() => setShowModalDevolucao(false)}
        onConfirm={handleConfirmDevolucao}
        tipo="devolucao"
        solicitante={nomeNormalizado}
        setor={setorNormalizado}
        itens={itens}
        loading={loadingAction}
        preAssinado={!!itens?.[0]?.get?.('assinatura_dev_eletronica')}
        detalhesAssinaturaPortal={itens?.[0]?.get?.('detalhes_assinatura_dev')}
      />

      <HandoverModal
        isOpen={showModalRetirada}
        onClose={() => setShowModalRetirada(false)}
        onConfirm={handleConfirmRetirada}
        tipo="retirada"
        solicitante={nomeNormalizado}
        setor={setorNormalizado}
        itens={itens}
        loading={loadingAction}
        preAssinado={!!itens?.[0]?.get?.('assinatura_eletronica')}
        detalhesAssinaturaPortal={itens?.[0]?.get?.('detalhes_assinatura')}
      />
    </div>
  );
}
