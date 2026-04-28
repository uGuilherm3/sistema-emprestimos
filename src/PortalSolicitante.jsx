// src/PortalSolicitante.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import { Search, ShoppingBag, Plus, Minus, Trash2, CalendarDays, Clock, FileText, Send, CheckCircle2, ArrowLeft, ShieldAlert, LogOut, Sun, Moon, Info, LayoutGrid, List, AlertTriangle, X, Download, UploadCloud, PenLine, ShieldCheck, Printer } from 'lucide-react';
import CalendarioDisponibilidade from './CalendarioDisponibilidade';
import { logAction } from './utils/log';
import { createGLPITicket } from './utils/glpiClient';
import { generateAndUploadPDF } from './utils/pdfArchive';
import VoucherPreview from './VoucherPreview';
import { useRef } from 'react';

export default function PortalSolicitante({ usuarioAtual, onLogout, onVoltar, onLoginSucesso, isDarkMode, setIsDarkMode }) {
  const [viewMode, setViewMode] = useState('login'); 
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [erroAuth, setErroAuth] = useState('');
  const [itemCalendario, setItemCalendario] = useState(null);
  const [sucessoAuth, setSucessoAuth] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [setor, setSetor] = useState(''); 
  const [confirmPassword, setConfirmPassword] = useState('');

  const [abaPortal, setAbaPortal] = useState('catalogo'); 
  const [itens, setItens] = useState([]);
  const [ativosGlobais, setAtivosGlobais] = useState([]);
  const [reservasGlobais, setReservasGlobais] = useState([]);
  const [busca, setBusca] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  
  const [meusPedidos, setMeusPedidos] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [alertasCobranca, setAlertasCobranca] = useState([]);

  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [reciboImprimir, setReciboImprimir] = useState(null);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const [assinaturaPendente, setAssinaturaPendente] = useState(null);
  const [nomeTerceiro, setNomeTerceiro] = useState('');
  const [euMesmoVouBuscar, setEuMesmoVouBuscar] = useState(true);
  const [nomeBuscador, setNomeBuscador] = useState('');
  const [euMesmoVaiEntregar, setEuMesmoVaiEntregar] = useState(true);
  const [nomeEntregador, setNomeEntregador] = useState('');

  const [carrinho, setCarrinho] = useState([]);
  const [data, setData] = useState('');
  const [hora, setHora] = useState('08:00');
  const [dataRetorno, setDataRetorno] = useState('');
  const [horaRetorno, setHoraRetorno] = useState('18:00');
  const [observacoes, setObservacoes] = useState('');
  
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [erroSubmit, setErroSubmit] = useState(''); 
  const [pedidoSucesso, setPedidoSucesso] = useState(false);
  const [layoutModo, setLayoutModo] = useState(() => localStorage.getItem('portal_layout') || 'grid');
  const pdfContainerRef = useRef(null);
  const [reciboParaPDF, setReciboParaPDF] = useState(null);

  useEffect(() => {
    localStorage.setItem('portal_layout', layoutModo);
  }, [layoutModo]);

  useEffect(() => {
    if (usuarioAtual) {
      setSetor(usuarioAtual.get('setor') || '');
    }
  }, [usuarioAtual]);

  const itensFiltrados = itens.filter(i => 
    (i.get('nome_equipamento') || '').toLowerCase().includes(busca.toLowerCase()) || 
    (i.get('modelo_detalhes') || '').toLowerCase().includes(busca.toLowerCase())
  );

  const toggleMode = (mode) => {
    setViewMode(mode); setErroAuth(''); setSucessoAuth(''); setPassword(''); setConfirmPassword('');
  };

  const validarEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

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
        if (field === 'data_reserva' && obj.data_reserva) return new Date(obj.data_reserva);
        if (field === 'data_devolucao_prevista' && obj.data_devolucao_prevista) return new Date(obj.data_devolucao_prevista);
        if (field === 'data_hora_retorno' && obj.data_hora_retorno) return new Date(obj.data_hora_retorno);
        return obj[field];
      },
      set: (field, val) => { obj[field] = val; },
      save: async () => { /* Logically handled in functions */ },
      destroy: async () => { /* Logically handled in functions */ }
    };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoadingAuth(true); setErroAuth('');
    
    let userToLogin = username.trim().toLowerCase();

    try {
      // Login Simplificado: Busca na tabela PERFIL por username ou email + pin
      const { data: profile, error } = await supabase
        .from('perfil')
        .select('*')
        .or(`username.eq."${userToLogin}",email.eq."${userToLogin}"`)
        .eq('pin', password.trim())
        .maybeSingle();

      if (error || !profile) {
        setErroAuth('Usuário ou PIN incorretos.');
        return;
      }

      if (profile.tipo_usuario !== 'solicitante') {
          setErroAuth('Esta conta é de administrador. Acesse pelo painel principal.');
          return;
      }
      
      localStorage.setItem('tilend_user_id', profile.id);
      if (onLoginSucesso) onLoginSucesso(wrap(profile));
    } catch (error) {
      setErroAuth('Erro ao realizar login.');
    } finally { setLoadingAuth(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoadingAuth(true); setErroAuth(''); setSucessoAuth('');

    if (password !== confirmPassword) { setErroAuth('As senhas não coincidem.'); setLoadingAuth(false); return; }
    if (password.length < 4) { setErroAuth('O PIN deve ter no mínimo 4 números.'); setLoadingAuth(false); return; }

    try {
      // 1. Verificar se o username ou email já existem
      const { data: existente } = await supabase
        .from('perfil')
        .select('id')
        .or(`username.eq."${username.trim().toLowerCase()}",email.eq."${email.trim().toLowerCase()}"`)
        .maybeSingle();

      if (existente) {
        setErroAuth('Nome de usuário ou E-mail já cadastrado.');
        return;
      }

      // 2. Criar Perfil diretamente (IDs aleatórios)
      const { data: novoPerfil, error: errorPerfil } = await supabase
        .from('perfil')
        .insert([{
          id: crypto.randomUUID(),
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          pin: password.trim(),
          setor: setor.trim().toUpperCase(),
          tipo_usuario: 'solicitante'
        }])
        .select()
        .single();

      if (errorPerfil) throw errorPerfil;

      // 3. Espelhar na tabela Colaborador
      const { error: errorColab } = await supabase.from('colaborador').insert({
        id: novoPerfil.id,
        nome: username.trim(),
        setor: setor.trim().toUpperCase()
      });

      if (errorColab) throw errorColab;

      setSucessoAuth('Conta criada com sucesso! Faça login.');
      setTimeout(() => { setViewMode('login'); setPassword(''); setConfirmPassword(''); }, 2000);
    } catch (error) {
      setErroAuth(error.message || 'Erro ao criar a conta.');
    } finally { setLoadingAuth(false); }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setErroAuth('Recuperação de senha não disponível para login via PIN. Contate a TI.');
  };

  useEffect(() => {
    if (usuarioAtual) {
      const fetchItens = async () => {
        try {
           // 1. DADOS DE INVENTÁRIO (Supabase - Tabela item)
           const { data: supaItens, error: errorItens } = await supabase.from('item').select('*');
           if (errorItens) throw errorItens;
           
           // 2. STATUS DE OCUPAÇÃO
           const { data: todosResultados } = await supabase.from('emprestimo').select('id, item_id, glpi_item_id, quantidade_emprestada, status_emprestimo, created_at, data_inicio_prevista, data_devolucao_prevista, data_hora_retorno');
           
           // Processar disponibilidade
           const itensProcessados = (supaItens || []).map(i => {
              const regs = (todosResultados || []).filter(e => e.item_id === i.id || (i.glpi_id && e.glpi_item_id === i.glpi_id) || (e.glpi_item_id && e.glpi_item_id === i.id));
              
              // O patrimônio total é a quantidade cadastrada na tabela item
              const total = Number(i.quantidade) || 0;
              
              return wrap({ ...i, patrimonio_total: total });
           });

           setAtivosGlobais((todosResultados || []).filter(o => o.status_emprestimo === 'Aberto').map(o => wrap(o)));
           setReservasGlobais((todosResultados || []).filter(o => o.status_emprestimo === 'Aprovado').map(o => wrap(o)));
           
           setItens(itensProcessados);
        } catch (error) { 
           console.error("Erro ao carregar catálogo:", error); 
        } finally { 
           setLoadingCatalog(false); 
        }
      };
      fetchItens();
      
      const hoje = new Date().toISOString().split('T')[0];
      setData(hoje); setDataRetorno(hoje);
    }
  }, [usuarioAtual]);

  useEffect(() => {
    if (usuarioAtual) {
      const fetchAlertas = async () => {
        try {
          const { data } = await supabase.from('emprestimo')
            .select('*')
            .eq('nome_solicitante', usuarioAtual.get('username'))
            .eq('status_emprestimo', 'Aberto')
            .not('alerta_cobranca', 'is', null);
          setAlertasCobranca((data || []).map(o => wrap(o)));
        } catch (error) { console.error(error); }
      };
      fetchAlertas();
    }
  }, [usuarioAtual, abaPortal]); 

  // ATUALIZA TÍTULO DA GUIA (ESTILO WHATSAPP) - PORTAL
  useEffect(() => {
    const baseTitle = "Portal TI Desk";
    if (alertasCobranca.length > 0) {
      document.title = `(${alertasCobranca.length}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [alertasCobranca.length]);

  const fecharAlerta = (idParaRemover) => {
    setAlertasCobranca(prevAlertas => prevAlertas.filter(alerta => alerta.id !== idParaRemover));
  };

  const fetchHistorico = async () => {
    if (!usuarioAtual) return;
    setLoadingHistorico(true);
    try {
        const nomeUsuario = usuarioAtual.get('username');
        // Tudo fica em 'emprestimo' — única fonte de verdade
        const { data: todos } = await supabase.from('emprestimo').select('id, protocolo, item_id, quantidade_emprestada, nome_solicitante, setor_solicitante, status_emprestimo, data_hora_retorno, data_devolucao_prevista, data_inicio_prevista, tempo_indeterminado, observacoes, created_at, updated_at, alerta_cobranca, quem_vai_buscar, quem_vai_entregar, nome_tecnico_saida, assinatura_eletronica, detalhes_assinatura, assinatura_dev_eletronica, detalhes_assinatura_dev, comprovante_saida, item(id, nome_equipamento, modelo_detalhes, quantidade, numero_serie)').ilike('nome_solicitante', nomeUsuario);

        const toDate = (s) => s ? new Date(s) : null;
        const listaUnificada = (todos || []).map(a => {
            const obs = a.observacoes || '';
            const isGLPI = obs.includes('[GLPI]');
            
            let nomeGLPI = null;
            let modeloGLPI = null;
            if (isGLPI) {
              const matchNome = obs.match(/\[GLPI\] (.*?) \| SN:/);
              nomeGLPI = matchNome ? matchNome[1].trim() : 'Equipamento GLPI';
              modeloGLPI = 'GLPI Asset';
            }

            return {
              id: a.id, 
              protocolo: a.protocolo, 
              tipoOrigem: 'emprestimo', 
              itemNome: a.item?.nome_equipamento || nomeGLPI || 'Excluído', 
              itemModelo: a.item?.modelo_detalhes || modeloGLPI, 
              qtd: a.quantidade_emprestada, 
              status: a.status_emprestimo, 
              dataReserva: toDate(a.data_inicio_prevista || a.created_at),
              dataRetorno: toDate(a.data_devolucao_prevista || a.data_hora_retorno),
              indeterminado: a.tempo_indeterminado, 
              dataCriacao: a.created_at, 
              comprovante_saida: a.comprovante_saida,
              assinatura_eletronica: a.assinatura_eletronica, 
              detalhes_assinatura: a.detalhes_assinatura, 
              assinatura_dev_eletronica: a.assinatura_dev_eletronica, 
              detalhes_assinatura_dev: a.detalhes_assinatura_dev,
              quem_vai_buscar: a.quem_vai_buscar, 
              quem_vai_entregar: a.quem_vai_entregar,
              fullObj: wrap({ ...a, item_nome_limpo: a.item?.nome_equipamento || nomeGLPI }) 
            };
        });

        listaUnificada.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
        setMeusPedidos(listaUnificada);
    } catch (error) { console.error("Erro ao buscar histórico:", error); } finally { setLoadingHistorico(false); }
  };

  useEffect(() => { if (abaPortal === 'historico') fetchHistorico(); }, [abaPortal, usuarioAtual]);

  const handleAssinaturaEletronica = async (tipo, terceiro) => {
    if (!pedidoSelecionado || !usuarioAtual) return;
    
    setUploadingAnexo(true);
    setAssinaturaPendente(null);
    logAction(`ASSINATURA (${tipo.toUpperCase()}) - INÍCIO`, { 
        pedidoId: pedidoSelecionado.id, 
        item_nome: pedidoSelecionado.itemNome,
        terceiro 
    });
    try {
        const agora = new Date();
        const termoIdentificador = tipo === 'retirada' ? 'RETIRADA' : 'DEVOLUÇÃO';
        const nomeUpper = usuarioAtual.get('username').toUpperCase();
        const terceiroUpper = (terceiro || '').toUpperCase();
        
        let textoAssinatura;
        if (nomeUpper === terceiroUpper) {
            textoAssinatura = `TERMO DE ${termoIdentificador} ASSINADO POR ${nomeUpper} EM ${agora.toLocaleDateString('pt-BR')} ÀS ${agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`;
        } else {
            textoAssinatura = `TERMO DE ${termoIdentificador} ASSINADO POR ${nomeUpper} AUTORIZANDO ${terceiroUpper} EM ${agora.toLocaleDateString('pt-BR')} ÀS ${agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`;
        }
        
        const dataToUpdate = {};
        if (tipo === 'retirada') {
            dataToUpdate.assinatura_eletronica = true;
            dataToUpdate.detalhes_assinatura = textoAssinatura;
            dataToUpdate.quem_vai_buscar = terceiro;
            setPedidoSelecionado({...pedidoSelecionado, assinatura_eletronica: true, detalhes_assinatura: textoAssinatura, quem_vai_buscar: terceiro});
        } else {
            dataToUpdate.assinatura_dev_eletronica = true;
            dataToUpdate.detalhes_assinatura_dev = textoAssinatura;
            dataToUpdate.quem_vai_entregar = terceiro;
            setPedidoSelecionado({...pedidoSelecionado, assinatura_dev_eletronica: true, detalhes_assinatura_dev: textoAssinatura, quem_vai_entregar: terceiro});
        }

        // Tudo em 'emprestimo' — única fonte de verdade
        const idsNoGrupo = pedidoSelecionado.itens ? pedidoSelecionado.itens.map(i => i.id) : [pedidoSelecionado.id];
        const { error } = await supabase.from('emprestimo').update(dataToUpdate).in('id', idsNoGrupo);
        if (error) throw error;

        fetchHistorico();
        
        // Automação GLPI: Enviar Termo PDF
        const obs = pedidoSelecionado.fullObj?.get('observacoes') || pedidoSelecionado.observacoes || '';
        const match = obs.match(/\[GLPI_TICKET: (\d+)\]/);
        const ticketId = match ? match[1] : null;

        if (ticketId && pdfContainerRef.current) {
            // Preparar dados para o VoucherPreview oculto
            const dadosRecibo = {
                solicitante: usuarioAtual.get('username'),
                setor: usuarioAtual.get('setor'),
                data: pedidoSelecionado.dataReserva,
                data_hora_retorno: tipo === 'devolucao' ? agora.toISOString() : null,
                status_emprestimo: tipo === 'retirada' ? 'Aberto' : 'Devolvido',
                tecnico_saida: pedidoSelecionado.fullObj?.get('nome_tecnico_saida') || 'PENDENTE',
                quem_vai_buscar: tipo === 'retirada' ? terceiro : pedidoSelecionado.quem_vai_buscar,
                quem_vai_entregar: tipo === 'devolucao' ? terceiro : null,
                protocolo: pedidoSelecionado.protocolo,
                itens: pedidoSelecionado.itens || [{
                    nome: pedidoSelecionado.itemNome,
                    quantidade: pedidoSelecionado.qtd,
                    numero_serie: pedidoSelecionado.fullObj?.get('item')?.numero_serie,
                    observacoes: pedidoSelecionado.observacoes
                }],
                // Campos de assinatura para o PDF
                assinatura_eletronica: tipo === 'retirada' ? true : pedidoSelecionado.assinatura_eletronica,
                detalhes_assinatura: tipo === 'retirada' ? textoAssinatura : pedidoSelecionado.detalhes_assinatura,
                assinatura_dev_eletronica: tipo === 'devolucao' ? true : pedidoSelecionado.assinatura_dev_eletronica,
                detalhes_assinatura_dev: tipo === 'devolucao' ? textoAssinatura : pedidoSelecionado.detalhes_assinatura_dev
            };
            setReciboParaPDF(dadosRecibo);

            setTimeout(async () => {
                try {
                    const filename = `TERMO-${tipo.toUpperCase()}-${pedidoSelecionado.protocolo}.pdf`;
                    await generateAndUploadPDF(pdfContainerRef.current, filename, ticketId);
                    console.log("Termo assinado enviado ao GLPI!");
                } catch (err) {
                    console.error("Erro no envio do termo ao GLPI:", err);
                }
            }, 1500);
        }

        logAction(`ASSINATURA (${tipo.toUpperCase()}) - SUCESSO`, { 
            pedidoId: pedidoSelecionado.id, 
            item_nome: pedidoSelecionado.itemNome,
            terceiro 
        });
    } catch (err) {
        logAction(`ASSINATURA (${tipo.toUpperCase()}) - ERRO`, { 
            pedidoId: pedidoSelecionado.id, 
            item_nome: pedidoSelecionado.itemNome, 
            error: err.message 
        });
        alert('Erro ao assinar digitalmente: ' + err.message);
    } finally { 
        setUploadingAnexo(false); 
    }
  };

  const handleUploadTermoUsuario = async (e) => {
      const file = e.target.files[0];
      if (!file || !pedidoSelecionado) return;
      
      setUploadingAnexo(true);
      try {
          // Automação GLPI: Enviar arquivo anexo se houver ticket vinculado
          const obs = pedidoSelecionado.fullObj?.get('observacoes') || pedidoSelecionado.observacoes || '';
          const match = obs.match(/\[GLPI_TICKET: (\d+)\]/);
          const ticketId = match ? match[1] : null;

          if (ticketId) {
             try {
                await uploadGLPIDocument(file, ticketId);
                console.log("Arquivo manual enviado com sucesso ao GLPI.");
             } catch (err) {
                console.error("Erro ao enviar anexo ao GLPI:", err);
             }
          }

          // Temporarily mock local storage upload until Storage is fully configured
          alert('Documento enviado com sucesso!');
          setPedidoSelecionado({...pedidoSelecionado, comprovante_saida: 'manual_upload'});
          fetchHistorico();
      } catch (err) {
          alert('Erro ao processar o documento: ' + err.message);
      } finally { setUploadingAnexo(false); }
  };

  const handleAdicionar = (itemObj, overrides = null) => {
    const existe = carrinho.find(c => c.item.id === itemObj.id);
    const disponivel = getDisponivelNoPeriodo(itemObj, overrides);
    if (existe) { 
      if (existe.qtd < disponivel) setCarrinho(carrinho.map(c => c.item.id === itemObj.id ? { ...c, qtd: c.qtd + 1 } : c)); 
    } 
    else { 
      if (disponivel > 0) setCarrinho([...carrinho, { item: itemObj, qtd: 1 }]); 
    }
  };

  const handleRemover = (itemId) => setCarrinho(carrinho.filter(c => c.item.id !== itemId));

  const handleAlterarQtd = (itemId, delta) => {
    setCarrinho(carrinho.map(c => {
      if (c.item.id === itemId) { 
        const novaQtd = c.qtd + delta; 
        const disponivel = getDisponivelNoPeriodo(c.item);
        if (novaQtd > 0 && novaQtd <= disponivel) return { ...c, qtd: novaQtd }; 
      }
      return c;
    }));
  };

  useEffect(() => { if (dataRetorno < data) setDataRetorno(data); }, [data]);

  // ==========================================
  // DISPONIBILIDADE DINÂMICA (SINGLE SOURCE OF TRUTH)
  // ==========================================
  const getDisponivelNoPeriodo = (itemObj, overrides = null) => {
    const d = overrides?.data || data;
    const h = overrides?.hora || hora;
    
    if (!itemObj || !d || !h) return 0;
    
    try {
      const [ano, ms, dia] = d.split('-'); const [hr, min] = h.split(':');
      const iniPedido = new Date(ano, ms - 1, dia, hr, min, 0);
      
      let fimPedido = new Date('2100-01-01');
      const dRet = overrides?.dataRetorno || dataRetorno;
      const hRet = overrides?.horaRetorno || horaRetorno;

      if (dRet) {
        const [rAno, rMs, rD] = dRet.split('-'); const [rh, rm] = hRet.split(':');
        fimPedido = new Date(rAno, rMs - 1, rD, rh, rm, 0);
      }

      const matchItem = (e) => e.get('item_id') === itemObj.id || (itemObj.glpi_id && e.get('glpi_item_id') === itemObj.glpi_id) || e.get('glpi_item_id') === itemObj.id;

      // Reservas APROVADAS (agendamentos futuros): usa sobreposição de janela de horário
      const qRes = reservasGlobais
        .filter(matchItem)
        .filter(r => {
          const rIni = r.get('data_inicio_prevista') ? new Date(r.get('data_inicio_prevista')) : new Date(r.createdAt);
          const rFim = r.get('data_devolucao_prevista') ? new Date(r.get('data_devolucao_prevista')) : rIni;
          return rIni < fimPedido && rFim > iniPedido;
        })
        .reduce((acc, r) => acc + (r.get('quantidade_emprestada') || 1), 0);

      // Empréstimos ABERTOS (item fisicamente fora do estoque agora):
      // Desconta SEMPRE, independente das datas agendadas.
      // Quando devolvido, o status muda para 'Devolvido' e sai de ativosGlobais automaticamente.
      const qEmp = ativosGlobais
        .filter(matchItem)
        .reduce((acc, e) => acc + (e.get('quantidade_emprestada') || 1), 0);

      return Math.max(0, (itemObj.patrimonio_total || 0) - qRes - qEmp);
    } catch(e) { return 0; }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (carrinho.length === 0 || !usuarioAtual) return;
    
    const [ano, ms, d] = data.split('-'); const [h, m] = hora.split(':');
    const dataReserva = new Date(ano, ms - 1, d, h, m, 0);

    if (!dataRetorno || !horaRetorno) {
      setErroSubmit('Por favor, informe a data e hora de devolução.'); return;
    }
    const [rAno, rMs, rD] = dataRetorno.split('-').map(Number);
    const [rh, rm] = horaRetorno.split(':').map(Number);
    const dtDevol = new Date(rAno, rMs - 1, rD, rh, rm, 0);
    if (dtDevol <= dataReserva) { 
      setErroSubmit('A devolução deve ser posterior ao horário de retirada.'); return; 
    } 
    
    // Validar se não é passado
    if (dataReserva < new Date()) {
       setErroSubmit('Não é possível realizar reservas para horários que já passaram.');
       return;
    }

    setLoadingSubmit(true); setErroSubmit('');
    const nomesEquipamentos = carrinho.map(c => c.item.get('nome_equipamento')).join(', ');
    logAction('SOLICITAÇÃO PORTAL - INÍCIO', { 
        item_nome: nomesEquipamentos,
        quantidade_itens: carrinho.length 
    });

    try {
      const isDataValida = (d) => d instanceof Date && !isNaN(d.getTime());
      const parseDataSegura = (dStr, hStr) => {
        if (!dStr || !hStr) return null;
        try {
          const [ano, ms, dia] = dStr.split('-').map(Number);
          const [h, m] = hStr.split(':').map(Number);
          return new Date(ano, ms - 1, dia, h, m, 0).toISOString();
        } catch(e) { return null; }
      };

      const dataDevolucaoNova = parseDataSegura(dataRetorno, horaRetorno);

      // Validação final de estoque
      for (const cartItem of carrinho) {
        const disponivel = getDisponivelNoPeriodo(cartItem.item);
        if (cartItem.qtd > disponivel) {
            throw new Error(`Estoque insuficiente para "${cartItem.item.get('nome_equipamento')}" no período selecionado. (Máximo: ${disponivel})`);
        }
      }

      // GERAR PROTOCOLO YYYY/XXX (Ex: 2024/005)
      const agoraProtocolo = new Date();
      const anoAtual = agoraProtocolo.getFullYear();
      const inicioAno = new Date(anoAtual, 0, 1).toISOString();
      
      // Busca contagem de protocolos únicos para este ano
      const { data: ultimosEmps } = await supabase.from('emprestimo').select('protocolo').gte('created_at', inicioAno).order('protocolo', { ascending: false }).limit(50);

      let maiorSerial = 0;
      const processarSeriais = (list) => {
        if (list && list.length > 0) {
          list.forEach(e => {
            if (e.protocolo && e.protocolo.includes('/')) {
              const serial = parseInt(e.protocolo.split('/')[1]);
              if (!isNaN(serial) && serial > maiorSerial) maiorSerial = serial;
            }
          });
        }
      };
      
      processarSeriais(ultimosEmps);
      
      const novoSerialStr = String(maiorSerial + 1).padStart(4, '0');
      const protocoloGerado = `${anoAtual}/${novoSerialStr}`;

      // Tudo vai para 'emprestimo' — única fonte de verdade
      for (const cartItem of carrinho) {
        const payload = {
            item_id: cartItem.item.id,
            quantidade_emprestada: cartItem.qtd,
            nome_solicitante: usuarioAtual.get('username'),
            setor_solicitante: usuarioAtual.get('setor') || 'N/I',
            nome_pessoa: usuarioAtual.get('username'),
            data_inicio_prevista: dataReserva.toISOString(),
            data_devolucao_prevista: dataDevolucaoNova,
            observacoes: observacoes ? `[PORTAL] ${observacoes.trim()}` : '[PORTAL] Solicitação via autoatendimento',
            id: crypto.randomUUID(),
            protocolo: protocoloGerado,
            status_emprestimo: 'Pendente'
        };
        
        const { error } = await supabase.from('emprestimo').insert(payload);
        if (error) throw error;
      }
      setPedidoSucesso(true);
      logAction('SOLICITAÇÃO PORTAL - SUCESSO', { 
          item_nome: nomesEquipamentos,
          protocolo: protocoloGerado,
          detalhes: `Usuário solicitou ${carrinho.length} tipo(s) de equipamentos via portal.` 
      });
    } catch (error) {
      logAction('SOLICITAÇÃO PORTAL - ERRO', { 
          item_nome: nomesEquipamentos, 
          error: error.message 
      });
      setErroSubmit(error.message);
    } finally {
      setLoadingSubmit(false);
    }
  };

  // TECH UI CLASSE PARA FORMULÁRIO (NOVO PADRÃO)
  const inputClass = "w-full bg-[var(--bg-page)] focus-within:ring-2 focus-within:ring-[#10B981]/50 focus-within:border-[#10B981] text-slate-900 dark:text-white px-4 py-3.5 rounded-2xl outline-none transition-all text-xs font-bold placeholder:text-slate-400 dark:placeholder:text-[#404040]";
  const labelClass = "block text-[10px] font-black uppercase text-slate-500 dark:text-[#A0A0A0] tracking-widest mb-2 ml-1";

  const renderBadgeStatus = (status) => {
      switch(status) {
          case 'Pendente': return <span className="bg-[#254E70]/10 text-[#254E70] px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase">Aguardando</span>;
          case 'Aprovado': return <span className="bg-[#254E70]/10 text-[#254E70] px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase">Aprovado (Agendado)</span>;
          case 'Aberto': return <span className="bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-sm bg-[#10B981] animate-pulse"></div> Em Uso</span>;
          case 'Devolvido': return <span className="bg-slate-200 dark:bg-[#404040] text-slate-600 dark:text-white px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase">Concluído</span>;
          case 'Recusado': return <span className="bg-[#8D3046]/10 text-[#8D3046] px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase">Recusado</span>;
          default: return <span className="bg-[var(--bg-page)]0/10 text-slate-500 border border-slate-500/20 px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase">{status}</span>;
      }
  };

  // ==========================================
  // RENDER DO SEU PEDIDO
  // ==========================================
  const renderSeuPedido = (isStacked = false) => (
    <div className={`flex flex-col transition-colors duration-300 ${isStacked ? 'bg-transparent border-none shadow-none flex-1 h-full' : 'bg-[var(--bg-card)] rounded-[2.5rem] sticky top-24 overflow-y-auto custom-scrollbar'}`} style={!isStacked ? {maxHeight: 'calc(100vh - 120px)'} : {}}>
      <div className={`${isStacked ? 'p-6 pb-2' : 'p-8 pb-4'} shrink-0`}>
        <div className="mb-0 pb-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Seu Pedido</h2>
            <p className="text-[10px] text-[#10B981] font-bold uppercase tracking-widest mt-1">{carrinho.length} iten{carrinho.length !== 1 && 's'} selecionado{carrinho.length !== 1 && 's'}</p>
          </div>
        </div>
      </div>

      <div className={`flex-1 flex flex-col ${isStacked ? 'px-6 pb-6' : 'px-8 pb-8'}`}>
        {carrinho.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-[#606060] py-10 opacity-50 shrink-0">
            <ShoppingBag size={48} strokeWidth={1} className="mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">Sua sacola está vazia</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 mb-6 shrink-0">
          {carrinho.map(c => (
            <div key={c.item.id} className="bg-[var(--bg-page)] p-4 rounded-2xl">
              <div className="flex justify-between items-start mb-3">
                <div className="pr-4 overflow-hidden">
                  <p className="text-xs font-bold text-slate-900 dark:text-white uppercase truncate">{c.item.get('nome_equipamento')}</p>
                  <p className="text-[9px] text-slate-500 dark:text-[#606060] mt-0.5 max-w-[150px] truncate">{c.item.get('modelo_detalhes')}</p>
                </div>
                <button type="button" onClick={() => handleRemover(c.item.id)} className="p-1.5 rounded-lg text-slate-400 dark:text-[#606060] hover:bg-red-50 dark:hover:bg-[#8D3046]/10 hover:text-[#8D3046] dark:hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
              </div>
              <div className="flex items-center justify-between gap-4 bg-[var(--bg-card)] px-2 py-1.5 rounded-xl w-fit">
                <button type="button" onClick={() => handleAlterarQtd(c.item.id, -1)} className="p-1.5 rounded-lg text-slate-500 dark:text-[#A0A0A0] hover:bg-[var(--bg-page)] dark:hover:bg-[var(--bg-card)]/5 hover:text-slate-900 dark:hover:text-white transition-colors"><Minus size={12}/></button>
                <span className="text-xs font-black text-slate-900 dark:text-white w-4 text-center">{c.qtd}</span>
                <button type="button" onClick={() => handleAlterarQtd(c.item.id, 1)} disabled={c.qtd >= c.item.patrimonio_total} className="p-1.5 rounded-lg text-slate-500 dark:text-[#A0A0A0] hover:bg-[var(--bg-page)] dark:hover:bg-[var(--bg-card)]/5 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-30"><Plus size={12}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className={`shrink-0 ${isStacked ? 'pt-4' : 'pt-6'} flex flex-col gap-4`}>
        {erroSubmit && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-[#8D3046]/10 text-red-600 dark:text-red-400 text-[10px] font-bold flex items-start gap-2 animate-in fade-in">
                <Info size={14} className="shrink-0 mt-0.5" /> <span className="leading-tight">{erroSubmit}</span>
            </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative group">
            <label className={labelClass}>Retirada</label>
            <div className="relative">
               <CalendarDays size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#606060] group-focus-within:text-[#10B981] transition-colors" />
               <input type="date" value={data} onChange={e => setData(e.target.value)} required className={`${inputClass} pl-10`} />
            </div>
          </div>
          <div className="relative group">
            <label className={labelClass}>Hora</label>
            <div className="relative">
               <Clock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#606060] group-focus-within:text-[#10B981] transition-colors" />
               <input type="time" value={hora} onChange={e => setHora(e.target.value)} required className={`${inputClass} pl-10`} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="relative group">
            <label className={labelClass}>Devolução <span className="text-[#8D3046]">*</span></label>
            <div className="relative">
               <CalendarDays size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#606060] group-focus-within:text-[#10B981] transition-colors" />
               <input type="date" value={dataRetorno} onChange={e => setDataRetorno(e.target.value)} required min={data} className={`${inputClass} pl-10`} />
            </div>
          </div>
          <div className="relative group">
            <label className={labelClass}>Hora <span className="text-[#8D3046]">*</span></label>
            <div className="relative">
               <Clock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#606060] group-focus-within:text-[#10B981] transition-colors" />
               <input type="time" value={horaRetorno} onChange={e => setHoraRetorno(e.target.value)} required className={`${inputClass} pl-10`} />
            </div>
          </div>
        </div>

        <div className="relative group mt-2">
          <div className="relative">
             <FileText size={14} className="absolute left-4 top-4 text-slate-400 dark:text-[#606060] group-focus-within:text-[#10B981] transition-colors" />
             <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações (Opcional)" className={`${inputClass} pl-10 h-20 resize-none custom-scrollbar py-3.5`} />
          </div>
        </div>
        <button type="submit" disabled={carrinho.length === 0 || loadingSubmit} className="w-full py-4 bg-gradient-to-r from-[#10B981] to-[#059669] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:opacity-90 hover:-translate-y-1 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 mt-4">
          {loadingSubmit ? 'Validando Estoque...' : <><Send size={16} /> Enviar Pedido</>}
        </button>
      </form>
      </div>
    </div>
  );

  // ==========================================

  // TELA DE SUCESSO (PÓS PEDIDO)
  if (pedidoSucesso) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] text-slate-900 dark:text-white flex items-center justify-center p-6 animate-in fade-in duration-700 transition-colors duration-300">
        <div className="bg-[var(--bg-card)] p-12 rounded-[2.5rem] max-w-lg w-full text-center">
          <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
             <CheckCircle2 size={48} strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-4">Pedido Enviado!</h2>
          <p className="text-slate-500 dark:text-[#A0A0A0] font-medium leading-relaxed mb-10">Sua solicitação foi encaminhada para a equipe de TI e já consta na agenda. Acompanhe o status na aba 'Meus Pedidos'.</p>
          <button onClick={() => {setPedidoSucesso(false); setCarrinho([]); setObservacoes(''); setAbaPortal('historico');}} className="w-full py-4 bg-slate-900 text-white dark:bg-[var(--bg-card)] dark:text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-neutral-200 transition-colors">Ver Meus Pedidos</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-slate-900 dark:text-[#F8FAFC] selection:bg-[#10B981]/30 font-sans flex flex-col transition-colors duration-300">
      
      <header className="h-24 flex items-center justify-between px-6 lg:px-12 shrink-0 bg-[var(--bg-page)]/70 backdrop-blur-xl sticky top-0 z-50 no-print">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3">
            {onVoltar && <button onClick={onVoltar} className="p-2 bg-slate-200 dark:bg-[var(--bg-card)]/10 rounded-xl text-slate-600 dark:text-white hover:bg-slate-300 dark:hover:bg-[var(--bg-card)]/20 transition-colors mr-2"><ArrowLeft size={16}/></button>}
            <div className="w-10 h-10 bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center shrink-0 shadow-lg"><span className="text-white dark:text-black font-black text-xs italic">TI</span></div>
            <div className="hidden sm:block">
               <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white block leading-none">TI LEND.</span>
               <span className="text-[9px] font-bold text-[#10B981] uppercase tracking-widest">Portal Colaborador</span>
            </div>
          </div>

          <div className="flex bg-[var(--bg-soft)]  p-1.5 rounded-[1.25rem]">
             <button onClick={() => setAbaPortal('catalogo')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${abaPortal === 'catalogo' ? 'bg-[var(--bg-card)]  text-slate-900 dark:text-[#10B981]' : 'text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white'}`}>
                 <LayoutGrid size={14} /> Catálogo
             </button>
             <button onClick={() => setAbaPortal('historico')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${abaPortal === 'historico' ? 'bg-[var(--bg-card)]  text-slate-900 dark:text-[#10B981]' : 'text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white'}`}>
                 <List size={14} /> Meus Pedidos
             </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden lg:block text-right border-r border-slate-200 dark:border-white/10 pr-6">
               <p className="text-xs font-bold text-slate-900 dark:text-white uppercase">{usuarioAtual.get('username')}</p>
               <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-[#606060] mt-1">{usuarioAtual.get('setor') || 'Sem Setor'}</p>
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="text-slate-500 dark:text-[#606060] hover:text-slate-900 dark:hover:text-white transition-colors p-2">
               {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={onLogout} className="flex items-center gap-2 p-2.5 bg-red-50 dark:bg-[#8D3046]/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-[#8D3046]/20 transition-colors" title="Sair da Conta">
               <LogOut size={16} />
            </button>
        </div>
      </header>

      <main className="flex-1 p-2 sm:p-4 lg:p-10 pt-0 sm:pt-0 lg:pt-0 max-w-[1750px] w-full mx-auto relative no-print">
        
        {alertasCobranca.length > 0 && abaPortal === 'catalogo' && (
          <div className="mb-8 space-y-4">
            {alertasCobranca.map(alerta => (
               <div key={alerta.id} className="relative bg-red-50 dark:bg-[#8D3046]/10 p-4 sm:p-5 rounded-2xl flex items-start sm:items-center gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="p-3 bg-red-100 dark:bg-[#8D3046]/20 rounded-xl text-red-600 dark:text-red-400 shrink-0">
                     <AlertTriangle size={24} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 pr-8">
                     <h4 className="text-red-700 dark:text-red-400 font-bold text-sm uppercase tracking-widest mb-1">Aviso Importante: Devolução Atrasada</h4>
                     <p className="text-red-600/80 dark:text-red-400/80 text-xs font-medium">{alerta.get('alerta_cobranca')}</p>
                  </div>
                  <button onClick={() => fecharAlerta(alerta.id)} className="absolute top-4 right-4 p-2 text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-[#8D3046]/20 rounded-xl transition-all" title="Ocultar aviso">
                     <X size={16} />
                  </button>
               </div>
            ))}
          </div>
        )}

        {abaPortal === 'catalogo' && (
            <div className={`grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in duration-500`}>
              <div className={`${itemCalendario ? 'xl:col-span-12' : 'xl:col-span-8 2xl:col-span-9'} flex flex-col gap-6`}>
                {itemCalendario ? (
                  <CalendarioDisponibilidade 
                    item={itemCalendario} 
                    onVoltar={() => setItemCalendario(null)}
                    onReservar={(dados) => {
                      handleAdicionar(dados.item, { 
                        data: dados.data, 
                        hora: dados.hora, 
                        dataRetorno: dados.dataRetorno, 
                        horaRetorno: dados.horaRetorno
                      });
                      
                      setData(dados.data);
                      setHora(dados.hora);
                      setDataRetorno(dados.dataRetorno);
                      setHoraRetorno(dados.horaRetorno);
                      setItemCalendario(null);
                    }}
                  />
                ) : (
                  <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[var(--bg-card)] p-8 rounded-[2.5rem] transition-colors duration-300">
                      <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Catálogo de Equipamentos</h1>
                        <p className="text-xs text-slate-500 dark:text-[#606060] mt-1 font-medium">Selecione os itens que você precisa reservar.</p>
                      </div>

                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="flex bg-[var(--bg-page)] p-1 rounded-xl">
                          <button 
                            type="button"
                            onClick={() => setLayoutModo('grid')} 
                            className={`p-2 rounded-lg transition-all ${layoutModo === 'grid' ? 'bg-[#10B981] text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
                            title="Visualização em Grade"
                          >
                            <LayoutGrid size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setLayoutModo('list')} 
                            className={`p-2 rounded-lg transition-all ${layoutModo === 'list' ? 'bg-[#10B981] text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
                            title="Visualização em Lista"
                          >
                            <List size={16} />
                          </button>
                        </div>
                        <div className="relative flex-1 md:w-72">
                          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#606060]" />
                          <input type="text" placeholder="Buscar equipamento..." value={busca} onChange={e => setBusca(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-[var(--bg-page)] rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10B981]/50 focus:border-[#10B981] transition-all placeholder:text-slate-400 dark:placeholder:text-[#606060]"/>
                        </div>
                      </div>
                    </div>

                    {loadingCatalog ? (
                      <div className="flex-1 flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-[10px] animate-spin"></div></div>
                    ) : (
                      <div className={`${layoutModo === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'flex flex-col gap-3'} overflow-y-auto custom-scrollbar pr-2 pb-10`} style={{maxHeight: 'calc(100vh - 250px)'}}>
                        {itensFiltrados.map(item => {
                          const noCarrinho = carrinho.find(c => c.item.id === item.id);
                          const qtdSelecionada = noCarrinho ? noCarrinho.qtd : 0;
                          const dispPeriodo = getDisponivelNoPeriodo(item);
                          const maxPermitido = dispPeriodo - qtdSelecionada;

                          if (layoutModo === 'list') {
                            return (
                              <div key={item.id} className="bg-[var(--bg-card)] p-4 rounded-[1.5rem] hover:opacity-90 transition-all flex items-center gap-5 group">
                                 <div className="p-4 bg-[var(--bg-page)] rounded-2xl text-[#10B981] group-hover:scale-105 transition-transform shrink-0"><ShoppingBag size={20} strokeWidth={1.5} /></div>
                                 <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                       <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase truncate">{item.get('nome_equipamento')}</h3>
                                       <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md shrink-0 ${dispPeriodo > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-[#8D3046]/10 text-red-600 dark:text-red-400'}`}>
                                          {dispPeriodo > 0 ? `${dispPeriodo} DISP` : 'ESGOTADO'}
                                       </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-[#606060] font-medium truncate">{item.get('modelo_detalhes') || 'Sem detalhes específicos'}</p>
                                 </div>
                                 <div className="flex items-center gap-3 shrink-0">
                                   <button onClick={() => setItemCalendario(item)} className="p-3 bg-[var(--bg-soft)] /60 text-slate-500 dark:text-[#606060] hover:text-[#10B981] rounded-xl transition-all" title="Ver Disponibilidade">
                                     <CalendarDays size={16}/>
                                   </button>
                                   <button onClick={() => handleAdicionar(item)} disabled={maxPermitido <= 0} className="px-5 py-3 bg-[var(--bg-page)] text-slate-700 dark:text-white hover:bg-[#10B981] hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2">
                                     <Plus size={16}/> <span>Adicionar</span>
                                   </button>
                                 </div>
                              </div>
                            );
                          }

                          return (
                            <div key={item.id} className="bg-[var(--bg-card)] p-6 rounded-[2rem] hover:opacity-90 transition-all flex flex-col justify-between group dark:shadow-none">
                          <div className="mb-6">
                            <div className="flex justify-between items-start mb-4">
                              <div className="p-3 bg-[var(--bg-page)] rounded-2xl text-[#10B981] group-hover:scale-110 transition-transform"><ShoppingBag size={20} strokeWidth={1.5} /></div>
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${dispPeriodo > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-[#8D3046]/10 text-red-600 dark:text-red-400'}`}>
                                {dispPeriodo > 0 ? `${dispPeriodo} DISPONÍVEL` : 'ESGOTA NO PERÍODO'}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase leading-tight">{item.get('nome_equipamento')}</h3>
                            <p className="text-[11px] text-slate-500 dark:text-[#606060] mt-2 line-clamp-2">{item.get('modelo_detalhes') || 'Sem detalhes específicos'}</p>
                          </div>
                          
                          <button onClick={() => setItemCalendario(item)} className="w-full py-3 mt-2 bg-[var(--bg-soft)] /60 text-slate-500 dark:text-[#606060] hover:text-slate-700 dark:hover:text-[#A0A0A0] rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 mb-2">
                            <CalendarDays size={14}/> Ver Disponibilidade
                          </button>
                          <button onClick={() => handleAdicionar(item)} disabled={maxPermitido <= 0} className="w-full py-3.5 bg-[var(--bg-page)] text-slate-700 dark:text-white hover:bg-[#10B981] dark:hover:bg-[#10B981] hover:text-white dark:hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:hover:bg-[var(--bg-page)] dark:disabled:hover:bg-[var(--bg-page-dark)] flex items-center justify-center gap-2">
                            <Plus size={16}/> Adicionar à Reserva
                          </button>
                        </div>
                      );
                    })}
                    {itensFiltrados.length === 0 && <div className="col-span-full py-20 text-center text-slate-400 dark:text-[#606060] font-bold uppercase tracking-widest text-xs">Nenhum equipamento encontrado.</div>}
                  </div>
                )}
                  </>
                )}
                </div>
              
              {!itemCalendario && (
                <div className="xl:col-span-4 2xl:col-span-3">
                  {renderSeuPedido()}
                </div>
              )}
            </div>
        )}

        {abaPortal === 'historico' && (
            <div className="animate-in fade-in duration-500 max-w-5xl mx-auto h-full flex flex-col">
                <div className="bg-[var(--bg-card)] p-8 rounded-[2.5rem] mb-6 shrink-0 transition-colors duration-300 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Meus Pedidos</h2>
                        <p className="text-[10px] text-slate-500 dark:text-[#606060] mt-1 uppercase font-bold tracking-widest">Acompanhe o status das suas solicitações</p>
                    </div>
                    <button onClick={fetchHistorico} className="p-3.5 bg-[var(--bg-page)] text-slate-500 dark:text-[#606060] hover:text-[#10B981] rounded-2xl transition-all">
                        <Clock size={18} />
                    </button>
                </div>

                <div className="flex-1 bg-[var(--bg-card)] rounded-[2.5rem] overflow-hidden flex flex-col transition-colors duration-300">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                        {loadingHistorico ? (
                            <div className="flex items-center justify-center h-full py-20"><div className="w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-[10px] animate-spin"></div></div>
                        ) : meusPedidos.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-50 py-20">
                                <List size={48} className="text-slate-400 dark:text-[#606060] mb-4" strokeWidth={1} />
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-[#606060] text-center">Nenhum pedido<br/>registrado ainda.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {(() => {
                                    const grupos = {};
                                    meusPedidos.forEach(p => {
                                        const key = p.protocolo || p.id;
                                        if (!grupos[key]) {
                                            grupos[key] = { ...p, itens: [p], qtdTotal: p.qtd };
                                        } else {
                                            if (!grupos[key].itens.some(item => item.id === p.id)) {
                                                grupos[key].itens.push(p);
                                                grupos[key].qtdTotal += p.qtd;
                                            }
                                        }
                                    });
                                    return Object.values(grupos);
                                })().map(grupo => (
                                    <div 
                                      key={grupo.protocolo || grupo.id} 
                                      onClick={() => { setPedidoSelecionado(grupo); setEuMesmoVouBuscar(true); setNomeBuscador(''); setEuMesmoVaiEntregar(true); setNomeEntregador(''); }}
                                      className="bg-[var(--bg-page)] rounded-[1.5rem] p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between hover:opacity-80 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            <div className="w-12 h-12 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center text-slate-900 dark:text-white font-black shrink-0 group-hover:scale-110 transition-transform">
                                                x{grupo.qtdTotal}
                                            </div>
                                            <div className="overflow-hidden pr-2">
                                                <p className="text-sm font-bold text-slate-900 dark:text-white uppercase leading-tight group-hover:text-[#10B981] transition-colors truncate">
                                                    <span className="bg-[#10B981]/10 text-[#10B981] px-2 py-0.5 rounded-md text-[9px] font-black mr-2">#{grupo.protocolo || grupo.id.split('-')[0].toUpperCase()}</span>
                                                    {grupo.itens.length > 1 ? `${grupo.itens.length} EQUIPAMENTOS` : grupo.itemNome}
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-500 dark:text-[#606060] mt-1 truncate">
                                                    {grupo.itens.length > 1 ? grupo.itens.map(it => it.itemNome).join(', ') : grupo.itemModelo || 'Sem detalhes'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:items-end gap-2.5 shrink-0 pt-4 sm:pt-0 w-full sm:w-auto">
                                            {renderBadgeStatus(grupo.status)}
                                            
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[#A0A0A0] flex items-center gap-1.5 mt-1">
                                                <CalendarDays size={12} /> 
                                                <span>Retirada: <strong className="text-slate-700 dark:text-white ml-0.5">{grupo.dataReserva?.toLocaleDateString('pt-BR')}</strong></span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: RESUMO DO PEDIDO E FAST TRACK DE ASSINATURA */}
        {pedidoSelecionado && !reciboImprimir && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setPedidoSelecionado(null)}>
              <div className="bg-[var(--bg-card)] w-full max-w-lg rounded-[2.5rem] p-8 relative" onClick={e => e.stopPropagation()}>
                 
                 <button onClick={() => setPedidoSelecionado(null)} className="absolute top-6 right-6 p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-[var(--bg-page)] rounded-xl transition-all">
                    <X size={16}/>
                 </button>

<div className="mb-6 pr-10">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Detalhes do Pedido</h3>
                    <p className="text-[10px] text-slate-500 dark:text-[#606060] font-black uppercase tracking-[0.2em] mt-1">Protocolo: <span className="text-[#10B981]">{pedidoSelecionado.protocolo || pedidoSelecionado.id.split('-')[0].toUpperCase()}</span></p>
                 </div>

                 <div className="space-y-3 max-h-[30vh] overflow-y-auto custom-scrollbar mb-6 pr-2">
                    {pedidoSelecionado.itens ? pedidoSelecionado.itens.map((item, idx) => (
                        <div key={idx} className="bg-[var(--bg-page)] p-4 rounded-2xl flex items-center gap-4 border border-slate-100 dark:border-white/5">
                            <div className="w-10 h-10 bg-[var(--bg-card)] rounded-xl flex items-center justify-center text-slate-900 dark:text-white font-black shrink-0 text-xs text-center">
                                x{item.qtd}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-bold text-slate-900 dark:text-white uppercase truncate">{item.itemNome}</p>
                                <p className="text-[9px] text-slate-500 dark:text-[#606060] truncate">{item.itemModelo || 'Sem detalhes'}</p>
                            </div>
                            {idx === 0 && <div className="shrink-0">{renderBadgeStatus(pedidoSelecionado.status)}</div>}
                        </div>
                    )) : (
                        <div className="bg-[var(--bg-page)] p-5 rounded-[1.5rem] flex items-center gap-4">
                            <div className="w-12 h-12 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center text-slate-900 dark:text-white font-black shrink-0">
                                x{pedidoSelecionado.qtd}
                            </div>
                            <div className="flex-1 overflow-hidden pr-2">
                                <p className="text-sm font-bold text-slate-900 dark:text-white uppercase leading-tight truncate">{pedidoSelecionado.itemNome}</p>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-[#606060] mt-1 truncate">{pedidoSelecionado.itemModelo || 'Sem detalhes'}</p>
                            </div>
                            <div>{renderBadgeStatus(pedidoSelecionado.status)}</div>
                        </div>
                    )}
                 </div>

                 {/* BLOCO 1: RETIRADA - só mostra opção de assinar se status === 'Aprovado' */}
                 {pedidoSelecionado.status === 'Pendente' && (
                     <div className="bg-[#254E70]/5 p-6 rounded-[1.5rem] mb-4">
                         <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-[#254E70]/10 text-[#254E70] rounded-xl shrink-0"><Info size={16} /></div>
                            <div>
                               <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Aguardando Análise da TI</h4>
                               <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">Sua solicitação está sendo analisada pela equipe. A assinatura digital e o download do termo estarão disponíveis assim que o pedido for <strong className="text-[#254E70]">aprovado</strong>.</p>
                            </div>
                         </div>
                     </div>
                 )}

                 {pedidoSelecionado.status === 'Aprovado' && (
                     <div className="bg-[#10B981]/5 p-6 rounded-[1.5rem] mb-4">
                         <div className="flex items-start gap-3 mb-5">
                            <div className="p-2.5 bg-[#10B981]/10 text-[#10B981] rounded-xl shrink-0"><Info size={16} /></div>
                            <div>
                               <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Pedido Aprovado! Assine sua Retirada</h4>
                               <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">Assine a <strong className="text-[#10B981]">Retirada</strong> digitalmente agora mesmo. Quando chegar na TI, é só pegar o equipamento!</p>
                            </div>
                         </div>

                         {pedidoSelecionado.assinatura_eletronica ? (
                             <div className="w-full flex flex-col gap-4 p-5 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
                                <div>
                                  <span className="flex items-center gap-2 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                     <ShieldCheck size={16}/> Retirada Assinada
                                  </span>
                                  <p className="text-[9px] font-bold text-emerald-600/70 dark:text-emerald-400/70 mt-1.5 truncate">{pedidoSelecionado.detalhes_assinatura}</p>
                                </div>
                                <button onClick={() => setReciboImprimir(pedidoSelecionado)} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                                   Ver Termo <FileText size={14}/>
                                </button>
                             </div>
                         ) : pedidoSelecionado.comprovante_saida ? (
                             <div className="w-full flex flex-col gap-4 p-5 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
                                <span className="flex items-center gap-2 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                   <CheckCircle2 size={16}/> Termo Físico Anexado
                                </span>
                                <div className="grid grid-cols-2 gap-3 mt-1">
                                   <button onClick={() => setReciboImprimir(pedidoSelecionado)} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                                      Ver Termo <FileText size={14}/>
                                   </button>
                                   <label className="cursor-pointer w-full py-3 bg-[var(--bg-card)] text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[var(--bg-page)] dark:hover:bg-[var(--bg-card)]/5 transition-all text-center">
                                      {uploadingAnexo ? 'Enviando...' : 'Substituir'}
                                      <input type="file" className="hidden" accept=".pdf,image/*" disabled={uploadingAnexo} onChange={handleUploadTermoUsuario} />
                                   </label>
                                </div>
                             </div>
                         ) : (
                             <div className="flex flex-col gap-4">
                                {/* CAMPO: Quem vai buscar + Checkbox eu mesmo */}
                                <div className="bg-[var(--bg-card)]  rounded-2xl p-4 space-y-3">
                                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-[#606060]">Quem vai buscar o equipamento?</p>
                                   <label className="flex items-center gap-2.5 cursor-pointer group">
                                      <input
                                         type="checkbox"
                                         checked={euMesmoVouBuscar}
                                         onChange={e => {
                                            setEuMesmoVouBuscar(e.target.checked);
                                            if (e.target.checked) setNomeBuscador('');
                                         }}
                                         className="accent-[#10B981] w-4 h-4 shrink-0 cursor-pointer"
                                      />
                                      <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0A0A0] group-hover:text-slate-900 dark:group-hover:text-white transition-colors select-none">
                                         Sou eu mesmo que vou buscar
                                      </span>
                                   </label>
                                   {!euMesmoVouBuscar && (
                                      <div className="animate-in fade-in slide-in-from-top-2">
                                         <input
                                            type="text"
                                            value={nomeBuscador}
                                            onChange={e => setNomeBuscador(e.target.value)}
                                            placeholder="Nome do responsável pela retirada"
                                            className="w-full bg-[var(--bg-page)]  focus-within:ring-2 focus-within:ring-[#10B981]/50 focus-within:border-[#10B981] text-slate-900 dark:text-white px-4 py-3 rounded-xl outline-none transition-all text-xs font-bold placeholder:text-slate-400 dark:placeholder:text-[#404040]"
                                         />
                                      </div>
                                   )}
                                </div>

                                <button
                                  onClick={() => {
                                     const nome = euMesmoVouBuscar ? (usuarioAtual.get('username') || '') : nomeBuscador.trim();
                                     if (!nome) { alert('Informe o nome de quem vai buscar.'); return; }
                                     handleAssinaturaEletronica('retirada', nome);
                                  }}
                                  disabled={uploadingAnexo || (!euMesmoVouBuscar && !nomeBuscador.trim())}
                                  className="w-full py-4 bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 hover:-translate-y-1 active:scale-[0.98]"
                                >
                                   {uploadingAnexo ? 'Validando...' : <><PenLine size={16}/> Assinar Eletronicamente</>}
                                </button>

                                <div className="flex items-center gap-3 my-1 opacity-50">
                                   <div className="flex-1 h-px bg-slate-300 dark:bg-slate-600"></div>
                                   <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Ou Método Tradicional</span>
                                   <div className="flex-1 h-px bg-slate-300 dark:bg-slate-600"></div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                   <button onClick={() => setReciboImprimir(pedidoSelecionado)} className="w-full py-3.5 bg-[var(--bg-card)] text-slate-700 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[var(--bg-page)] dark:hover:bg-[var(--bg-card)]/5 transition-all flex items-center justify-center gap-2">
                                      Baixar PDF <Download size={14}/>
                                   </button>
                                   
                                   <label className={`w-full py-3.5 ${uploadingAnexo ? 'bg-slate-200 dark:bg-[var(--bg-card)]/10 text-slate-500' : 'bg-slate-900 dark:bg-[var(--bg-card)] text-white dark:text-[var(--bg-page-dark)] hover:bg-slate-800 dark:hover:bg-slate-200'} rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer`}>
                                      {uploadingAnexo ? 'Enviando...' : <>Anexar <UploadCloud size={14}/></>}
                                      <input type="file" className="hidden" accept=".pdf,image/*" disabled={uploadingAnexo} onChange={handleUploadTermoUsuario} />
                                   </label>
                                </div>
                             </div>
                         )}
                     </div>
                 )}

                 {/* BLOCO 2: DEVOLUÇÃO E VISUALIZAÇÃO SE JÁ ESTIVER ABERTO/DEVOLVIDO */}
                 {['Aberto', 'Devolvido'].includes(pedidoSelecionado.status) && (
                     <div className="space-y-4">
                        
                        <div className="flex items-center justify-between p-5 bg-[var(--bg-page)] rounded-[1.5rem]">
                           <div>
                              <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Termo de Retirada</p>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1.5">{pedidoSelecionado.assinatura_eletronica ? 'Autenticado Digitalmente' : pedidoSelecionado.comprovante_saida ? 'Documento Anexado' : 'Assinado Fisicamente'}</p>
                           </div>
                           <button onClick={() => setReciboImprimir(pedidoSelecionado)} className="px-4 py-2.5 bg-[var(--bg-card)] text-slate-700 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[var(--bg-page)] dark:hover:bg-[var(--bg-card)]/5 transition-all">Ver Termo</button>
                        </div>

                        {pedidoSelecionado.status === 'Aberto' && (
                           <div className="bg-[#254E70]/5 p-6 rounded-[1.5rem] mt-2">
                              <div className="flex items-start gap-3 mb-5">
                                 <div className="p-2.5 bg-[#254E70]/10 text-[#254E70] rounded-xl shrink-0"><CheckCircle2 size={16} /></div>
                                 <div>
                                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Pronto para Devolver?</h4>
                                    <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">Assine a <strong className="text-[#254E70]">Devolução</strong> eletronicamente agora e apenas entregue o equipamento no balcão.</p>
                                 </div>
                              </div>
                              
                              {pedidoSelecionado.assinatura_dev_eletronica ? (
                                  <div className="p-5 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
                                     <span className="flex items-center gap-2 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                        <ShieldCheck size={16}/> Devolução Assinada
                                     </span>
                                     <p className="text-[9px] font-bold text-emerald-600/70 dark:text-emerald-400/70 mt-1.5 truncate">{pedidoSelecionado.detalhes_assinatura_dev}</p>
                                  </div>
                              ) : (
                                  <div className="flex flex-col gap-3">
                                     {/* CAMPO: Quem vai entregar + Checkbox eu mesmo */}
                                     <div className="bg-[var(--bg-card)]  rounded-2xl p-4 space-y-3">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-[#606060]">Quem vai entregar o equipamento?</p>
                                        <label className="flex items-center gap-2.5 cursor-pointer group">
                                           <input
                                              type="checkbox"
                                              checked={euMesmoVaiEntregar}
                                              onChange={e => {
                                                 setEuMesmoVaiEntregar(e.target.checked);
                                                 if (e.target.checked) setNomeEntregador('');
                                              }}
                                              className="accent-[#254E70] w-4 h-4 shrink-0 cursor-pointer"
                                           />
                                           <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0A0A0] group-hover:text-slate-900 dark:group-hover:text-white transition-colors select-none">
                                              Sou eu mesmo que vou entregar
                                           </span>
                                        </label>
                                        {!euMesmoVaiEntregar && (
                                           <div className="animate-in fade-in slide-in-from-top-2">
                                              <input
                                                 type="text"
                                                 value={nomeEntregador}
                                                 onChange={e => setNomeEntregador(e.target.value)}
                                                  placeholder="Nome do responsável pela entrega"
                                                 className="w-full bg-[var(--bg-page)]  focus-within:ring-2 focus-within:ring-[#254E70]/50 focus-within:border-[#254E70] text-slate-900 dark:text-white px-4 py-3 rounded-xl outline-none transition-all text-xs font-bold placeholder:text-slate-400 dark:placeholder:text-[#404040]"
                                              />
                                           </div>
                                        )}
                                     </div>

                                     <button
                                       onClick={() => {
                                          const nome = euMesmoVaiEntregar ? (usuarioAtual.get('username') || '') : nomeEntregador.trim();
                                          if (!nome) { alert('Informe o nome de quem vai entregar.'); return; }
                                          handleAssinaturaEletronica('devolucao', nome);
                                       }}
                                       disabled={uploadingAnexo || (!euMesmoVaiEntregar && !nomeEntregador.trim())}
                                       className="w-full py-4 bg-[#254E70] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 hover:-translate-y-1 active:scale-[0.98]"
                                     >
                                        {uploadingAnexo ? 'Validando...' : <><PenLine size={16}/> Assinar Eletronicamente</>}
                                     </button>
                                  </div>
                               )}
                           </div>
                        )}
                     </div>
                 )}
              </div>
           </div>
        )}

      </main>

      {/* MODAL DE NOME PARA ASSINATURA */}
      {assinaturaPendente && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in">
           <div className="bg-[var(--bg-card)] p-8 rounded-[2.5rem] max-w-sm w-full relative">
              <button onClick={() => setAssinaturaPendente(null)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-[var(--bg-page)] rounded-xl transition-all"><X size={14}/></button>
              
              <div className="mb-6">
                 <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Quem vai <span className={assinaturaPendente === 'retirada' ? 'text-[#10B981]' : 'text-[#254E70]'}>{assinaturaPendente === 'retirada' ? 'buscar' : 'entregar'}</span>?</h3>
                 <p className="text-[10px] text-slate-500 dark:text-[#606060] font-black uppercase tracking-widest leading-relaxed">Confirme o nome da pessoa que movimentará o equipamento no balcão.</p>
              </div>
              
              <div className="mb-8">
                 <label className={labelClass}>Nome Completo</label>
                 <input type="text" value={nomeTerceiro} onChange={e => setNomeTerceiro(e.target.value)} autoFocus placeholder="Nome do responsável" className={`${inputClass}`} />
              </div>

              <div className="flex gap-3 mt-4">
                 <button onClick={() => setAssinaturaPendente(null)} className="flex-1 py-4 text-slate-600 bg-[var(--bg-soft)]  dark:text-[#A0A0A0] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-[var(--bg-card)]/5 transition-colors">Cancelar</button>
                 <button onClick={() => handleAssinaturaEletronica(assinaturaPendente, nomeTerceiro)} disabled={!nomeTerceiro.trim()} className={`flex-1 flex items-center justify-center gap-2 py-4 text-white disabled:opacity-50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${assinaturaPendente === 'retirada' ? 'bg-[#10B981] hover:bg-[#059669]' : 'bg-[#254E70] hover:opacity-90'}`}>
                    <PenLine size={14}/> Assinar
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL DE IMPRESSÃO UNIVERSAL (PDF) */}
      {/* ========================================== */}
      {reciboImprimir && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto custom-scrollbar print:p-0 print:bg-[var(--bg-card)] print:absolute print:inset-0 print:block print:w-full">
          
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * { visibility: hidden !important; }
              #printable-pdf, #printable-pdf * { visibility: visible !important; }
              #printable-pdf { 
                position: fixed !important; 
                left: 0 !important; 
                top: 0 !important; 
                width: 100vw !important; 
                height: 100vh !important;
                background: white !important; 
                color: black !important;
                padding: 40px !important;
                margin: 0 !important;
                border-radius: 0 !important;
              }
              .no-print { display: none !important; }
            }
          ` }} />

          <div 
            id="printable-pdf"
            className="bg-[var(--bg-card)] w-full max-w-2xl rounded-[2.5rem] p-12 my-auto print:shadow-none print:border-none print:m-0 print:w-full print:max-w-none"
          >
            <div className="text-center pb-8 mb-8">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#254E70] print:text-[#606060] mb-2">Termo de Equipamento</h4>
                <p className="text-3xl font-black text-slate-900 dark:text-white print:text-black italic tracking-tighter">TI LEND.</p>
            </div>

            <div className="space-y-8">
              <div className="flex justify-between items-center mb-8">
                  <div>
                      <span className="font-black text-slate-900 dark:text-white print:text-black uppercase text-2xl">{reciboImprimir.itemNome}</span>
                      {reciboImprimir.itemModelo && <span className="text-slate-500 text-sm block mt-1">{reciboImprimir.itemModelo}</span>}
                  </div>
                  <span className="font-black text-slate-900 dark:text-white print:text-black text-2xl px-5 py-2 bg-[var(--bg-soft)]  print:bg-[var(--bg-soft)] rounded-2xl">
                      x{reciboImprimir.qtd}
                  </span>
              </div>

              <div className="grid grid-cols-2 gap-8 bg-[var(--bg-page)] print:bg-transparent p-8 rounded-[1.5rem]">
                <div>
                   <p className="text-slate-500 font-bold uppercase tracking-widest mb-1.5 text-[10px]">Solicitante</p>
                   <p className="font-bold text-slate-900 dark:text-white print:text-black text-sm">{usuarioAtual.get('username')}</p>
                </div>
                <div>
                   <p className="text-slate-500 font-bold uppercase tracking-widest mb-1.5 text-[10px]">Setor / Área</p>
                   <p className="font-bold text-slate-900 dark:text-white print:text-black text-sm">{usuarioAtual.get('setor') || 'N/I'}</p>
                </div>

                <div className="col-span-2 pt-5 mt-2 flex justify-between gap-4">
                  <div>
                      <p className="text-slate-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 text-[10px]">
                         <CalendarDays size={14}/> Saída Oficial / Agendado
                      </p>
                      <p className="text-slate-900 dark:text-white print:text-black font-black text-base">
                         {reciboImprimir.dataReserva?.toLocaleDateString('pt-BR')} às {reciboImprimir.dataReserva?.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                      </p>
                  </div>
                  
                  {reciboImprimir.status === 'Devolvido' && (
                      <div className="text-right">
                          <p className="text-slate-500 font-bold uppercase tracking-widest mb-2 flex items-center justify-end gap-1.5 text-[10px]">
                             Entrada Oficial <CheckCircle2 size={14}/>
                          </p>
                          <p className="text-slate-900 dark:text-white print:text-black font-black text-base">
                             {reciboImprimir.dataRetorno?.toLocaleDateString('pt-BR')} às {reciboImprimir.dataRetorno?.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                          </p>
                      </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between gap-8 pt-10">
                  
                  {/* ASSINATURA RETIRADA */}
                  <div className="flex-1 flex flex-col items-center justify-end text-center">
                     {reciboImprimir.assinatura_eletronica ? (
                         <>
                            <div className="flex items-center gap-2 text-emerald-600 mb-4 bg-emerald-50 px-5 py-3 rounded-2xl">
                                <ShieldCheck size={20} />
                                <span className="font-black tracking-widest uppercase text-[10px]">Retirada Validada</span>
                            </div>
                            <p className="text-[10px] text-slate-700 uppercase font-bold leading-relaxed">{reciboImprimir.detalhes_assinatura}</p>
                         </>
                     ) : (
                         <>
                            <div className="w-full max-w-[200px] h-[1px] bg-slate-300 dark:bg-[var(--bg-card)]/20 mb-4"></div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Assinatura de Retirada</p>
                            <p className="text-[9px] text-slate-400 mt-1 uppercase">{reciboImprimir.quem_vai_buscar || usuarioAtual.get('username')}</p>
                         </>
                     )}
                  </div>

                  {/* ASSINATURA DEVOLUÇÃO */}
                  {(reciboImprimir.status === 'Aberto' || reciboImprimir.status === 'Devolvido') && (
                      <div className="flex-1 flex flex-col items-center justify-end text-center pl-8">
                         {reciboImprimir.assinatura_dev_eletronica ? (
                             <>
                                <div className="flex items-center gap-2 text-emerald-600 mb-4 bg-emerald-50 px-5 py-3 rounded-2xl">
                                    <ShieldCheck size={20} />
                                    <span className="font-black tracking-widest uppercase text-[10px]">Devolução Validada</span>
                                </div>
                                <p className="text-[10px] text-slate-700 uppercase font-bold leading-relaxed">{reciboImprimir.detalhes_assinatura_dev}</p>
                             </>
                         ) : (
                             <>
                                <div className="w-full max-w-[200px] h-[1px] bg-slate-300 dark:bg-[var(--bg-card)]/20 mb-4"></div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Assinatura de Devolução</p>
                                <p className="text-[9px] text-slate-400 mt-1 uppercase">{reciboImprimir.quem_vai_entregar || usuarioAtual.get('username')}</p>
                             </>
                         )}
                      </div>
                  )}

              </div>
            </div>

            <div className="mt-12 pt-8 flex gap-4 print:hidden">
              <button 
                onClick={() => window.print()} 
                className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[1.25rem] text-xs font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
              >
                <Printer size={16}/> Imprimir PDF
              </button>
              <button 
                onClick={() => setReciboImprimir(null)} 
                className="flex-1 py-4 bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-[#A0A0A0] rounded-[1.25rem] text-xs font-black uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Container Oculto para Geração de PDF */}
      <div style={{ position: 'absolute', left: '-9999px', top: '0', width: '800px' }}>
         <div ref={pdfContainerRef}>
            {reciboParaPDF && <VoucherPreview dados={reciboParaPDF} isPrintable={true} />}
         </div>
      </div>
    </div>
  );
}
