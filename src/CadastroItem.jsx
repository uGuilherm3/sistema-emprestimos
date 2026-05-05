// src/CadastroItem.jsx
import React, { useState } from 'react';
import { api } from './utils/apiClient';
import { PackagePlus, Tag, Hash, Box, CheckCircle2, ShieldAlert } from 'lucide-react';
import { logAction } from './utils/log';

export default function CadastroItem({ onItemCadastrado }) {
  const [nomeEquipamento, setNomeEquipamento] = useState('');
  const [modeloDetalhes, setModeloDetalhes] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [bloqueadoInsumo, setBloqueadoInsumo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });

  const handleCadastro = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMensagem({ texto: '', tipo: '' });

    try {
      let finalNome = nomeEquipamento.trim().toUpperCase();
      let finalModelo = modeloDetalhes.trim();
      let finalSerial = numeroSerie.trim();

      // 🧠 Normalização Automática de Memórias RAM (Solicitação do Usuário)
      if (finalNome.includes('MEMÓRIA') || finalNome.includes('MEMORIA') || finalNome.includes('RAM ')) {
        const ddrMatch = finalNome.match(/DDR\d/i);
        const ddr = ddrMatch ? ddrMatch[0].toUpperCase() : '';
        const gbMatch = finalNome.match(/\d+GB/i);
        const gb = gbMatch ? gbMatch[0].toUpperCase() : '';
        const specs = [ddr, gb].filter(Boolean).join(' ');

        if (finalModelo && !finalSerial) finalSerial = finalModelo;
        else if (finalModelo && finalSerial && finalModelo !== finalSerial) finalSerial = `${finalSerial} | ${finalModelo}`;
        finalNome = 'MEMÓRIA RAM';
        finalModelo = specs || 'COMPONENTE';
      }

      const dataToInsert = {
        id: crypto.randomUUID(),
        nome_equipamento: finalNome,
        modelo_detalhes: finalModelo,
        numero_serie: finalSerial,
        quantidade: Number(quantidade),
        bloqueado_insumo: bloqueadoInsumo
      };

      const { error } = await api.items.insert(dataToInsert);
      if (error) throw new Error(error);

      logAction('CRIOU ITEM', {
        item_nome: nomeEquipamento.trim().toUpperCase(),
        quantidade: quantidade,
        modelo: modeloDetalhes
      });

      setMensagem({ texto: 'Ativo cadastrado com sucesso!', tipo: 'sucesso' });

      setNomeEquipamento('');
      setModeloDetalhes('');
      setNumeroSerie('');
      setQuantidade(1);
      setBloqueadoInsumo(false);

      if (onItemCadastrado) onItemCadastrado();
      setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3000);
    } catch (error) {
      setMensagem({ texto: 'Erro ao salvar: ' + error.message, tipo: 'erro' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full bg-[var(--bg-card)] rounded-3xl shadow-sm transition-all duration-300 relative overflow-hidden flex flex-col h-full">
      {loading && <div className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-[#254E70] to-[#254E70] animate-pulse w-full shadow-[0_0_10px_#254E70]"></div>}

      <div className="p-6 md:p-8 shrink-0 bg-[var(--bg-page)]/50 dark:bg-transparent">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[var(--bg-soft)]  rounded-2xl text-[#254E70] shadow-sm dark:shadow-inner shrink-0">
            <PackagePlus size={24} strokeWidth={1.5} />
          </div>
          <div className="overflow-hidden">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">Novo Ativo</h2>
            <p className="text-[10px] text-slate-500 dark:text-[#606060] font-black uppercase tracking-[0.2em] mt-1 truncate">Entrada no Estoque</p>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
        {mensagem.texto && (
          <div className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-bold mb-8 shadow-sm ${mensagem.tipo === 'sucesso' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>
            {mensagem.tipo === 'sucesso' ? <CheckCircle2 size={16} className="shrink-0" /> : <ShieldAlert size={16} className="shrink-0" />}
            <span className="leading-tight">{mensagem.texto}</span>
          </div>
        )}

        <form onSubmit={handleCadastro} className="flex-1 flex flex-col space-y-6">
          <div className="w-full">
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-[#606060] tracking-widest mb-2 ml-1">Equipamento / Categoria</label>
            <div className="flex items-center gap-3 bg-[var(--bg-page)] rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#254E70]/50 transition-all shadow-sm">
              <Tag size={16} className="text-slate-400 dark:text-[#606060] shrink-0" />
              <input type="text" value={nomeEquipamento} onChange={(e) => setNomeEquipamento(e.target.value)} required placeholder="Ex: NOTEBOOK DELL" className="w-full bg-transparent border-none text-slate-900 dark:text-white text-xs outline-none placeholder:text-slate-400 dark:placeholder:text-[#404040] font-bold" />
            </div>
          </div>

          <div className="w-full">
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-[#606060] tracking-widest mb-2 ml-1">Modelo e Detalhes</label>
            <div className="flex items-center gap-3 bg-[var(--bg-page)] rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#254E70]/50 focus-within:border-[#254E70] transition-all shadow-sm">
              <Box size={16} className="text-slate-400 dark:text-[#606060] shrink-0" />
              <input type="text" value={modeloDetalhes} onChange={(e) => setModeloDetalhes(e.target.value)} placeholder="Ex: Inspiron 15 3000..." className="w-full bg-transparent border-none text-slate-900 dark:text-white text-xs outline-none placeholder:text-slate-400 dark:placeholder:text-[#404040]" />
            </div>
          </div>

          <div className="w-full">
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-[#606060] tracking-widest mb-2 ml-1">Nº de Série / Patrimônio</label>
            <div className="flex items-center gap-3 bg-[var(--bg-page)] rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#254E70]/50 transition-all shadow-sm">
              <Hash size={16} className="text-slate-400 dark:text-[#606060] shrink-0" />
              <input type="text" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} placeholder="Opcional" className="w-full bg-transparent border-none text-slate-900 dark:text-white text-xs outline-none placeholder:text-slate-400 dark:placeholder:text-[#404040]" />
            </div>
          </div>

          <div className="w-full">
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-[#606060] tracking-widest mb-2 ml-1">Quantidade Inicial</label>
            <div className="flex items-center gap-3 bg-[var(--bg-page)] rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#254E70]/50 transition-all shadow-sm">
              <PackagePlus size={16} className="text-slate-400 dark:text-[#606060] shrink-0" />
              <input type="number" min="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required className="w-full bg-transparent border-none text-slate-900 dark:text-white text-xs outline-none font-bold" />
            </div>
          </div>

          <div className="w-full">
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-[#606060] tracking-widest mb-2 ml-1">Configurações de Saída</label>
            <div
              onClick={() => setBloqueadoInsumo(!bloqueadoInsumo)}
              className="flex items-center justify-between bg-[var(--bg-page)] rounded-2xl px-4 py-3 cursor-pointer hover:bg-white/5 transition-all shadow-sm group"
            >
              <div className="flex items-center gap-3">
                <Box size={16} className={`${bloqueadoInsumo ? 'text-[#8D3046]' : 'text-slate-400 dark:text-[#606060]'} transition-colors`} />
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">Bloquear para Insumo</span>
              </div>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 ${bloqueadoInsumo ? 'bg-[#8D3046]' : 'bg-slate-300 dark:bg-[#404040]'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 transform ${bloqueadoInsumo ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>
            <p className="text-[9px] text-slate-500 dark:text-[#505050] font-medium mt-2 px-1">Impede a saída deste item como consumível.</p>
          </div>

          <div className="pt-6 mt-auto">
            <button type="submit" disabled={loading} className="w-full py-4 bg-[var(--accent)] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:opacity-90 hover:-translate-y-1 transition-all shadow-lg shadow-[var(--accent)]/10 disabled:opacity-50 disabled:hover:translate-y-0 active:scale-[0.98]">
              {loading ? 'Processando...' : 'Adicionar ao Inventário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
