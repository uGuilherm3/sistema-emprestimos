import React, { useState } from 'react';
import { supabase } from './utils/supabaseClient';
import { Search, Edit2, Trash2, Package, X, CheckCircle2, AlertTriangle, Save, RotateCw, Loader2 } from 'lucide-react';
import { logAction } from './utils/log';

export default function GestaoEstoqueList({ itens, onItemEditadoOrExcluido, onRefresh }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  
  // Estados para o Modal de Edição
  const [itemEditando, setItemEditando] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [editModelo, setEditModelo] = useState('');
  const [editSerie, setEditSerie] = useState('');
  const [editQuantidade, setEditQuantidade] = useState(0);
  const [editBloqueado, setEditBloqueado] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });
  const [gruposExpandidos, setGruposExpandidos] = useState([]);

  const handleExcluir = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este ativo do sistema?')) return;
    try {
      const { data: item, error: fetchErr } = await supabase.from('item').select('*').eq('id', id).single();
      if (fetchErr) throw fetchErr;

      logAction('EXCLUIU ITEM', {
        item_nome: item.nome_equipamento,
        detalhes: 'Item apagado permanentemente do banco de dados.'
      });

      const { error: delErr } = await supabase.from('item').delete().eq('id', id);
      if (delErr) throw delErr;

      if (onItemEditadoOrExcluido) onItemEditadoOrExcluido();
    } catch (error) {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  const abrirEdicao = (item) => {
    setItemEditando(item);
    setEditNome(item.nome_equipamento || '');
    setEditModelo(item.modelo_detalhes || '');
    setEditSerie(item.numero_serie || '');
    setEditQuantidade(item.patrimonio_total || 0);
    setEditBloqueado(item.bloqueado_insumo || false);
    setMensagem({ texto: '', tipo: '' });
  };

  const fecharEdicao = () => {
    setItemEditando(null);
    setMensagem({ texto: '', tipo: '' });
  };

  const salvarEdicao = async (e) => {
    e.preventDefault();
    setLoadingEdit(true);
    setMensagem({ texto: '', tipo: '' });

    try {
      const qtdAntiga = itemEditando.patrimonio_total || 0;
      let finalNome = editNome.trim().toUpperCase();
      let finalModelo = editModelo.trim();
      let finalSerial = editSerie.trim();

      const novosDados = {
        nome_equipamento: finalNome,
        modelo_detalhes: finalModelo,
        numero_serie: finalSerial,
        quantidade: Number(editQuantidade),
        bloqueado_insumo: editBloqueado
      };

      const { error } = await supabase
        .from('item')
        .update(novosDados)
        .eq('id', itemEditando.id);
      
      if (error) throw error;

      let detalhesLog = qtdAntiga !== Number(editQuantidade) 
        ? `Alterou estoque físico de ${qtdAntiga} para ${editQuantidade}.`
        : `Alterou informações de cadastro.`;

      logAction('EDITOU ITEM', {
        item_nome: novosDados.nome_equipamento,
        detalhes: detalhesLog
      });

      setMensagem({ texto: 'Ativo atualizado com sucesso!', tipo: 'sucesso' });
      if (onItemEditadoOrExcluido) onItemEditadoOrExcluido();

      setTimeout(() => {
        fecharEdicao();
      }, 1500);
    } catch (error) {
      setMensagem({ texto: 'Erro: ' + error.message, tipo: 'erro' });
    } finally {
      setLoadingEdit(false);
    }
  };

  const itensFiltrados = itens.filter(i => {
    const termo = busca.toLowerCase();
    const nome = (i.nome_equipamento || '').toLowerCase();
    const mod = (i.modelo_detalhes || '').toLowerCase();
    const serie = (i.numero_serie || '').toLowerCase();
    return nome.includes(termo) || mod.includes(termo) || serie.includes(termo);
  });

  const grupos = {};
  itensFiltrados.forEach(item => {
    const chave = (item.nome_equipamento || '').trim().toUpperCase();
    if (!grupos[chave]) {
      grupos[chave] = {
        nome: item.nome_equipamento,
        itens: [],
        emUsoTotal: 0,
        fisicoTotal: 0,
        totalGeral: 0
      };
    }

    const total = Number(item.patrimonio_total) || 0;
    const disponivel = Number(item.quantidade_disponivel) || 0;
    const emUso = Math.max(0, total - disponivel);

    grupos[chave].itens.push({ 
      ...item, 
      emUso, 
      fisico: disponivel, 
      total, 
      bloqueado_insumo: item.bloqueado_insumo 
    });
    
    grupos[chave].emUsoTotal += emUso;
    grupos[chave].fisicoTotal += disponivel;
    grupos[chave].totalGeral += total;
  });

  const toggleGrupo = (chave) => {
    setGruposExpandidos(prev =>
      prev.includes(chave) ? prev.filter(c => c !== chave) : [...prev, chave]
    );
  };

  const inputClass = "w-full bg-transparent border-none text-slate-900 dark:text-white text-xs outline-none placeholder:text-slate-400 dark:placeholder:text-[#404040]";
  const labelClass = "block text-[10px] font-black uppercase text-slate-500 dark:text-[#606060] tracking-widest mb-2 ml-1";

  return (
    <div className="flex flex-col gap-6 relative h-full">
      <div className="bg-[var(--bg-card)] rounded-3xl shadow-sm border-none flex flex-col relative h-full">

        <div className="p-5 md:px-8 md:py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 bg-[var(--bg-page)]/50 dark:bg-transparent">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Inventário Global</h2>
            <p className="text-[10px] text-slate-500 dark:text-[#606060] font-black uppercase tracking-[0.2em] mt-1">
              Controle de Patrimônio ({itens.length})
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#606060]" size={16} />
              <input
                type="text"
                placeholder="BUSCAR NO ESTOQUE..."
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-page)] dark:bg-[var(--bg-card)]/5 border border-slate-200 dark:border-[#202020] rounded-xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-[#254E70]/20 transition-all outline-none"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <button onClick={onRefresh} className="p-3 text-slate-400 dark:text-[#606060] hover:text-[#254E70] hover:bg-[#254E70]/10 rounded-xl transition-all">
              <RotateCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pb-4">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-[var(--bg-page)]/90 backdrop-blur-xl">
              <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                <th className="pl-8 pr-5 py-4 max-w-[280px]">Equipamento</th>
                <th className="px-5 py-4">Identificação</th>
                <th className="px-4 py-4">Nº Série</th>
                <th className="px-4 py-4 text-center">Em Uso</th>
                <th className="px-4 py-4 text-center">Total</th>
                <th className="px-5 pr-8 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(grupos).length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center justify-center opacity-40">
                      <Package size={40} className="mb-4 text-slate-400 dark:text-[#606060]" strokeWidth={1} />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-[#606060]">Nenhum ativo encontrado</p>
                    </div>
                  </td>
                </tr>
              ) : (
                Object.keys(grupos).map(chave => {
                  const grupo = grupos[chave];
                  const isExpandido = gruposExpandidos.includes(chave);
                  const temVarios = grupo.itens.length > 1;
                  const modelos = [...new Set(grupo.itens.map(i => i.modelo_detalhes).filter(Boolean))];
                  const modeloDisplay = modelos.length === 1 ? modelos[0] : '-';

                  return (
                    <React.Fragment key={chave}>
                      <tr
                        onClick={() => temVarios && toggleGrupo(chave)}
                        className={`hover:bg-[var(--bg-page)] dark:hover:bg-[var(--bg-card)]/[0.02] transition-colors group ${temVarios ? 'cursor-pointer' : ''}`}
                      >
                        <td className="px-5 py-3 pl-8">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg bg-[var(--bg-soft)] text-slate-400 dark:text-[#606060] flex items-center justify-center shrink-0 transition-all ${isExpandido ? 'bg-[#254E70]/10 text-[#254E70]' : 'group-hover:text-[#254E70]'}`}>
                              {temVarios ? (isExpandido ? <X size={14} /> : <Package size={14} />) : <Package size={14} />}
                            </div>
                            <div className="flex flex-col max-w-[280px]">
                              <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2 truncate">
                                {grupo.nome} 
                                {temVarios && (
                                  <span className="bg-[#254E70]/5 text-[9px] px-1.5 py-0.5 rounded text-[#254E70] font-bold border border-[#254E70]/20 shrink-0">
                                    {grupo.itens.length} {grupo.itens.length === 1 ? 'REGISTRO' : 'REGISTROS'}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-[#A0A0A0] uppercase">{modeloDisplay}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-[#606060]">
                            {temVarios ? (isExpandido ? '↓ DETALHADO' : 'MÚLTIPLOS SERIAIS') : (grupo.itens[0]?.numero_serie || '-')}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-colors ${grupo.emUsoTotal > 0 ? 'bg-[#254E70]/10 text-[#254E70]' : 'text-slate-400'}`}>
                            {grupo.emUsoTotal} <span className="opacity-50">un</span>
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className="inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-[var(--bg-soft)] dark:bg-[var(--bg-card)]/5 text-slate-600 dark:text-[#A0A0A0]">
                            {grupo.totalGeral} <span className="opacity-50">un</span>
                          </span>
                        </td>

                        <td className="px-5 py-3 pr-8 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!temVarios && (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); abrirEdicao(grupo.itens[0]); }} className="p-2 text-slate-400 dark:text-[#606060] hover:text-[#254E70] hover:bg-[#254E70]/10 rounded-lg transition-all">
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleExcluir(grupo.itens[0].id); }} className="p-2 text-slate-400 dark:text-[#606060] hover:text-[#8D3046] hover:bg-[#8D3046]/10 rounded-lg transition-all">
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                            {temVarios && (
                              <div className="text-[9px] font-black text-[#254E70] uppercase pr-2">Clique p/ Detalhar</div>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpandido && grupo.itens.map((item, idx) => {
                        return (
                          <tr key={item.id} className="bg-[var(--bg-page)]/30 border-l-4 border-[#254E70] animate-in slide-in-from-left-2 duration-200">
                            <td className="px-5 py-2 pl-12">
                              <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#254E70]/40"></div>
                                <span className="text-[11px] font-bold text-slate-500 uppercase">Unidade #{idx + 1}</span>
                              </div>
                            </td>
                            <td className="px-5 py-2">
                              {item.modelo_detalhes && (
                                <span className="text-[10px] font-bold text-slate-500 dark:text-[#A0A0A0] uppercase">{item.modelo_detalhes}</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-black text-[#254E70] px-2 py-0.5 bg-[#254E70]/5 rounded">
                                  {item.numero_serie || 'S/ SERIAL'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-center text-[10px] font-black text-slate-400">{item.emUso} <span className="text-[8px] opacity-60">un</span></td>
                            <td className="px-4 py-2 text-center text-[10px] font-black text-slate-500">{item.total} <span className="text-[8px] opacity-60">un</span></td>
                            <td className="px-5 py-2 pr-8 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => abrirEdicao(item)} className="p-1.5 text-slate-400 hover:text-[#254E70] transition-all"><Edit2 size={12} /></button>
                                <button onClick={() => handleExcluir(item.id)} className="p-1.5 text-slate-400 hover:text-[#8D3046] transition-all"><Trash2 size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {itemEditando && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] w-full max-w-md rounded-[32px] shadow-2xl border border-slate-100 dark:border-[#202020] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 pt-8 pb-6 border-b border-slate-50 dark:border-[#181818]">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Editar Ativo</h3>
                <button onClick={fecharEdicao} className="p-2 hover:bg-slate-50 dark:hover:bg-[#181818] rounded-full transition-colors text-slate-400"><X size={20} /></button>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modificar informações no estoque</p>
            </div>

            <form onSubmit={salvarEdicao} className="p-8 space-y-6">
              {mensagem.texto && (
                <div className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-in slide-in-from-top-2 ${mensagem.tipo === 'sucesso' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                  {mensagem.tipo === 'sucesso' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  {mensagem.texto}
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-[#181818] p-4 rounded-2xl border border-slate-100 dark:border-[#202020] transition-all focus-within:ring-2 focus-within:ring-[#254E70]/10">
                  <label className={labelClass}>Nome do Equipamento</label>
                  <input type="text" className={inputClass} value={editNome} onChange={(e) => setEditNome(e.target.value)} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-[#181818] p-4 rounded-2xl border border-slate-100 dark:border-[#202020] transition-all focus-within:ring-2 focus-within:ring-[#254E70]/10">
                    <label className={labelClass}>Modelo / Detalhes</label>
                    <input type="text" className={inputClass} value={editModelo} onChange={(e) => setEditModelo(e.target.value)} />
                  </div>
                  <div className="bg-slate-50 dark:bg-[#181818] p-4 rounded-2xl border border-slate-100 dark:border-[#202020] transition-all focus-within:ring-2 focus-within:ring-[#254E70]/10">
                    <label className={labelClass}>Nº de Série</label>
                    <input type="text" className={inputClass} value={editSerie} onChange={(e) => setEditSerie(e.target.value)} />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#181818] p-4 rounded-2xl border border-slate-100 dark:border-[#202020] transition-all focus-within:ring-2 focus-within:ring-[#254E70]/10">
                  <label className={labelClass}>Quantidade Total (Estoque Físico)</label>
                  <input type="number" className={inputClass} value={editQuantidade} onChange={(e) => setEditQuantidade(Number(e.target.value))} required min="0" />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#181818] rounded-2xl border border-slate-100 dark:border-[#202020]">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Bloquear para Insumo</label>
                    <p className="text-[9px] text-slate-400 uppercase font-bold mt-0.5">Impede saída como consumível</p>
                  </div>
                  <button type="button" onClick={() => setEditBloqueado(!editBloqueado)} className={`w-12 h-6 rounded-full transition-all relative ${editBloqueado ? 'bg-[#254E70]' : 'bg-slate-200 dark:bg-[#252525]'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editBloqueado ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" disabled={loadingEdit} className="w-full bg-[#254E70] text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#1a3a54] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#254E70]/20 disabled:opacity-50">
                  {loadingEdit ? <><Loader2 size={16} className="animate-spin" /> SALVANDO...</> : <><Save size={16} /> SALVAR ALTERAÇÕES</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
