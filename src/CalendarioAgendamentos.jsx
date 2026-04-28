// src/CalendarioAgendamentos.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Minus, Package, User, Clock, Trash2, ShieldAlert, CheckCircle2, ChevronDown, Briefcase, Hash, Printer, Edit2, ArrowUpRight, UploadCloud, X, ShieldCheck, AlertTriangle, ArrowRight, PenLine } from 'lucide-react';
import { logAction } from './utils/log';
import { createGLPITicket } from './utils/glpiClient';
import HandoverModal from './HandoverModal';

export default function CalendarioAgendamentos({ itensDisponiveis, onOpenDetails }) {
  const [dataAtual, setDataAtual] = useState(new Date());
  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [itemId, setItemId] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [horaReserva, setHoraReserva] = useState('08:00');

  const [dataRetorno, setDataRetorno] = useState('');
  const [horaRetorno, setHoraRetorno] = useState('18:00');

  const [colaboradores, setColaboradores] = useState([]);
  const [isDropdownColabOpen, setIsDropdownColabOpen] = useState(false);
  const [buscaColab, setBuscaColab] = useState('');
  const [setorNovo, setSetorNovo] = useState('');
  const [nomeSolicitante, setNomeSolicitante] = useState('');
  const [setorSolicitante, setSetorSolicitante] = useState('');

  const [editandoColab, setEditandoColab] = useState(null);
  const [editNomeColab, setEditNomeColab] = useState('');
  const [editSetorColab, setEditSetorColab] = useState('');

  const [isDropdownItemOpen, setIsDropdownItemOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });

  // Carrinho de múltiplos itens
  const [carrinhoReserva, setCarrinhoReserva] = useState([]);
  const [itemIdTemp, setItemIdTemp] = useState('');
  const [quantidadeTemp, setQuantidadeTemp] = useState(1);
  const [uploadingAnexo, setUploadingAnexo] = useState(null);
  const [refreshAnexo, setRefreshAnexo] = useState(0);
  const [recibo, setRecibo] = useState(null);

  const [detalheAprovacao, setDetalheAprovacao] = useState(null);
  const [detalheItemTipo, setDetalheItemTipo] = useState(null);
  const [modalAssinatura, setModalAssinatura] = useState(null); // { tipo: 'retirada'|'devolucao', grupo: any }

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
        if (field === 'tecnico') return wrap(obj.perfil);
        if (field === 'data_reserva' || field === 'data_inicio' || field === 'data_inicio_prevista') {
          return obj.data_inicio_prevista ? new Date(obj.data_inicio_prevista) : (obj.data_inicio ? new Date(obj.data_inicio) : null);
        }
        if (field === 'quantidade' || field === 'quantidade_emprestada') {
          return obj.quantidade_emprestada || obj.quantidade || 1;
        }
        if (field === 'data_devolucao_prevista' && obj.data_devolucao_prevista) return new Date(obj.data_devolucao_prevista);
        if (field === 'data_hora_retorno' && obj.data_hora_retorno) return new Date(obj.data_hora_retorno);
        return obj[field];
      },
      set: (field, val) => { obj[field] = val; },
      save: async () => { /* Logically handled in functions */ },
      destroy: async () => { /* Logically handled in functions */ }
    };
  };

  const fetchAgendamentos = async () => {
    setLoading(true);
    try {
      // Busca Unificada na tabela emprestimo (Pendente, Aprovado e Aberto)
      const { data: todos, error } = await supabase.from('emprestimo')
        .select('*, item(*)')
        .in('status_emprestimo', ['Aprovado', 'Pendente', 'Aberto']);

      if (error) throw error;

      setAgendamentos((todos || []).map(o => wrap(o)));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const fetchColaboradores = async () => {
    try {
      const { data } = await supabase.from('colaborador').select('*').order('nome', { ascending: true });
      setColaboradores((data || []).map(o => wrap(o)));
    } catch (e) { console.error(e); }
  };

  const itemSelecionado = (itensDisponiveis || []).find(i => i.id === itemId);
  const itemSelecionadoTemp = (itensDisponiveis || []).find(i => i.id === itemIdTemp);

  const handleAddColaborador = async () => {
    try {
      const { error } = await supabase.from('colaborador').insert({
        id: crypto.randomUUID(),
        nome: buscaColab.trim(),
        setor: setorNovo.trim().toUpperCase()
      });
      if (error) throw error;

      fetchColaboradores();
      setNomeSolicitante(buscaColab.trim());
      setSetorSolicitante(setorNovo.trim().toUpperCase());
      setIsDropdownColabOpen(false);
      setBuscaColab(''); setSetorNovo('');
    } catch (e) { alert(e.message); }
  };

  const iniciarEdicaoColab = (e, c) => {
    e.stopPropagation();
    setEditandoColab(c.id);
    setEditNomeColab(c.get('nome'));
    setEditSetorColab(c.get('setor'));
  };

  const salvarEdicaoColab = async (e, id) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from('colaborador').update({
        nome: editNomeColab.trim(),
        setor: editSetorColab.trim().toUpperCase()
      }).eq('id', id);
      if (error) throw error;
      setEditandoColab(null);
      fetchColaboradores();
      if (nomeSolicitante === editNomeColab.trim() || nomeSolicitante === '') {
        setNomeSolicitante(editNomeColab.trim());
        setSetorSolicitante(editSetorColab.trim().toUpperCase());
      }
    } catch (err) { alert('Erro ao editar: ' + err.message); }
  };

  const deletarColab = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Excluir este colaborador salvo?')) return;
    try {
      const { error } = await supabase.from('colaborador').delete().eq('id', id);
      if (error) throw error;
      fetchColaboradores();
    } catch (err) { alert(err.message); }
  };

  useEffect(() => { fetchAgendamentos(); }, [dataAtual.getMonth(), dataAtual.getFullYear()]);
  useEffect(() => { fetchColaboradores(); const hoje = new Date().toISOString().split('T')[0]; setDataRetorno(hoje); }, []);

  const diasNoMes = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 0).getDate();
  const primeiroDiaSemana = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1).getDay();
  const dias = [];
  for (let i = 0; i < primeiroDiaSemana; i++) { dias.push(null); }
  for (let i = 1; i <= diasNoMes; i++) { dias.push(new Date(dataAtual.getFullYear(), dataAtual.getMonth(), i)); }

  const mesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const mudarMes = (direcao) => setDataAtual(new Date(dataAtual.getFullYear(), dataAtual.getMonth() + direcao, 1));
  const isMesmoDia = (d1, d2) => d1 && d2 && d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

  // Para empréstimos ativos, verifica se o dia está dentro do período
  const emprestimoCobriaDia = (emp, dia) => {
    const inicio = emp.createdAt;
    const fim = emp.get('data_devolucao_prevista') || new Date('2100-01-01');
    const diaInicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, 0, 0);
    const diaFim = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 23, 59, 59);
    return inicio <= diaFim && fim >= diaInicio;
  };

  const itensDoDia = (dia) => agendamentos.filter(a => {
    // Para empréstimos já abertos (item retirado), usa createdAt como início real.
    // Para reservas pendentes/aprovadas, usa a data prevista de início.
    const statusAtual = a.get('status_emprestimo');
    const inicio = statusAtual === 'Aberto'
      ? a.createdAt
      : (a.get('data_inicio_prevista') || a.createdAt);
    const inicioD = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const fimR = a.get('data_devolucao_prevista') || a.get('data_hora_retorno');
    const fimD = fimR ? new Date(fimR.getFullYear(), fimR.getMonth(), fimR.getDate()) : new Date(2100, 0, 1);
    return dia >= inicioD && dia <= fimD;
  });

  const agendamentosDoDia = itensDoDia(dataSelecionada);

  const abrirEdicao = (ag) => {
    setEditandoId(ag.id);
    setItemId(ag.get('item')?.id || '');
    setQuantidade(ag.get('quantidade_emprestada') || 1);
    setNomeSolicitante(ag.get('nome_solicitante') || '');
    setSetorSolicitante(ag.get('setor_solicitante') || '');
    const dataRes = ag.get('data_inicio_prevista');
    if (dataRes) { setHoraReserva(dataRes.getHours().toString().padStart(2, '0') + ':' + dataRes.getMinutes().toString().padStart(2, '0')); }

    const dtRet = ag.get('data_devolucao_prevista');
    if (dtRet) {
      setDataRetorno(dtRet.toISOString().split('T')[0]);
      setHoraRetorno(dtRet.getHours().toString().padStart(2, '0') + ':' + dtRet.getMinutes().toString().padStart(2, '0'));
    } else { setDataRetorno(dataSelecionada.toISOString().split('T')[0]); setHoraRetorno('18:00'); }
    setShowForm(true); setMensagem({ texto: '', tipo: '' });
  };

  const resetForm = () => {
    setShowForm(false); setEditandoId(null); setItemId(''); setQuantidade(1);
    setItemIdTemp(''); setQuantidadeTemp(1);
    setCarrinhoReserva([]);
    setNomeSolicitante(''); setSetorSolicitante(''); setHoraReserva('08:00');
    setDataRetorno(dataSelecionada.toISOString().split('T')[0]); setHoraRetorno('18:00'); setMensagem({ texto: '', tipo: '' });
  };

  const adicionarItemAoCarrinho = () => {
    if (!itemIdTemp) { setMensagem({ texto: 'Selecione um equipamento.', tipo: 'erro' }); return; }
    const jaExiste = carrinhoReserva.find(c => c.itemId === itemIdTemp);
    if (jaExiste) {
      setMensagem({ texto: 'Este equipamento já está na reserva. Edite a quantidade diretamente.', tipo: 'erro' });
      return;
    }
    const item = (itensDisponiveis || []).find(i => i.id === itemIdTemp);
    setCarrinhoReserva(prev => [...prev, {
      itemId: itemIdTemp,
      quantidade: Number(quantidadeTemp) || 1,
      nomeEquipamento: item?.get('nome_equipamento') || 'Equipamento',
      modelo: item?.get('modelo_detalhes') || '',
      estoqueMax: item?.get('quantidade') || 1
    }]);
    setItemIdTemp('');
    setQuantidadeTemp(1);
    setIsDropdownItemOpen(false);
    setMensagem({ texto: '', tipo: '' });
  };

  const removerItemDoCarrinho = (itemId) => {
    setCarrinhoReserva(prev => prev.filter(c => c.itemId !== itemId));
  };

  const atualizarQtdCarrinho = (itemId, delta) => {
    setCarrinhoReserva(prev => prev.map(c => {
      if (c.itemId === itemId) {
        const nova = Math.max(1, Math.min(c.estoqueMax, c.quantidade + delta));
        return { ...c, quantidade: nova };
      }
      return c;
    }));
  };

  useEffect(() => { setDataRetorno(dataSelecionada.toISOString().split('T')[0]); }, [dataSelecionada]);

  const handleSalvarAgendamento = async (e) => {
    e.preventDefault();
    // Modo edição: usa o itemId único (comportamento original)
    const isEdicao = !!editandoId;
    if (isEdicao && !itemId) { setMensagem({ texto: 'Selecione um equipamento.', tipo: 'erro' }); return; }
    if (!isEdicao && carrinhoReserva.length === 0) { setMensagem({ texto: 'Adicione ao menos um equipamento à reserva.', tipo: 'erro' }); return; }
    if (!nomeSolicitante) { setMensagem({ texto: 'Selecione o solicitante.', tipo: 'erro' }); return; }
    if (dataRetorno) {
      const dtSelFormat = dataSelecionada.toISOString().split('T')[0];
      if (dataRetorno < dtSelFormat || (dataRetorno === dtSelFormat && horaRetorno <= horaReserva)) {
        setMensagem({ texto: 'A devolução deve ser posterior ao horário de retirada.', tipo: 'erro' }); return;
      }
    } else {
      setMensagem({ texto: 'A data de retorno é obrigatória.', tipo: 'erro' }); return;
    }
    setLoading(true); setMensagem({ texto: '', tipo: '' });

    try {
      const userId = localStorage.getItem('tilend_user_id');
      const { data: userProfile } = await supabase.from('perfil').select('*').eq('id', userId).single();
      if (!userProfile) throw new Error('Sessão expirada. Faça login novamente.');

      const [hora, minuto] = horaReserva.split(':');
      const dataComHora = new Date(dataSelecionada.getFullYear(), dataSelecionada.getMonth(), dataSelecionada.getDate(), Number(hora), Number(minuto), 0);

      if (!editandoId && dataComHora <= new Date()) {
        setMensagem({ texto: 'Não é possível agendar para horários que já passaram.', tipo: 'erro' });
        setLoading(false);
        return;
      }

      let dataDevolucaoNova = null;
      if (dataRetorno) {
        const [rAno, rMes, rDia] = dataRetorno.split('-');
        const [rh, rm] = horaRetorno.split(':');
        dataDevolucaoNova = new Date(rAno, rMes - 1, rDia, rh, rm, 0);
      }

      if (isEdicao) {
        // Modo edição (único item)
        const { data: itemBanco } = await supabase.from('item').select('*').eq('id', itemId).single();
        const { data: ocupacao } = await supabase.from('emprestimo')
          .select('*').eq('item_id', itemId).in('status_emprestimo', ['Aberto', 'Aprovado']);
        const filteredOcupacao = (ocupacao || []).filter(r => r.id !== editandoId);
        let qtdSobreposta = 0;
        for (const r of filteredOcupacao) {
          const exInicio = new Date(r.data_inicio_prevista || r.created_at);
          const exFim = r.data_devolucao_prevista ? new Date(r.data_devolucao_prevista) : new Date('2100-01-01');
          const novoFim = dataDevolucaoNova || new Date('2100-01-01');
          if (exInicio < novoFim && exFim > dataComHora) qtdSobreposta += (r.quantidade_emprestada || 1);
        }
        if (Number(quantidade) > (itemBanco.quantidade || 0) - qtdSobreposta) throw new Error(`Estoque indisponível.`);
        const payload = {
          item_id: itemId, quantidade_emprestada: Number(quantidade),
          nome_solicitante: nomeSolicitante.trim(), setor_solicitante: setorSolicitante.trim().toUpperCase(),
          data_inicio_prevista: dataComHora.toISOString(), status_emprestimo: 'Aprovado',
          data_devolucao_prevista: dataDevolucaoNova?.toISOString() || null,
          nome_pessoa: nomeSolicitante.trim()
        };
        const { error } = await supabase.from('emprestimo').update(payload).eq('id', editandoId);
        if (error) throw error;
      } else {
        // Modo criação: múltiplos itens com mesmo protocolo
        const agoraProtocolo = new Date();
        const anoAtual = agoraProtocolo.getFullYear();
        const inicioAno = new Date(anoAtual, 0, 1).toISOString();
        const [{ data: ultimosEmps }, { data: ultimosAgends }] = await Promise.all([
          supabase.from('emprestimo').select('protocolo').gte('created_at', inicioAno).order('protocolo', { ascending: false }).limit(50),
          supabase.from('agendamento').select('protocolo').gte('created_at', inicioAno).order('protocolo', { ascending: false }).limit(50)
        ]);
        let maiorSerial = 0;
        const processarSeriais = (list) => {
          if (list?.length > 0) list.forEach(e => {
            if (e.protocolo?.includes('/')) {
              const s = parseInt(e.protocolo.split('/')[1]);
              if (!isNaN(s) && s > maiorSerial) maiorSerial = s;
            }
          });
        };
        processarSeriais(ultimosEmps);
        processarSeriais(ultimosAgends);
        const protocoloGerado = `${anoAtual}/${String(maiorSerial + 1).padStart(4, '0')}`;

        // ABERTURA DE CHAMADO NO GLPI (Regra de Negócio: Reserva Direta via Agenda)
        let ticketId = null;
        try {
          const ticketTitle = `[RESERVA AGENDA] PROTOCOLO #${protocoloGerado} - ${nomeSolicitante.toUpperCase()}`;
          const itensListado = carrinhoReserva.map(c => `- ${c.nomeEquipamento} (Qtd: ${c.quantidade})`).join('\n');

          const ticketContent = `
RESERVA CRIADA VIA AGENDA TÉCNICA
-----------------------------------------
SOLICITANTE: ${nomeSolicitante.toUpperCase()}
SETOR: ${setorSolicitante.trim().toUpperCase() || 'N/I'}
PROTOCOLO: ${protocoloGerado}
DATA PREVISTA: ${dataComHora.toLocaleString('pt-BR')}
RETORNO PREVISTO: ${dataDevolucaoNova ? dataDevolucaoNova.toLocaleString('pt-BR') : 'N/I'}
-----------------------------------------
ITENS RESERVADOS:
${itensListado}

CRIADO POR: ${userProfile?.username || 'GSTOR'}
-----------------------------------------
Chamado gerado automaticamente pela Agenda do Sistema.
`.trim();

          const ticketResult = await createGLPITicket(ticketTitle, ticketContent);
          ticketId = ticketResult?.id;
        } catch (glpiErr) {
          console.error('Falha na criação de chamado GLPI via Agenda:', glpiErr);
        }

        // Validar e inserir cada item do carrinho
        for (const cartItem of carrinhoReserva) {
          const { data: ocupacao } = await supabase.from('emprestimo')
            .select('*').eq('item_id', cartItem.itemId).in('status_emprestimo', ['Aberto', 'Aprovado']);
          let qtdSobreposta = 0;
          for (const r of (ocupacao || [])) {
            const exInicio = new Date(r.data_inicio_prevista || r.created_at);
            const exFim = r.data_devolucao_prevista ? new Date(r.data_devolucao_prevista) : new Date('2100-01-01');
            const novoFim = dataDevolucaoNova || new Date('2100-01-01');
            if (exInicio < novoFim && exFim > dataComHora) qtdSobreposta += (r.quantidade_emprestada || 1);
          }
          const { data: itemBanco } = await supabase.from('item').select('quantidade').eq('id', cartItem.itemId).single();
          if (cartItem.quantidade > (itemBanco?.quantidade || 0) - qtdSobreposta) {
            throw new Error(`Estoque indisponível para "${cartItem.nomeEquipamento}" neste horário.`);
          }
          const payload = {
            id: crypto.randomUUID(),
            protocolo: protocoloGerado,
            item_id: cartItem.itemId,
            quantidade_emprestada: cartItem.quantidade,
            nome_solicitante: nomeSolicitante.trim(),
            setor_solicitante: setorSolicitante.trim().toUpperCase(),
            data_inicio_prevista: dataComHora.toISOString(),
            status_emprestimo: 'Aprovado',
            data_devolucao_prevista: dataDevolucaoNova?.toISOString() || null,
            nome_pessoa: nomeSolicitante.trim(),
            observacoes: ticketId ? `[AGENDA] [GLPI_TICKET: ${ticketId}]` : '[AGENDA]'
          };
          const { error } = await supabase.from('emprestimo').insert(payload);
          if (error) throw error;
        }
      }

      setMensagem({ texto: isEdicao ? 'Agendamento atualizado!' : `Reserva criada com ${carrinhoReserva.length} item(s)!`, tipo: 'sucesso' });
      resetForm(); fetchAgendamentos();
      setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3000);
    } catch (error) { setMensagem({ texto: error.message, tipo: 'erro' }); } finally { setLoading(false); }
  };

  const excluirAgendamento = async (ids) => {
    const multi = Array.isArray(ids);
    if (!window.confirm(multi ? `Cancelar estas ${ids.length} solicitações?` : 'Cancelar este agendamento?')) return;
    try {
      const query = supabase.from('agendamento').delete();
      if (multi) query.in('id', ids);
      else query.eq('id', ids);

      const { error } = await query;
      if (error) throw error;
      fetchAgendamentos();
    }
    catch (e) { alert('Erro ao excluir: ' + e.message); }
  };

  const efetivarReserva = (grupo) => {
    setModalAssinatura({ tipo: 'retirada', grupo: grupo });
  };

  const handleDevolver = (grupo) => {
    setModalAssinatura({ tipo: 'devolucao', grupo: grupo });
  };

  const confirmarHandover = async (nomeResponsavel) => {
    const { tipo, grupo } = modalAssinatura;
    setLoading(true);

    try {
      const agora = new Date();
      const labelAcaoTermo = tipo === 'retirada' ? 'RETIRADA' : 'DEVOLUÇÃO';
      const textoAssinatura = `TERMO DE ${labelAcaoTermo} ASSINADO POR AGENTE EM CONJUNTO COM ${nomeResponsavel.toUpperCase()} EM ${agora.toLocaleDateString('pt-BR')} ÀS ${agora.toLocaleTimeString('pt-BR')}`;

      if (tipo === 'retirada') {
        await executarSaidaComAssinatura(grupo, nomeResponsavel, textoAssinatura);
      } else {
        await executarDevolucaoComAssinatura(grupo, nomeResponsavel, textoAssinatura);
      }

      setModalAssinatura(null);
    } catch (e) {
      alert('Erro ao processar assinatura: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  const executarSaidaComAssinatura = async (agGroup, nomeResponsavel, textoAssinatura) => {
    try {
      const userId = localStorage.getItem('tilend_user_id');
      const { data: userProfile } = await supabase.from('perfil').select('username').eq('id', userId).single();

      const idsEfetuados = [];
      const idsAgendas = [];

      for (const ag of agGroup.itens) {
        const { data: itemBanco } = await supabase.from('item').select('id, nome_equipamento, quantidade').eq('id', ag.get('item_id')).single();
        const qtdAtual = itemBanco.quantidade || 0;
        const qtdReservada = ag.get('quantidade');

        if (qtdAtual < qtdReservada) throw new Error(`Estoque insuficiente para ${itemBanco.nome_equipamento}.`);

        await supabase.from('item').update({ quantidade: qtdAtual - qtdReservada }).eq('id', itemBanco.id);

        const payload = {
          id: crypto.randomUUID(),
          item_id: itemBanco.id,
          quantidade_emprestada: qtdReservada,
          nome_solicitante: ag.get('solicitante'),
          setor_solicitante: ag.get('setor_solicitante'),
          status_emprestimo: 'Aberto',
          nome_tecnico_saida: userProfile.username,
          data_devolucao_prevista: ag.get('data_devolucao_prevista')?.toISOString() || null,
          assinatura_eletronica: true,
          detalhes_assinatura: textoAssinatura,
          quem_vai_buscar: nomeResponsavel
        };

        const { data: novoEmp, error: errEmp } = await supabase.from('emprestimo').insert(payload).select('*, item(*)').single();
        if (errEmp) throw errEmp;

        idsEfetuados.push(novoEmp);
        idsAgendas.push(ag.id);
      }

      await supabase.from('agendamento').delete().in('id', idsAgendas);
      setRecibo({ tipo: 'retirada', obj: wrap(idsEfetuados[0]) });
      setMensagem({ texto: `${idsEfetuados.length} Ativo(s) entregues com sucesso!`, tipo: 'sucesso' });
      fetchAgendamentos();
      setTimeout(() => setMensagem({ texto: '', tipo: '' }), 4000);
    } catch (e) {
      throw e;
    }
  };

  const executarDevolucaoComAssinatura = async (empGroup, nomeResponsavel, textoAssinatura) => {
    try {
      const { data: userProfile } = await supabase.from('perfil').select('username').eq('id', localStorage.getItem('tilend_user_id')).single();

      for (const emp of empGroup.itens) {
        const { data: itemBanco } = await supabase.from('item').select('id, quantidade').eq('id', emp.item_id).single();
        await supabase.from('item').update({ quantidade: (itemBanco.quantidade || 0) + (emp.get('quantidade_emprestada') || 1) }).eq('id', itemBanco.id);
      }

      const ids = empGroup.itens.map(i => i.id);
      const { error } = await supabase.from('emprestimo').update({
        status_emprestimo: 'Devolvido',
        data_hora_retorno: new Date().toISOString(),
        nome_tecnico_retorno: userProfile?.username || '',
        assinatura_dev_eletronica: true,
        detalhes_assinatura_dev: textoAssinatura,
        quem_vai_entregar: nomeResponsavel
      }).in('id', ids);

      if (error) throw error;
      setMensagem({ texto: 'Devolução registrada com sucesso!', tipo: 'sucesso' });
      fetchAgendamentos();
      setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3000);
    } catch (e) {
      throw e;
    }
  };

  const handleUploadAnexo = async (file, campo) => {
    if (!file || !recibo || !recibo.obj) return;
    setUploadingAnexo(campo);
    try {
      alert('Funcionalidade de anexo está sendo migrada para Supabase Storage.');
      setRefreshAnexo(r => r + 1);
    } catch (e) { alert('Erro ao anexar documento: ' + e.message); } finally { setUploadingAnexo(null); }
  };

  const abrirVisualizacaoAgendamento = (ag) => {
    setDetalheAprovacao(ag);
    setDetalheItemTipo(ag._tipo === 'emprestimo' ? 'emprestimo' : 'agendamento');
  };



  const inputClass = "w-full bg-transparent border-b border-slate-300 dark:border-[#404040] focus-within:border-[#254E70] dark:focus-within:border-[#254E70] text-slate-900 dark:text-white py-3 outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-[#404040] text-sm";
  const labelClass = "block text-[10px] font-bold uppercase text-slate-500 dark:text-[#606060] tracking-widest mb-1";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full animate-in fade-in duration-500 pb-10 transition-colors duration-300">

      {/* CALENDÁRIO */}
      <div className="lg:col-span-2 bg-[var(--bg-card)] rounded-[2.5rem] p-8 flex flex-col transition-colors duration-300">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[var(--bg-page)] rounded-2xl text-[#254E70]">
              <CalendarDays size={24} strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{mesNomes[dataAtual.getMonth()]} {dataAtual.getFullYear()}</h2>
              <p className="text-[10px] text-slate-500 dark:text-[#606060] font-bold uppercase tracking-widest mt-1">Planejamento Mensal</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => mudarMes(-1)} className="p-3 bg-[var(--bg-page)] text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white rounded-xl transition-all hover:bg-[var(--bg-soft)]"><ChevronLeft size={18} /></button>
            <button onClick={() => mudarMes(1)} className="p-3 bg-[var(--bg-page)] text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white rounded-xl transition-all hover:bg-[var(--bg-soft)]"><ChevronRight size={18} /></button>
          </div>
        </div>

        <div className="flex-1 bg-[var(--bg-page)] rounded-[1.5rem] p-6 transition-colors duration-300">
          <div className="grid grid-cols-7 gap-4 mb-4">
            {diasSemana.map(d => (<div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-[#606060]">{d}</div>))}
          </div>
          <div className="grid grid-cols-7 gap-3">
            {dias.map((dia, index) => {
              if (!dia) return <div key={`empty-${index}`} className="h-24 rounded-2xl bg-transparent border border-transparent"></div>;
              const isSelected = isMesmoDia(dia, dataSelecionada);
              const isToday = isMesmoDia(dia, new Date());
              const itensNoDia = itensDoDia(dia);
              const agNoDia = itensNoDia.filter(a => a.get('status_emprestimo') !== 'Aberto').length;
              const empNoDia = itensNoDia.filter(a => a.get('status_emprestimo') === 'Aberto').length;

              return (
                <div key={index} onClick={() => { setDataSelecionada(dia); resetForm(); }} className={`h-24 rounded-2xl p-3 flex flex-col justify-between cursor-pointer transition-all ${isSelected ? 'bg-[#254E70]/10 ring-2 ring-inset ring-[#254E70]/30' : isToday ? 'bg-[var(--bg-card)] ' : 'bg-[var(--bg-card)] '}`}>
                  <span className={`text-sm font-bold ${isSelected ? 'text-[#254E70]' : isToday ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-[#A0A0A0]'}`}>{dia.getDate()}</span>
                  {itensNoDia.length > 0 && (
                    <div className="self-end flex flex-col gap-0.5">
                      {agNoDia > 0 && (
                        <div className="flex items-center gap-1 bg-[#254E70]/10 px-1.5 py-0.5 rounded shadow-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#254E70]"></div>
                          <span className="text-[9px] font-bold text-[#254E70]">{agNoDia}</span>
                        </div>
                      )}
                      {empNoDia > 0 && (
                        <div className="flex items-center gap-1 bg-[#8D3046]/10 px-1.5 py-0.5 rounded shadow-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#8D3046]"></div>
                          <span className="text-[9px] font-bold text-[#8D3046]">{empNoDia}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FORMULÁRIO E DETALHES LATERAL */}
      <div className="lg:col-span-1 bg-[var(--bg-card)] rounded-[2.5rem] p-8 flex flex-col h-full overflow-hidden transition-colors duration-300">
        <div className="pb-6 mb-6 shrink-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Agenda Confirmada</h3>
          <p className="text-[10px] text-[#254E70] font-bold uppercase tracking-widest mt-1">{dataSelecionada.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {mensagem.texto && (
            <div className={`shrink-0 flex items-center gap-3 p-4 rounded-xl text-[10px] uppercase tracking-widest font-bold mb-6 ${mensagem.tipo === 'sucesso' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>{mensagem.texto}</div>
          )}

          {showForm ? (
            <form onSubmit={handleSalvarAgendamento} className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-top-2">
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">{editandoId ? 'Editar Reserva' : 'Nova Reserva'}</h4>
                  <button type="button" onClick={resetForm} className="text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white transition-colors text-[10px] uppercase font-bold tracking-widest">Cancelar</button>
                </div>

                {/* CARRINHO DE ITENS (apenas em criação) */}
                {!editandoId && (
                  <div className="space-y-4">
                    <label className={labelClass}>Equipamentos da Reserva</label>

                    {/* Lista do Carrinho (Padrão Pills) */}
                    {carrinhoReserva.length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-4 animate-in fade-in">
                        {carrinhoReserva.map(c => (
                          <div key={c.itemId} className="flex items-center gap-4 p-3 bg-[var(--bg-soft)] rounded-3xl transition-all group relative pr-10">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-[var(--bg-page)] flex items-center justify-center text-[#254E70] shrink-0">
                                <Package size={14} />
                              </div>
                              <span className="text-[10px] font-black text-[#254E70] bg-[#254E70]/10 px-2.5 py-1 rounded-lg">x{c.quantidade}</span>
                            </div>

                            <div className="overflow-hidden">
                              <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase truncate tracking-tight">{c.nomeEquipamento}</p>
                              {c.modelo && <p className="text-[9px] font-bold text-slate-500 dark:text-[#606060] truncate uppercase tracking-tighter">{c.modelo}</p>}
                            </div>

                            <div className="absolute top-1/2 -translate-y-1/2 right-2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                              <button type="button" onClick={() => atualizarQtdCarrinho(c.itemId, 1)} className="p-1 hover:text-[#254E70] transition-colors"><Plus size={10} /></button>
                              <button type="button" onClick={() => atualizarQtdCarrinho(c.itemId, -1)} className="p-1 hover:text-[#254E70] transition-colors"><Minus size={10} /></button>
                            </div>

                            <button type="button" onClick={() => removerItemDoCarrinho(c.itemId)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Seletor de Item (Padrão NovoEmprestimo) */}
                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="relative group col-span-7 z-[60]">
                        <div className="relative">
                          <div onClick={() => setIsDropdownItemOpen(!isDropdownItemOpen)} className={`${inputClass} flex items-center justify-between cursor-pointer ${isDropdownItemOpen ? 'ring-2 ring-[#254E70]/50' : ''}`}>
                            <div className="flex items-center gap-3 overflow-hidden">
                              <Package size={16} className={`shrink-0 transition-colors ${isDropdownItemOpen || itemIdTemp ? 'text-[#254E70]' : 'text-slate-400 dark:text-[#606060]'}`} />
                              <span className={`truncate ${itemSelecionadoTemp ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-[#606060] font-normal'}`}>
                                {itemSelecionadoTemp ? `${itemSelecionadoTemp.get('nome_equipamento')} ${itemSelecionadoTemp.get('modelo_detalhes') ? `- ${itemSelecionadoTemp.get('modelo_detalhes')}` : ''}` : 'Escolha um item...'}
                              </span>
                            </div>
                            <ChevronDown size={14} className={`text-slate-400 dark:text-[#606060] transition-transform ${isDropdownItemOpen ? 'rotate-180' : ''}`} />
                          </div>
                          {isDropdownItemOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setIsDropdownItemOpen(false)}></div>
                              <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-card)] rounded-[1.5rem] z-50 max-h-48 overflow-y-auto custom-scrollbar shadow-xl border border-slate-100 dark:border-white/5 p-2 animate-in slide-in-from-top-2">
                                {(itensDisponiveis || []).map(i => (
                                  <div key={i.id} onClick={() => { setItemIdTemp(i.id); setIsDropdownItemOpen(false); }} className="px-4 py-3 mb-1 rounded-xl cursor-pointer hover:bg-[var(--bg-page)] transition-all flex justify-between items-center group">
                                    <div className="overflow-hidden pr-2">
                                      <p className="text-xs font-bold text-slate-900 dark:text-white uppercase group-hover:text-[#254E70] transition-colors">{i.get('nome_equipamento')}</p>
                                      <p className="text-[10px] text-slate-500 dark:text-[#606060] truncate">{i.get('modelo_detalhes') || 'Sem modelo'}</p>
                                    </div>
                                    <span className="px-2 py-0.5 bg-[#254E70]/10 text-[#254E70] text-[9px] font-black rounded-md">{i.get('quantidade')} un.</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="relative group col-span-2">
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2"><Hash size={12} className="text-slate-400 dark:text-[#606060] group-focus-within:text-[#254E70]" /></div>
                          <input
                            type="number"
                            min="1"
                            value={quantidadeTemp}
                            onChange={(e) => {
                              let val = e.target.value;
                              const max = itemSelecionadoTemp ? (itemSelecionadoTemp.get('quantidade') || 1) : 100;
                              if (val !== "" && parseInt(val) > max) val = String(max);
                              setQuantidadeTemp(val);
                            }}
                            className={`${inputClass} !pl-8 text-center`}
                          />
                        </div>
                      </div>

                      <div className="col-span-3">
                        <button type="button" onClick={adicionarItemAoCarrinho} disabled={!itemIdTemp} className="w-full py-3.5 bg-[var(--bg-page)] text-slate-900 dark:text-white hover:text-[#254E70] hover:bg-[#254E70]/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                          <Plus size={14} /> Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modo Edição: Seletor único */}
                {editandoId && (
                  <div className="space-y-4">
                    <div className="relative group z-[60]">
                      <label className={labelClass}>Equipamento</label>
                      <div className="relative">
                        <div onClick={() => setIsDropdownItemOpen(!isDropdownItemOpen)} className={`${inputClass} flex items-center justify-between cursor-pointer ${isDropdownItemOpen ? 'ring-2 ring-[#254E70]/50' : ''}`}>
                          <div className="flex items-center gap-3 overflow-hidden">
                            <Package size={16} className={`shrink-0 transition-colors ${isDropdownItemOpen || itemId ? 'text-[#254E70]' : 'text-slate-400 dark:text-[#606060]'}`} />
                            <span className={`truncate ${itemSelecionado ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 dark:text-[#606060]'}`}>{itemSelecionado ? itemSelecionado.get('nome_equipamento') : 'Selecionar Equipamento...'}</span>
                          </div>
                          <ChevronDown size={14} className={`text-slate-400 dark:text-[#606060] transition-transform ${isDropdownItemOpen ? 'rotate-180' : ''}`} />
                        </div>
                        {isDropdownItemOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsDropdownItemOpen(false)}></div>
                            <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-card)] rounded-[1.5rem] z-50 max-h-48 overflow-y-auto custom-scrollbar shadow-xl border border-slate-100 dark:border-white/5 p-2">
                              {itensDisponiveis.map(i => (
                                <div key={i.id} onClick={() => { setItemId(i.id); setIsDropdownItemOpen(false); }} className="px-4 py-3 mb-1 rounded-xl cursor-pointer hover:bg-[var(--bg-page)] transition-all flex justify-between items-center group">
                                  <div className="overflow-hidden pr-2">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase group-hover:text-[#254E70] transition-colors">{i.get('nome_equipamento')}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-[#606060] truncate">{i.get('modelo_detalhes') || 'Sem modelo'}</p>
                                  </div>
                                  <span className="px-2 py-0.5 bg-[#254E70]/10 text-[#254E70] text-[9px] font-black rounded-md">{i.get('quantidade')} un.</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="relative group">
                      <label className={labelClass}>Quantidade</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2"><Hash size={14} className="text-slate-400 dark:text-[#606060] group-focus-within:text-[#254E70]" /></div>
                        <input
                          type="number"
                          min="1"
                          value={quantidade}
                          onChange={(e) => {
                            let val = e.target.value;
                            const max = itemSelecionado ? (itemSelecionado.get('quantidade') || 1) : 100;
                            if (val !== "" && parseInt(val) > max) val = String(max);
                            setQuantidade(val);
                          }}
                          className={`${inputClass} !pl-10 text-center`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative group z-50">
                  <label className={labelClass}>Colaborador / Solicitante</label>
                  <div className="flex items-end gap-3 relative">
                    <User size={16} className={`mb-3 shrink-0 transition-colors ${isDropdownColabOpen || nomeSolicitante ? 'text-[#254E70]' : 'text-slate-400 dark:text-[#606060]'}`} />
                    <div onClick={() => setIsDropdownColabOpen(!isDropdownColabOpen)} className={`${inputClass} flex items-center justify-between cursor-pointer ${isDropdownColabOpen ? 'border-[#254E70]' : ''}`}>
                      <span className={nomeSolicitante ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400 dark:text-[#606060]'}>{nomeSolicitante ? `${nomeSolicitante} (${setorSolicitante})` : 'Selecionar ou Adicionar...'}</span>
                      <ChevronDown size={16} className={`text-slate-400 dark:text-[#606060] transition-transform shrink-0 ${isDropdownColabOpen ? 'rotate-180 text-[#254E70]' : ''}`} />
                    </div>

                    {isDropdownColabOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsDropdownColabOpen(false)}></div>
                        <div className="absolute top-full left-7 right-0 mt-2 bg-[var(--bg-card)]  rounded-2xl z-50 p-4 animate-in slide-in-from-top-2">
                          <input type="text" placeholder="Buscar solicitante..." value={buscaColab} onChange={e => setBuscaColab(e.target.value)} className="w-full bg-[var(--bg-page)]  text-slate-900 dark:text-white px-4 py-3 rounded-xl text-xs outline-none focus:border-[#254E70] transition-colors mb-3" />

                          {buscaColab && !colaboradores.some(c => c.get('nome').toLowerCase() === buscaColab.toLowerCase()) && (
                            <div className="mb-3 p-4 bg-[#254E70]/5 rounded-xl border border-[#254E70]/10">
                              <p className="text-[10px] font-bold text-[#254E70] mb-3 uppercase tracking-widest flex items-center gap-2"><Plus size={14} /> Adicionar Colaborador</p>
                              <input type="text" placeholder="Qual o setor? (Ex: Atendimento)" value={setorNovo} onChange={e => setSetorNovo(e.target.value)} className="w-full bg-[var(--bg-card)]  text-slate-900 dark:text-white px-3 py-2 rounded-lg text-xs outline-none border border-slate-200 dark:border-white/5 mb-3 transition-colors" />
                              <button type="button" onClick={handleAddColaborador} disabled={!setorNovo} className="w-full py-2.5 bg-[#254E70] text-white rounded-lg text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 transition-opacity">Salvar e Selecionar</button>
                            </div>
                          )}

                          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                            {colaboradores.filter(c => c.get('nome').toLowerCase().includes(buscaColab.toLowerCase())).map(c => (
                              <div key={c.id} className="flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-page)] dark:hover:bg-[var(--bg-card-dark)] rounded-xl group transition-colors">
                                {editandoColab === c.id ? (
                                  <div className="flex-1 flex items-center gap-2 pr-2" onClick={e => e.stopPropagation()}>
                                    <div className="flex-1 space-y-1">
                                      <input type="text" value={editNomeColab} onChange={e => setEditNomeColab(e.target.value)} className="w-full bg-[var(--bg-card)]  text-slate-900 dark:text-white text-xs px-2 py-1 rounded border border-slate-200 dark:border-white/5 outline-none focus:border-[#254E70]" />
                                      <input type="text" value={editSetorColab} onChange={e => setEditSetorColab(e.target.value)} className="w-full bg-[var(--bg-card)]  text-slate-900 dark:text-white text-[10px] px-2 py-1 rounded border border-slate-200 dark:border-white/5 outline-none focus:border-[#254E70] uppercase" />
                                    </div>
                                    <div className="flex flex-col gap-1 shrink-0">
                                      <button type="button" onClick={(e) => salvarEdicaoColab(e, c.id)} className="p-1.5 bg-[#254E70] text-white rounded hover:opacity-80 transition-opacity"><CheckCircle2 size={14} /></button>
                                      <button type="button" onClick={(e) => { e.stopPropagation(); setEditandoColab(null); }} className="p-1.5 bg-slate-200 dark:bg-[var(--bg-card)]/10 text-slate-600 dark:text-white rounded hover:opacity-80 transition-opacity"><X size={14} /></button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex-1 cursor-pointer" onClick={() => { setNomeSolicitante(c.get('nome')); setSetorSolicitante(c.get('setor')); setIsDropdownColabOpen(false); setBuscaColab(''); }}>
                                      <p className="text-xs font-bold text-slate-900 dark:text-white uppercase group-hover:text-[#254E70] transition-colors">{c.get('nome')}</p>
                                      <p className="text-[10px] text-slate-500 dark:text-[#606060] uppercase">{c.get('setor')}</p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                      <button type="button" onClick={(e) => iniciarEdicaoColab(e, c)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[var(--bg-card)]/5 rounded-lg transition-all" title="Editar"><Edit2 size={14} /></button>
                                      <button type="button" onClick={(e) => deletarColab(e, c.id)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all" title="Excluir"><Trash2 size={14} /></button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="relative group">
                    <label className={labelClass}>Qtd</label>
                    <div className="flex items-end gap-2"><Hash size={16} className="text-slate-400 dark:text-[#606060] group-focus-within:text-[#254E70] transition-colors mb-3 shrink-0" /><input type="number" min="1" max={itemSelecionado ? (itemSelecionado.get('quantidade') || 1) : 100} value={quantidade} onChange={(e) => {
                      let val = e.target.value;
                      const max = itemSelecionado ? (itemSelecionado.get('quantidade') || 1) : 100;
                      if (val !== "" && parseInt(val) > max) val = String(max);
                      setQuantidade(val);
                    }} required className={`${inputClass} bg-transparent text-center`} /></div>
                  </div>
                  <div className="relative group">
                    <label className={labelClass}>Hora Saída</label>
                    <div className="flex items-end gap-2"><Clock size={16} className="text-slate-400 dark:text-[#606060] group-focus-within:text-[#254E70] transition-colors mb-3 shrink-0" /><input type="time" value={horaReserva} onChange={(e) => setHoraReserva(e.target.value)} required className={`${inputClass} bg-transparent cursor-text text-center`} /></div>
                  </div>
                </div>

                <div className="md:col-span-12 grid grid-cols-2 gap-6 mt-2">
                  <div className="relative group">
                    <label className={labelClass}>Dt. Devolução <span className="text-[#8D3046]">*</span></label>
                    <div className="relative">
                      <CalendarDays size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#606060] group-focus-within:text-[#254E70] transition-colors" />
                      <input type="date" value={dataRetorno} onChange={e => setDataRetorno(e.target.value)} required min={dataSelecionada.toISOString().split('T')[0]} className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                  <div className="relative group">
                    <label className={labelClass}>Hora Retorno <span className="text-[#8D3046]">*</span></label>
                    <div className="relative">
                      <Clock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#606060] group-focus-within:text-[#254E70] transition-colors" />
                      <input type="time" value={horaRetorno} onChange={e => setHoraRetorno(e.target.value)} required className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 pt-6">
                <button type="submit" disabled={loading} className="w-full py-4 bg-[#254E70] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-[#254E70]/20 hover:bg-[#1E3A5F] transition-all disabled:opacity-50 active:scale-[0.98]">
                  {loading ? 'Salvando...' : editandoId ? 'Atualizar Reserva' : 'Confirmar Reserva'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
              {loading ? (
                <p className="text-center text-slate-500 dark:text-[#606060] text-[10px] font-bold uppercase tracking-widest py-10 animate-pulse">Carregando...</p>
              ) : agendamentosDoDia.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center">
                  <div className="p-4 bg-[var(--bg-page)] rounded-2xl mb-4 text-slate-400 dark:text-[#404040]"><CalendarDays size={24} /></div>
                  <p className="text-xs text-slate-500 dark:text-[#606060] font-bold uppercase tracking-widest">Nenhuma reserva</p>
                </div>
              ) : (
                (() => {
                  const grupos = [];
                  agendamentosDoDia.forEach(ag => {
                    const status = ag.get('status_emprestimo'); const isEmp = status === 'Aberto';
                    const nome = ag.get('nome_solicitante');
                    const dataRefDate = ag.get('data_inicio_prevista') || ag.createdAt;
                    const dataRef = dataRefDate?.getTime() || 0;

                    let g = grupos.find(gr => gr.solicitante === nome && Math.abs(gr.dataRef - dataRef) < 120000);
                    if (g) {
                      g.itens.push(ag);
                    } else {
                      const grupoRef = Object.assign(Object.create(ag || {}), ag || {});
                      grupoRef.itens = [ag];
                      grupoRef.solicitante = nome || 'N/I';
                      grupoRef.dataRef = dataRef;
                      grupos.push(grupoRef);
                    }
                  });

                  return grupos.map(grupo => {
                    const status = grupo.get('status_emprestimo');
                    const isEmp = status === 'Aberto';
                    const cor = isEmp ? '#8D3046' : '#254E70';
                    const solicitante = grupo.solicitante;
                    const setor = grupo.get('setor_solicitante');
                    const dataRefDate = grupo.get('data_inicio_prevista') || grupo.createdAt;
                    const dataRetPrev = grupo.get('data_devolucao_prevista');

                    return (
                      <div key={grupo.id} className="bg-[var(--bg-page)] p-5 rounded-2xl border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-colors group relative overflow-hidden"
                        style={{ borderLeft: `3px solid ${cor}30` }}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col flex-1 overflow-hidden pr-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="bg-[var(--bg-card)]  px-2 py-0.5 rounded-md text-[9px] font-black" style={{ color: cor }}>PEDIDO #{grupo.protocolo || grupo.id.split('-')[0].toUpperCase()}</span>
                              <span className="text-[9px] font-black uppercase text-slate-400">● {grupo.itens.length} ATIVO{(grupo.itens.length !== 1) ? 'S' : ''}</span>
                            </div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white uppercase truncate">
                              {grupo.itens.length === 1 ? grupo.get('item')?.get('nome_equipamento') : `${grupo.itens.length} Itens Vinculados`}
                            </p>
                          </div>
                          <div className="flex gap-2 bg-[var(--bg-page)] pl-2 absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                            {onOpenDetails && (
                              <button
                                onClick={() => onOpenDetails(isEmp ? 'emprestimo' : 'agendamento', grupo)}
                                className="p-1.5 text-slate-400 dark:text-[#606060] hover:text-[#254E70] rounded-md transition-colors"
                                title="Ver Detalhes Gerenciais"
                              >
                                <ArrowRight size={14} />
                              </button>
                            )}
                            {!isEmp && <>
                              <button onClick={() => efetivarReserva(grupo)} className="p-1.5 bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 rounded-md transition-colors" title="Efetivar Retirada"><ArrowUpRight size={14} /></button>
                              <button onClick={() => abrirVisualizacaoAgendamento(grupo)} className="p-1.5 text-slate-400 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white rounded-md transition-colors" title="Ver Comprovante"><Printer size={14} /></button>
                              <button onClick={() => abrirEdicao(grupo)} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md" title="Editar"><Edit2 size={14} /></button>
                              <button onClick={() => excluirAgendamento(grupo.itens.map(i => i.id))} className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-md" title="Cancelar"><Trash2 size={14} /></button>
                            </>}
                          </div>
                        </div>
                        <div
                          className="pl-4 border-l-2 border-slate-200 dark:border-white/5 space-y-1.5 mt-2 cursor-pointer hover:bg-[var(--bg-soft)]/50 dark:hover:bg-[var(--bg-card)]/5 p-2 rounded-lg transition-colors"
                          onClick={() => onOpenDetails ? onOpenDetails(isEmp ? 'emprestimo' : 'agendamento', grupo) : abrirVisualizacaoAgendamento(grupo)}
                        >
                          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: cor }}>
                            {isEmp ? '● Em Uso' : '● Reservado'}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-[#A0A0A0] flex items-center gap-2">
                            <Clock size={12} style={{ color: cor }} />
                            {isEmp
                              ? <><span className="text-slate-900 dark:text-white font-bold">Saída:</span> {dataRefDate?.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</>
                              : <><span className="text-slate-900 dark:text-white font-bold">{dataRefDate?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></>
                            }
                            {' • '}{solicitante} ({setor})
                          </p>
                          {dataRetPrev && (
                            <p className="text-[10px] text-slate-400 dark:text-[#606060] flex items-center gap-1.5">
                              <CalendarDays size={11} />
                              <span>Devolução: </span>
                              <span className="font-bold">{dataRetPrev?.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()
              )}

            </div>
          )}
        </div>

        {!showForm && (
          <div className="pt-6 shrink-0 mt-auto">
            <button onClick={() => { resetForm(); setShowForm(true); }} className="w-full flex items-center justify-center gap-2 py-4 bg-[var(--bg-page)] text-slate-900 dark:text-white hover:text-[#254E70] dark:hover:text-[#254E70] hover:border-[#254E70]/30 dark:hover:border-[#254E70]/30 border border-slate-200 dark:border-white/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all">
              <Plus size={16} /> Adicionar à Agenda
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL DE IMPRESSÃO (TI) - BRANCO COM ASSINATURA ELETRÔNICA */}
      {/* ========================================================= */}
      {recibo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto custom-scrollbar print:p-0 print:bg-[var(--bg-card)] print:absolute print:inset-0 print:block print:w-full">

          <style dangerouslySetInnerHTML={{
            __html: `
            @media print {
              body * { visibility: hidden; }
              #printable-pdf, #printable-pdf * { visibility: visible; }
              #printable-pdf { 
                position: absolute; left: 0; top: 0; width: 100%; height: 100%;
                background: white !important; color: black !important;
              }
              .no-print { display: none !important; }
            }
          ` }} />

          <div
            id="printable-pdf"
            className="bg-[var(--bg-card)] w-full max-w-2xl rounded-[2.5rem] p-12 border border-slate-200 dark:border-white/10 my-auto print:shadow-none print:border-none print:m-0 print:w-full print:max-w-none transition-colors duration-300"
          >
            <div className="text-center pb-8 mb-8 border-b border-slate-200 dark:border-white/5 print:border-neutral-200">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#254E70] print:text-[#606060] mb-2">
                {recibo.tipo === 'agendamento' ? 'Comprovante de Agendamento' : 'Comprovante de Retirada'}
              </h4>
              <p className="text-3xl font-black text-slate-900 dark:text-white print:text-black italic tracking-tighter">TI LEND.</p>
            </div>

            <div className="space-y-8">
              {!recibo.obj.itens || recibo.obj.itens.length <= 1 ? (
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <span className="font-black text-slate-900 dark:text-white print:text-black uppercase text-2xl">
                      {recibo.obj.get('item')?.get('nome_equipamento') || 'Excluído'}
                    </span>
                    <span className="text-slate-500 text-sm block mt-1">
                      {recibo.obj.get('item')?.get('modelo_detalhes') || 'Sem modelo/detalhes'}
                    </span>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white print:text-black text-2xl px-5 py-2 bg-[var(--bg-soft)]  print:bg-[var(--bg-soft)] rounded-2xl border border-slate-200 dark:border-white/5 print:border-neutral-200">
                    x{recibo.tipo === 'agendamento' ? (recibo.obj.get('quantidade') || 1) : (recibo.obj.get('quantidade_emprestada') || 1)}
                  </span>
                </div>
              ) : (
                <div className="space-y-3 mb-8">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#254E70] mb-3">Ativos Solicitados</p>
                  <div className="space-y-2">
                    {recibo.obj.itens.map((item, idx) => (
                      <div key={item.id || idx} className="flex justify-between items-center bg-[var(--bg-page)] print:bg-[var(--bg-page)] p-4 rounded-xl border border-slate-200 dark:border-white/5 print:border-neutral-200">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white print:text-black uppercase text-sm">{item.get('item')?.get('nome_equipamento') || 'Excluído'}</span>
                          <span className="text-[10px] text-slate-500">{item.get('item')?.get('modelo_detalhes')}</span>
                        </div>
                        <span className="font-black text-slate-900 dark:text-white print:text-black text-lg">x{recibo.tipo === 'agendamento' ? (item.get('quantidade') || 1) : (item.get('quantidade_emprestada') || 1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-8 bg-[var(--bg-page)] print:bg-transparent p-8 rounded-[1.5rem] border border-slate-200 dark:border-white/5 print:border-neutral-200">
                <div>
                  <p className="text-slate-500 font-bold uppercase tracking-widest mb-1.5 text-[10px]">Solicitante</p>
                  <p className="font-bold text-slate-900 dark:text-white print:text-black text-sm">{recibo.tipo === 'agendamento' ? recibo.obj.get('solicitante') : recibo.obj.get('nome_solicitante')}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold uppercase tracking-widest mb-1.5 text-[10px]">Setor / Área</p>
                  <p className="font-bold text-slate-900 dark:text-white print:text-black text-sm">{recibo.tipo === 'agendamento' ? recibo.obj.get('setor_solicitante') : recibo.obj.get('setor_solicitante')}</p>
                </div>

                {recibo.tipo === 'agendamento' ? (
                  <div className="col-span-2 border-t border-slate-200 dark:border-white/5 print:border-neutral-200 pt-5 mt-2">
                    <p className="text-[#254E70] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 text-[10px]"><CalendarDays size={14} /> Agendado Para (Retirada)</p>
                    <p className="text-slate-900 dark:text-white print:text-black font-black text-lg">
                      {recibo.obj.get('data_reserva')?.toLocaleDateString('pt-BR')} às {recibo.obj.get('data_reserva')?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="col-span-2 border-t border-slate-200 dark:border-white/5 print:border-neutral-200 pt-5 mt-2 flex justify-between gap-4">
                      <div>
                        <p className="text-slate-500 font-bold uppercase tracking-widest mb-1.5 text-[10px]">Data / Hora Oficial</p>
                        <p className="text-slate-900 dark:text-white print:text-black font-black text-sm">
                          {recibo.obj.createdAt.toLocaleDateString('pt-BR')} às {recibo.obj.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 font-bold uppercase tracking-widest mb-1.5 flex items-center justify-end text-[10px]">Técnico (Saída)</p>
                        <p className="text-slate-900 dark:text-white print:text-black font-bold text-sm capitalize">{recibo.obj.get('nome_tecnico_saida') || 'Técnico'}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* LÓGICA DE ASSINATURA ELETRÔNICA NO PDF */}
              <div className="flex justify-center gap-8 pt-10">
                <div className="flex-1 flex flex-col items-center justify-end text-center">
                  {recibo.obj.get('assinatura_eletronica') ? (
                    <>
                      <div className="flex items-center gap-2 text-emerald-600 mb-4 bg-emerald-50 px-5 py-3 rounded-2xl border border-emerald-200">
                        <ShieldCheck size={20} />
                        <span className="font-black tracking-widest uppercase text-[10px]">Validada</span>
                      </div>
                      <p className="text-[10px] text-slate-700 uppercase font-bold leading-relaxed">{recibo.obj.get('detalhes_assinatura')}</p>
                    </>
                  ) : (
                    <>
                      <div className="w-full max-w-[200px] h-[1px] bg-slate-300 dark:bg-[var(--bg-card)]/20 print:bg-slate-300 mb-4"></div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                        {recibo.tipo === 'agendamento' ? 'Ciente (Solicitante)' : 'Assinatura de Retirada'}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-1 uppercase">
                        {recibo.tipo === 'agendamento' ? recibo.obj.get('solicitante') : (recibo.obj.get('quem_vai_buscar') || recibo.obj.get('nome_solicitante'))}
                      </p>
                    </>
                  )}
                </div>
              </div>

            </div>

            {/* ANEXOS DE AUDITORIA SÓ APARECEM NA TELA DA TI (NO-PRINT) */}
            <div className="mt-12 pt-8 border-t border-slate-200 dark:border-white/5 no-print">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 mb-5 text-center">Auditoria (Visão TI)</h4>

              <div className="bg-[var(--bg-page)] p-5 rounded-2xl border border-slate-200 dark:border-white/5 flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white uppercase">Termo da Operação</p>
                  <p className={`text-[10px] font-bold mt-1 ${recibo.obj.get('assinatura_eletronica') ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {recibo.obj.get('assinatura_eletronica') ? 'Assinado Digitalmente' : 'Pendente de Assinatura'}
                  </p>
                </div>

                {recibo.obj.get('assinatura_eletronica') ? (
                  <span className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-[10px] font-bold uppercase tracking-widest"><ShieldCheck size={14} /> Assinado Digital</span>
                ) : recibo.obj.get('comprovante_saida') ? (
                  <a href={recibo.obj.get('comprovante_saida').url()} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-[#254E70]/10 text-[#254E70] border border-[#254E70]/20 hover:bg-[#254E70]/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"><CheckCircle2 size={14} /> Ver Anexo Físico</a>
                ) : (
                  <label className={`cursor-pointer px-4 py-2 bg-[var(--bg-card)] text-slate-600 dark:text-[#A0A0A0] hover:bg-[var(--bg-page)] border border-slate-200 dark:border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${recibo.tipo === 'agendamento' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {uploadingAnexo === 'comprovante_saida' ? 'Enviando...' : <><UploadCloud size={14} /> Anexar Termo</>}
                    <input type="file" className="hidden" accept=".pdf,image/*" disabled={uploadingAnexo === 'comprovante_saida' || recibo.tipo === 'agendamento'} onChange={(e) => handleUploadAnexo(e.target.files[0], 'comprovante_saida')} />
                  </label>
                )}
              </div>
            </div>

            <div className="mt-8 flex gap-4 border-t border-slate-200 dark:border-white/5 pt-8 no-print">
              <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 dark:bg-[#F8FAFC] text-white dark:text-[var(--bg-page-dark)] rounded-[1.25rem] text-xs font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-[var(--bg-card)] transition-all shadow-xl flex items-center justify-center gap-2"><Printer size={16} /> Imprimir PDF</button>
              <button onClick={() => setRecibo(null)} className="flex-1 py-4 bg-[var(--bg-soft)]  text-slate-600 dark:text-[#A0A0A0] border border-slate-200 dark:border-white/5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-all">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE DETALHE UNIFICADO (ESTILO FEEDRESUMO)            */}
      {/* ========================================================= */}
      {detalheAprovacao && (() => {
        const isEmp = detalheItemTipo === 'emprestimo';
        const nomeItem = detalheAprovacao.get('item')?.get('nome_equipamento');
        const modelo = detalheAprovacao.get('item')?.get('modelo_detalhes');
        const qtd = isEmp ? detalheAprovacao.get('quantidade_emprestada') : detalheAprovacao.get('quantidade');
        const solicitante = isEmp ? detalheAprovacao.get('nome_solicitante') : detalheAprovacao.get('solicitante');
        const setor = detalheAprovacao.get('setor_solicitante');
        const dataInicio = isEmp ? detalheAprovacao.createdAt : detalheAprovacao.get('data_reserva');
        const dataRetPrev = detalheAprovacao.get('data_devolucao_prevista');
        const obs = detalheAprovacao.get('observacoes');
        const tecnicoSaida = detalheAprovacao.get('nome_tecnico_saida');
        const labelTipo = isEmp ? 'Em Uso' : 'Agendamento';
        const corTipo = isEmp ? '#8D3046' : '#254E70';

        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setDetalheAprovacao(null)}>
            <div className="bg-[var(--bg-card)] w-full max-w-lg rounded-[2rem] p-8 border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: corTipo }}>{detalheAprovacao.protocolo || detalheAprovacao.id.split('-')[0].toUpperCase()}</span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{labelTipo} - {detalheAprovacao.itens?.length || 1} Ativo{(detalheAprovacao.itens?.length || 1) !== 1 ? 's' : ''}</h3>
                </div>
                <button onClick={() => setDetalheAprovacao(null)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-xl hover:bg-[var(--bg-soft)] dark:hover:bg-[var(--bg-card)]/5"><X size={18} /></button>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-[var(--bg-page)] p-5 rounded-2xl border border-slate-200 dark:border-white/5 mb-5">
                <div><p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Solicitante</p><p className="text-sm font-bold text-slate-900 dark:text-white">{solicitante}</p></div>
                <div><p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Setor</p><p className="text-sm font-bold text-slate-900 dark:text-white">{setor || '-'}</p></div>

                <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-white/5 pb-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Itens Vinculados</p>
                  <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto custom-scrollbar">
                    {(detalheAprovacao.itens || [detalheAprovacao]).map((item, idx) => (
                      <div key={item.id || idx} className="flex justify-between items-center text-sm font-black text-slate-900 dark:text-white bg-[var(--bg-card)] p-3 rounded-[1rem] border border-slate-200 dark:border-white/10">
                        <span className="uppercase truncate mr-2">{item.get('item')?.get('nome_equipamento') || 'Item Excluído'}</span>
                        <span className="px-3 py-1 bg-[var(--bg-soft)] dark:bg-black rounded-lg text-[10px]">x{isEmp ? item.get('quantidade_emprestada') : item.get('quantidade')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div><p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">{isEmp ? 'Data de Saida' : 'Data de Inicio'}</p><p className="text-sm font-bold" style={{ color: corTipo }}>{dataInicio?.toLocaleDateString('pt-BR')} as {dataInicio?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div>

                <div className="col-span-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {dataRetPrev ? dataRetPrev.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Não informado'}
                  </p>
                </div>

                {tecnicoSaida && (
                  <div className="col-span-2 pt-3 border-t border-slate-200 dark:border-white/5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Tecnico Responsavel</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{tecnicoSaida}</p>
                  </div>
                )}

                {obs && (
                  <div className="col-span-2 pt-3 border-t border-slate-200 dark:border-white/5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Observacoes</p>
                    <p className="text-xs text-slate-600 dark:text-[#A0A0A0] leading-relaxed">{obs.replace('[PORTAL] ', '').replace('Retirada de agendamento efetivada.', '') || 'Nenhuma observação'}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setRecibo({ tipo: isEmp ? 'retirada' : 'agendamento', obj: detalheAprovacao }); setDetalheAprovacao(null); }} className="flex-1 py-3.5 bg-[var(--bg-card)]  border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-[var(--bg-page)] rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"><Printer size={14} /> Imprimir</button>

                {!isEmp ? (
                  <button onClick={() => { efetivarReserva(detalheAprovacao); setDetalheAprovacao(null); }} className="flex-1 py-3.5 bg-[#10B981] text-white hover:bg-[#059669] rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"><ArrowUpRight size={14} /> Efetivar Entrega</button>
                ) : (
                  <button onClick={() => { handleDevolver(detalheAprovacao); setDetalheAprovacao(null); }} className="flex-1 py-3.5 bg-[#254E70] text-white hover:bg-[#1e3d5a] rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"><CheckCircle2 size={14} /> Registrar Devolução</button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      <div className="no-print">
      </div>

      <HandoverModal
        isOpen={!!modalAssinatura}
        onClose={() => setModalAssinatura(null)}
        onConfirm={confirmarHandover}
        tipo={modalAssinatura?.tipo}
        solicitante={modalAssinatura?.grupo?.solicitante}
        setor={modalAssinatura?.grupo?.get?.('setor_solicitante')}
        itens={modalAssinatura?.grupo?.itens}
        loading={loading}
        preAssinado={modalAssinatura?.tipo === 'devolucao'
          ? !!modalAssinatura?.grupo?.itens?.[0]?.get?.('assinatura_dev_eletronica')
          : !!modalAssinatura?.grupo?.itens?.[0]?.get?.('assinatura_eletronica')}
        detalhesAssinaturaPortal={modalAssinatura?.tipo === 'devolucao'
          ? modalAssinatura?.grupo?.itens?.[0]?.get?.('detalhes_assinatura_dev')
          : modalAssinatura?.grupo?.itens?.[0]?.get?.('detalhes_assinatura')}
      />
    </div>
  );
}
