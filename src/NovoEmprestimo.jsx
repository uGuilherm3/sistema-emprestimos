import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './utils/supabaseClient';
import { ArrowUpRight, User, Briefcase, Hash, Package, CheckCircle2, ShieldAlert, ChevronDown, ChevronUp, Plus, Trash2, FileText, UploadCloud, Globe, CalendarDays, Clock, Edit2, X, Printer, PenLine } from 'lucide-react';
import { logAction } from './utils/log';
import { enviarEmailEmprestimoAPI } from './utils/emailClient';
import VoucherPreview from './VoucherPreview';
import HandoverModal from './HandoverModal';

export default function NovoEmprestimo({ itensDisponiveis, onEmprestimoRealizado, usuarioAtual }) {
  const [carrinho, setCarrinho] = useState([]);
  const [itemId, setItemId] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [isDropdownItemOpen, setIsDropdownItemOpen] = useState(false);
  const [buscaItem, setBuscaItem] = useState('');
  const [tipoSaida, setTipoSaida] = useState('Ativo');

  const [colaboradores, setColaboradores] = useState([]);
  const [isDropdownColabOpen, setIsDropdownColabOpen] = useState(false);
  const [buscaColab, setBuscaColab] = useState('');
  const [setorNovo, setSetorNovo] = useState('');

  const [nomeSolicitante, setNomeSolicitante] = useState('');
  const [setorSolicitante, setSetorSolicitante] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });

  const [dataRetorno, setDataRetorno] = useState('');
  const [horaRetorno, setHoraRetorno] = useState('18:00');

  const [reciboPronto, setReciboPronto] = useState(null);
  const [uploadingSaida, setUploadingSaida] = useState(false);
  const pdfContainerRef = useRef(null);
  const [solicitacoes, setSolicitacoes] = useState([]);

  const [editandoColab, setEditandoColab] = useState(null);
  const [editNomeColab, setEditNomeColab] = useState('');
  const [editSetorColab, setEditSetorColab] = useState('');
  const [modalAssinatura, setModalAssinatura] = useState(false);

  const fetchColaboradores = async () => {
    try {
      const { data } = await supabase.from('users').select('*').order('nome', { ascending: true });
      setColaboradores(data || []);
    } catch (e) { console.error('Erro ao carregar colaboradores:', e); }
  };

  const handleAddColaborador = async () => {
    try {
      const { error } = await supabase.from('users').insert({
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
    setEditNomeColab(c.nome);
    setEditSetorColab(c.setor);
  };

  const salvarEdicaoColab = async (e, id) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from('users').update({
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
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      fetchColaboradores();
    } catch (err) { alert(err.message); }
  };

  const fetchSolicitacoes = async () => {
    try {
      const { data } = await supabase.from('emprestimo').select('*, item(*)').eq('status_emprestimo', 'Pendente').order('created_at', { ascending: true });
      setSolicitacoes(data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchColaboradores();
    fetchSolicitacoes();
    const hoje = new Date().toISOString().split('T')[0];
    setDataRetorno(hoje);
  }, [itensDisponiveis]);

  const itemDropdownRef = useRef(null);
  const colabDropdownRef = useRef(null);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target)) {
        setIsDropdownItemOpen(false);
      }
      if (colabDropdownRef.current && !colabDropdownRef.current.contains(event.target)) {
        setIsDropdownColabOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const itensComEstoque = (itensDisponiveis || []).filter(i => {
    const temQtd = (Number(i.quantidade_disponivel) || 0) > 0;
    const termo = buscaItem.toLowerCase();
    const nome = (i.nome_equipamento || '').toLowerCase();
    const mod = (i.modelo_detalhes || '').toLowerCase();
    const serie = (i.numero_serie || '').toLowerCase();
    return temQtd && (nome.includes(termo) || mod.includes(termo) || serie.includes(termo));
  });
  const itemSelecionado = (itensDisponiveis || []).find(i => i.id === itemId);

  useEffect(() => {
    if (itemSelecionado?.bloqueado_insumo || carrinho.some(i => i.bloqueado_insumo)) {
      setTipoSaida('Ativo');
    }
  }, [itemSelecionado, carrinho]);

  const handleAdicionarItem = () => {
    if (!itemSelecionado) return;
    const qtdDesejada = Number(quantidade) || 0;
    if (qtdDesejada <= 0) return;
    const qtdJaNoCarrinho = carrinho.filter(c => c.itemId === itemId).reduce((acc, c) => acc + c.quantidade, 0);
    const estoqueReal = Number(itemSelecionado.quantidade_disponivel) || 0;

    if (tipoSaida === 'Insumo' && itemSelecionado.bloqueado_insumo) {
      setMensagem({ texto: `Item bloqueado para Insumo.`, tipo: 'erro' });
      setTimeout(() => setMensagem({ texto: '', tipo: '' }), 5000);
      return;
    }

    if (qtdDesejada + qtdJaNoCarrinho > estoqueReal) {
      setMensagem({ texto: `Estoque insuficiente. Restam ${estoqueReal - qtdJaNoCarrinho} un.`, tipo: 'erro' });
      setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3000);
      return;
    }
    setCarrinho([...carrinho, {
      itemId: itemSelecionado.id,
      nome: itemSelecionado.nome_equipamento,
      modelo: itemSelecionado.modelo_detalhes,
      numero_serie: itemSelecionado.numero_serie,
      quantidade: qtdDesejada,
      bloqueado_insumo: itemSelecionado.bloqueado_insumo
    }]);
    setItemId(''); setQuantidade(1); setIsDropdownItemOpen(false);
  };

  const handleRemoverItem = (index) => {
    const novoCarrinho = [...carrinho]; novoCarrinho.splice(index, 1); setCarrinho(novoCarrinho);
  };

  const limparFormulario = () => {
    setCarrinho([]); setItemId(''); setQuantidade(1); setNomeSolicitante(''); setSetorSolicitante(''); setObservacoes('');
    setDataRetorno(new Date().toISOString().split('T')[0]); setHoraRetorno('18:00'); setBuscaColab(''); setMensagem({ texto: '', tipo: '' }); setTipoSaida('Ativo');
  };

  const handleEmprestimo = async (e) => {
    e.preventDefault();
    if (carrinho.length === 0) { setMensagem({ texto: 'Carrinho vazio.', tipo: 'erro' }); return; }
    if (!nomeSolicitante) { setMensagem({ texto: 'Selecione um solicitante.', tipo: 'erro' }); return; }
    if (tipoSaida === 'Ativo') {
      if (!dataRetorno || !horaRetorno) { setMensagem({ texto: 'Retorno obrigatório.', tipo: 'erro' }); return; }
      const [rAno, rMes, rDia] = dataRetorno.split('-').map(Number);
      const [rh, rm] = horaRetorno.split(':').map(Number);
      const dataDev = new Date(rAno, rMes - 1, rDia, rh, rm, 0);
      if (dataDev <= new Date()) { setMensagem({ texto: 'Retorno inválido.', tipo: 'erro' }); return; }
    }
    setModalAssinatura(true);
  };

  const confirmarHandover = async (nomeResponsavel) => {
    setLoading(true); setMensagem({ texto: '', tipo: '' });
    try {
      const agora = new Date();
      const textoAssinatura = `TERMO ASSINADO POR ${nomeResponsavel.toUpperCase()} EM ${agora.toLocaleString('pt-BR')}`;
      const novosEmprestimosGerados = [];
      const anoAtual = agora.getFullYear();
      const inicioAno = new Date(anoAtual, 0, 1).toISOString();
      const { data: ultimosEmps } = await supabase.from('emprestimo').select('protocolo').gte('created_at', inicioAno).order('protocolo', { ascending: false }).limit(100);

      let maiorSerial = 0;
      (ultimosEmps || []).forEach(e => {
        if (e.protocolo && e.protocolo.includes('/')) {
          const isIS = e.protocolo.endsWith('IS');
          if (isIS === (tipoSaida === 'Insumo')) {
            const serial = parseInt(e.protocolo.split('/')[1].replace('IS', ''));
            if (!isNaN(serial) && serial > maiorSerial) maiorSerial = serial;
          }
        }
      });

      let candidateSerial = maiorSerial + 1;
      let protocoloGerado = "";
      let isUnique = false;
      while (!isUnique) {
        protocoloGerado = `${anoAtual}/${String(candidateSerial).padStart(4, '0')}${tipoSaida === 'Insumo' ? 'IS' : ''}`;
        const { count } = await supabase.from('emprestimo').select('*', { count: 'exact', head: true }).eq('protocolo', protocoloGerado);
        if ((count || 0) === 0) isUnique = true; else candidateSerial++;
      }

      for (const itemCart of carrinho) {
        const itemOriginal = (itensDisponiveis || []).find(i => i.id === itemCart.itemId);
        const { data: empInserido, error: empError } = await supabase.from('emprestimo').insert({
          item_id: itemCart.itemId,
          quantidade_emprestada: itemCart.quantidade,
          nome_solicitante: nomeSolicitante.trim(),
          setor_solicitante: (setorSolicitante || '').trim().toUpperCase(),
          observacoes: observacoes || null,
          status_emprestimo: tipoSaida === 'Ativo' ? 'Aberto' : 'Consumido',
          nome_tecnico_saida: (usuarioAtual?.get?.('username') || usuarioAtual?.username || usuarioAtual?.nome) || 'TECNICO',
          data_devolucao_prevista: tipoSaida === 'Ativo' ? new Date(`${dataRetorno}T${horaRetorno}`).toISOString() : null,
          assinatura_eletronica: true,
          detalhes_assinatura: textoAssinatura,
          quem_vai_buscar: nomeResponsavel,
          protocolo: protocoloGerado,
          glpi_item_id: itemOriginal?.glpi_id || null
        }).select('*, item(*)').single();
        if (empError) throw empError;
        novosEmprestimosGerados.push(empInserido);

        // Se for INSUMO (Consumido), subtraímos definitivamente do total físico
        if (tipoSaida === 'Insumo' && itemOriginal) {
          const novaQtd = Math.max(0, (Number(itemOriginal.quantidade) || 0) - itemCart.quantidade);
          await supabase.from('item').update({ quantidade: novaQtd }).eq('id', itemCart.itemId);
        }
      }

      setReciboPronto({
        solicitante: nomeSolicitante, setor: setorSolicitante, data: agora,
        tecnico_saida: (usuarioAtual?.get?.('username') || usuarioAtual?.username || usuarioAtual?.nome) || 'TECNICO',
        itens: [...carrinho], emprestimosGerados: novosEmprestimosGerados, comprovanteSaidaSalvo: false
      });

      try {
        await enviarEmailEmprestimoAPI({
          protocolo: protocoloGerado, solicitante: nomeSolicitante, setor: setorSolicitante,
          itens: carrinho.map(c => ({ nome: c.nome, quantidade: c.quantidade, serial: c.numero_serie || 'N/I' })),
          tecnico: usuarioAtual?.username || 'SISTEMA', dataDevolucao: tipoSaida === 'Ativo' ? `${dataRetorno} ${horaRetorno}` : 'INSUMO',
          observacoes: observacoes || 'N/I', assinatura: textoAssinatura
        });
      } catch (e) { console.error('Email error:', e); }

      limparFormulario(); if (onEmprestimoRealizado) onEmprestimoRealizado();
      setModalAssinatura(false);
    } catch (error) { setMensagem({ texto: 'Erro: ' + error.message, tipo: 'erro' }); } finally { setLoading(false); }
  };

  const handleUploadSaida = async (file) => {
    if (!file || !reciboPronto) return;
    setUploadingSaida(true);
    try {
      const protocolo = reciboPronto.emprestimosGerados?.[0]?.protocolo || 'sem-protocolo';
      const storagePath = `emprestimos/${protocolo.replace(/\//g, '-')}/comprovante.${file.name.split('.').pop()}`;
      await supabase.storage.from('comprovantes').upload(storagePath, file, { upsert: true });
      await enviarEmailEmprestimoAPI({
        protocolo, solicitante: reciboPronto.solicitante, setor: reciboPronto.setor,
        itens: reciboPronto.itens.map(i => ({ nome: i.nome, quantidade: i.quantidade, serial: i.numero_serie || 'N/I' })),
        tecnico: reciboPronto.tecnico_saida, observacoes: 'Comprovante anexado.', comprovante: { bucket: 'comprovantes', path: storagePath }
      });
      setReciboPronto({ ...reciboPronto, comprovanteSaidaSalvo: true });
    } catch (e) { alert('Erro: ' + e.message); } finally { setUploadingSaida(false); }
  };

  const handleAprovar = async (ag) => {
    try {
      const ids = ag.isGrupo ? ag.ids : [ag.id];
      await supabase.from('emprestimo').update({ status_emprestimo: 'Aprovado' }).in('id', ids);
      setMensagem({ texto: 'Reserva aprovada!', tipo: 'sucesso' });
      fetchSolicitacoes();
      setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3000);
    } catch (e) { alert('Erro: ' + e.message); }
  };

  const handleRejeitar = async (ag) => {
    if (!window.confirm('Excluir?')) return;
    try {
      const ids = ag.isGrupo ? ag.ids : [ag.id];
      await supabase.from('emprestimo').delete().in('id', ids);
      setMensagem({ texto: 'Recusada.', tipo: 'sucesso' });
      fetchSolicitacoes();
      setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3000);
    } catch (e) { alert('Erro: ' + e.message); }
  };

  const inputClass = "w-full bg-[var(--bg-page)] focus-within:ring-2 focus-within:ring-[#8D3046]/50 text-slate-900 dark:text-white px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold";
  const labelClass = "block text-[10px] font-black uppercase text-slate-500 dark:text-[#606060] tracking-widest mb-2 ml-1";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 h-full flex-1">
      <div className="xl:col-span-9 bg-[var(--bg-card)] rounded-3xl relative flex flex-col h-full overflow-hidden transition-all duration-300">
        {loading && <div className="absolute top-0 left-0 h-1.5 bg-[#8D3046] animate-pulse w-full z-10"></div>}
        <div className="p-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#8D3046]/10 rounded-2xl text-[#8D3046]"><ArrowUpRight size={24} /></div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Registro de Saídas</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Checkout Manual</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-[var(--bg-soft)] p-1.5 rounded-2xl">
            <button onClick={() => setTipoSaida('Ativo')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-xl transition-all ${tipoSaida === 'Ativo' ? 'bg-[#8D3046] text-white shadow-sm' : 'text-slate-500'}`}>Ativo</button>
            <button onClick={() => setTipoSaida('Insumo')} disabled={itemSelecionado?.bloqueado_insumo || carrinho.some(i => i.bloqueado_insumo)} className={`px-4 py-2 text-[9px] font-black uppercase rounded-xl transition-all ${tipoSaida === 'Insumo' ? 'bg-[#8D3046] text-white shadow-sm' : 'text-slate-500'} disabled:opacity-20`}>Insumo</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <form onSubmit={handleEmprestimo} className="p-8 flex flex-col min-h-full">
            {mensagem.texto && <div className={`p-4 rounded-2xl text-xs font-bold mb-8 ${mensagem.tipo === 'sucesso' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{mensagem.texto}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end mb-8">
              <div className="md:col-span-7 relative z-[60]" ref={itemDropdownRef}>
                <label className={labelClass}>Equipamento</label>
                <div className="relative group">
                  <input 
                    type="text" 
                    placeholder={itemSelecionado ? `${itemSelecionado.nome_equipamento}` : "Pesquisar..."}
                    value={buscaItem}
                    onChange={e => {
                      setBuscaItem(e.target.value);
                      if (!isDropdownItemOpen) setIsDropdownItemOpen(true);
                      if (itemId) setItemId(null); // Limpa seleção ao digitar
                    }}
                    onFocus={() => setIsDropdownItemOpen(true)}
                    className={`${inputClass} pr-10 focus:ring-2 focus:ring-[#8D3046]/20`}
                  />
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropdownItemOpen(!isDropdownItemOpen);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer transition-transform duration-300 z-10"
                  >
                    <ChevronDown size={16} className={`${isDropdownItemOpen ? 'rotate-180 text-[#8D3046]' : 'text-slate-400'}`} />
                  </div>
                </div>

                {isDropdownItemOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl p-2 z-[70] max-h-80 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2">
                    {itensComEstoque.length > 0 ? (
                      itensComEstoque.map(i => (
                        <div key={i.id} onClick={() => { 
                          setItemId(i.id); 
                          setIsDropdownItemOpen(false); 
                          setBuscaItem(''); 
                        }} className="p-4 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl cursor-pointer flex justify-between items-center transition-all group/item">
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-900 dark:text-white group-hover/item:text-[#8D3046] transition-colors">{i.nome_equipamento}</p>
                            <p className="text-[9px] text-slate-500 uppercase">{i.numero_serie ? `S/N: ${i.numero_serie}` : (i.modelo_detalhes || 'Geral')}</p>
                          </div>
                          <span className="text-[10px] font-black text-[#8D3046] bg-[#8D3046]/5 px-2 py-1 rounded-lg">{i.quantidade_disponivel} un.</span>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center">
                        <p className="text-[10px] font-black uppercase text-slate-400">Nenhum item encontrado</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Qtd</label>
                <input type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} className={`${inputClass} text-center`} />
              </div>
              <div className="md:col-span-3">
                <button type="button" onClick={handleAdicionarItem} disabled={!itemId} className="w-full py-3.5 bg-[var(--bg-page)] text-slate-900 dark:text-white hover:text-[#8D3046] rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"><Plus size={16} /> Add</button>
              </div>
            </div>

            {carrinho.length > 0 && (
              <div className="mb-10 flex flex-wrap gap-3">
                {carrinho.map((item, idx) => (
                  <div key={idx} className="bg-[var(--bg-soft)] p-4 rounded-2xl flex items-center gap-4 group relative">
                    <span className="text-[11px] font-black text-[#8D3046]">x{item.quantidade}</span>
                    <span className="text-[11px] font-black uppercase">{item.nome}</span>
                    <button type="button" onClick={() => handleRemoverItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="relative z-40" ref={colabDropdownRef}>
                <label className={labelClass}>Solicitante</label>
                <div className="relative group">
                  <input 
                    type="text" 
                    placeholder={nomeSolicitante || "Pesquisar..."}
                    value={buscaColab}
                    onChange={e => {
                      setBuscaColab(e.target.value);
                      if (!isDropdownColabOpen) setIsDropdownColabOpen(true);
                      if (nomeSolicitante) setNomeSolicitante(''); // Limpa seleção ao digitar
                    }}
                    onFocus={() => setIsDropdownColabOpen(true)}
                    className={`${inputClass} pr-10 focus:ring-2 focus:ring-[#8D3046]/20`}
                  />
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropdownColabOpen(!isDropdownColabOpen);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer transition-transform duration-300 z-10"
                  >
                    <ChevronDown size={16} className={`${isDropdownColabOpen ? 'rotate-180 text-[#8D3046]' : 'text-slate-400'}`} />
                  </div>
                </div>

                {isDropdownColabOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl p-2 z-[70] max-h-80 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2">
                    {colaboradores.filter(c => (c.nome || '').toLowerCase().includes(buscaColab.toLowerCase())).length === 0 && buscaColab && (
                      <div className="p-4 bg-[#8D3046]/5 rounded-xl mb-2">
                        <p className="text-[10px] font-black uppercase text-[#8D3046] mb-3">Novo Colaborador</p>
                        <input type="text" placeholder="Setor..." value={setorNovo} onChange={e => setSetorNovo(e.target.value)} className="w-full bg-white dark:bg-[#121212] p-3 rounded-xl text-xs font-bold mb-2 outline-none dark:text-white" />
                        <button type="button" onClick={handleAddColaborador} className="w-full py-3 bg-[#8D3046] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#8D3046]/20">Cadastrar e Selecionar</button>
                      </div>
                    )}
                    
                    {colaboradores.filter(c => (c.nome || '').toLowerCase().includes(buscaColab.toLowerCase())).map(c => (
                      <div key={c.id} onClick={() => { 
                        if (editandoColab === c.id) return;
                        setNomeSolicitante(c.nome); 
                        setSetorSolicitante(c.setor); 
                        setIsDropdownColabOpen(false); 
                        setBuscaColab(''); 
                      }} className="p-4 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl cursor-pointer flex justify-between items-center transition-all group/colab">
                        {editandoColab === c.id ? (
                          <div className="flex-1 flex flex-col gap-2 pr-4" onClick={e => e.stopPropagation()}>
                            <input autoFocus type="text" value={editNomeColab} onChange={e => setEditNomeColab(e.target.value)} className="w-full bg-white dark:bg-[#121212] p-2 rounded-lg text-xs font-bold border border-[#8D3046]/30 outline-none dark:text-white" />
                            <input type="text" value={editSetorColab} onChange={e => setEditSetorColab(e.target.value)} className="w-full bg-white dark:bg-[#121212] p-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-white/10 outline-none dark:text-white" />
                            <div className="flex gap-2 mt-1">
                              <button onClick={(e) => salvarEdicaoColab(e, c.id)} className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1"><CheckCircle2 size={12} /> Salvar</button>
                              <button onClick={(e) => { e.stopPropagation(); setEditandoColab(null); }} className="flex-1 py-2 bg-slate-100 dark:bg-white/10 text-slate-500 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1"><X size={12} /> Sair</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="text-xs font-bold uppercase text-slate-900 dark:text-white group-hover/colab:text-[#8D3046] transition-colors">{c.nome}</p>
                              <p className="text-[9px] text-slate-500 uppercase">{c.setor}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={(e) => iniciarEdicaoColab(e, c)} className="text-slate-300 hover:text-[#8D3046] p-2 transition-colors"><Edit2 size={14} /></button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); deletarColab(e, c.id); }} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>Observações</label>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} className={`${inputClass} !h-[45px] resize-none`} />
              </div>
              {tipoSaida === 'Ativo' && (
                <>
                  <div><label className={labelClass}>Data Retorno</label><input type="date" value={dataRetorno} onChange={e => setDataRetorno(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Hora Retorno</label><input type="time" value={horaRetorno} onChange={e => setHoraRetorno(e.target.value)} className={inputClass} /></div>
                </>
              )}
            </div>

            <div className="mt-auto flex gap-4 pt-8 border-t border-slate-100 dark:border-white/5">
              <button type="button" onClick={limparFormulario} className="flex-1 py-4 bg-[var(--bg-soft)] text-slate-500 rounded-2xl text-[11px] font-black uppercase">Limpar</button>
              <button type="submit" disabled={loading || carrinho.length === 0} className="flex-[2] py-4 bg-[#8D3046] text-white rounded-2xl text-[11px] font-black uppercase">{loading ? '...' : 'Confirmar Saída'}</button>
            </div>
          </form>
        </div>
      </div>

      <div className="xl:col-span-3 bg-[var(--bg-card)] rounded-3xl p-8 flex flex-col h-full">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase mb-8 flex items-center gap-2"><Globe size={18} /> Pendentes ({solicitacoes.length})</h3>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {solicitacoes.map(s => (
            <div key={s.id} className="bg-[var(--bg-page)] p-5 rounded-2xl mb-4 border border-slate-100 dark:border-white/5">
              <p className="text-xs font-bold uppercase">{s.nome_solicitante}</p>
              <p className="text-[10px] text-slate-500 uppercase mb-4">{s.item?.nome_equipamento} (x{s.quantidade_emprestada})</p>
              <div className="flex gap-2">
                <button onClick={() => handleRejeitar(s)} className="flex-1 py-2 bg-red-50 text-red-600 rounded-xl text-[9px] font-bold uppercase">Recusar</button>
                <button onClick={() => handleAprovar(s)} className="flex-1 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-bold uppercase">Aprovar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {reciboPronto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-[#18181b] w-full max-w-2xl rounded-3xl p-12 shadow-2xl">
            <VoucherPreview dados={reciboPronto} />
            <div className="mt-12 flex gap-4 no-print">
              <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase">Imprimir</button>
              <button onClick={() => setReciboPronto(null)} className="flex-1 py-4 bg-[var(--bg-soft)] text-slate-600 rounded-2xl text-[11px] font-black uppercase">Fechar</button>
            </div>
          </div>
        </div>
      )}

      <HandoverModal isOpen={modalAssinatura} onClose={() => setModalAssinatura(false)} onConfirm={confirmarHandover} tipo="retirada" solicitante={nomeSolicitante} setor={setorSolicitante} itens={carrinho} loading={loading} />
    </div>
  );
}