// src/DashboardEmprestimos.jsx
import React, { useState, useEffect } from 'react';
import { api } from './utils/apiClient';
import { Package, ArrowUpRight, ArrowDownLeft, Calendar } from 'lucide-react';

export default function DashboardEmprestimos({ itens }) {
  const [stats, setStats] = useState({ emprestimosAtivos: 0, reservasFuturas: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [{ data: empAbertos }, { data: empAprovados }] = await Promise.all([
        api.emprestimos.list({ status: 'Aberto', limit: 1 }),
        api.emprestimos.list({ status: 'Aprovado', limit: 1 })
      ]);
      // A API retorna o array; usamos length como proxy do count
      // Para contagem exata o backend pode retornar um header X-Total — aqui usamos o data.length
      // Se a rota suportar ?count=true, adapte aqui. Por ora buscamos com limit alto:
      const [{ data: empAbertosAll }, { data: empAprovadosAll }] = await Promise.all([
        api.emprestimos.list({ status: 'Aberto', limit: 9999 }),
        api.emprestimos.list({ status: 'Aprovado', limit: 9999 })
      ]);
      setStats({ emprestimosAtivos: (empAbertosAll || []).length, reservasFuturas: (empAprovadosAll || []).length });
    };
    fetchStats();
  }, []);

  const totalAtivos = itens.reduce((s, i) => s + (Number(i.patrimonio_total) || 0), 0);
  const totalEmUso = itens.reduce((s, i) => {
    const total = Number(i.patrimonio_total) || 0;
    const disp = Number(i.quantidade_disponivel) || 0;
    return s + Math.max(0, total - disp);
  }, 0);
  const totalDisp = itens.reduce((s, i) => s + (Number(i.quantidade_disponivel) || 0), 0);
  const tiposUnicos = new Set(itens.map(i => (i.nome_equipamento || '').trim().toUpperCase())).size;

  const porTipo = {};
  itens.forEach(item => {
    const nome = (item.nome_equipamento || 'Sem nome').trim().toUpperCase();
    if (!porTipo[nome]) porTipo[nome] = { total: 0, emUso: 0, disp: 0 };
    const total = Number(item.patrimonio_total) || 0;
    const disp = Number(item.quantidade_disponivel) || 0;
    porTipo[nome].total += total;
    porTipo[nome].emUso += Math.max(0, total - disp);
    porTipo[nome].disp += disp;
  });
  const ranking = Object.entries(porTipo).sort((a, b) => b[1].total - a[1].total);

  const cards = [
    { label: 'Ativos Cadastrados', value: totalAtivos, icon: Package, color: '#254E70', sub: `${tiposUnicos} categoria${tiposUnicos !== 1 ? 's' : ''}` },
    { label: 'Em Uso', value: totalEmUso, icon: ArrowUpRight, color: '#8D3046', sub: `${stats.emprestimosAtivos} empréstimo${stats.emprestimosAtivos !== 1 ? 's' : ''} aberto${stats.emprestimosAtivos !== 1 ? 's' : ''}` },
    { label: 'Disponíveis', value: totalDisp, icon: ArrowDownLeft, color: '#10B981', sub: 'Prontos para empréstimo' },
    { label: 'Agendamentos', value: stats.reservasFuturas, icon: Calendar, color: '#7C3AED', sub: 'Reservas aprovadas' },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-[var(--bg-card)] rounded-2xl p-5 border border-slate-100 dark:border-[#1e1e1e]">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: card.color + '18', color: card.color }}>
                <Icon size={16} />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{card.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-[#606060] mt-1">{card.label}</p>
              <p className="text-[10px] text-slate-400 dark:text-[#505050] mt-1">{card.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-[var(--bg-card)] rounded-2xl border border-slate-100 dark:border-[#1e1e1e] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 dark:border-[#181818]">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Estoque por Categoria</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-[#505050] bg-[var(--bg-page)]/50">
              <th className="px-6 py-3 text-left">Equipamento</th>
              <th className="px-4 py-3 text-center">Total</th>
              <th className="px-4 py-3 text-center">Em Uso</th>
              <th className="px-4 py-3 text-center">Disponível</th>
              <th className="px-6 py-3 text-right">Ocupação</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map(([nome, data]) => {
              const pct = data.total > 0 ? Math.round((data.emUso / data.total) * 100) : 0;
              return (
                <tr key={nome} className="border-t border-slate-50 dark:border-[#181818] hover:bg-[var(--bg-soft)] transition-colors">
                  <td className="px-6 py-3.5">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0A0A0] uppercase">{nome}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-[11px] font-black text-slate-600 dark:text-[#808080]">{data.total}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-[11px] font-black ${data.emUso > 0 ? 'text-[#8D3046]' : 'text-slate-300 dark:text-[#404040]'}`}>{data.emUso}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-[11px] font-black ${data.disp > 0 ? 'text-[#10B981]' : 'text-slate-300 dark:text-[#404040]'}`}>{data.disp}</span>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 dark:bg-[#202020] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? '#8D3046' : '#254E70' }} />
                      </div>
                      <span className="text-[10px] font-black text-slate-500 dark:text-[#606060] w-8 text-right">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
