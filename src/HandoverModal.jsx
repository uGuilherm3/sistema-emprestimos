import React, { useState, useEffect } from 'react';
import { X, User, ShieldCheck, PenLine, Info, CheckCircle2, Package, CalendarDays, BadgeCheck, ArrowUpRight } from 'lucide-react';

/**
 * HandoverModal
 * Props:
 *  - isOpen, onClose, onConfirm(nomeFinal, modoVerificacao)
 *  - tipo: 'retirada' | 'devolucao'
 *  - solicitante, setor, itens, loading
 *  - preAssinado: bool — true se colaborador já assinou via portal
 *  - detalhesAssinaturaPortal: string — texto da assinatura já feita
 */
const limparTextoAssinatura = (texto) => {
  if (!texto) return texto;
  // Remove segmentos "| IP: ..." e "| DISP: ..." gerados por código legado
  return texto.replace(/\s*\|\s*IP:\s*[\d.]+/gi, '').replace(/\s*\|\s*DISP:\s*[^|]*/gi, '').trim();
};

export default function HandoverModal({ isOpen, onClose, onConfirm, tipo, solicitante, setor, itens, loading, preAssinado, detalhesAssinaturaPortal }) {
  const [euMesmo, setEuMesmo] = useState(true);
  const [nomeTerceiro, setNomeTerceiro] = useState('');

  useEffect(() => {
    if (isOpen) { setEuMesmo(true); setNomeTerceiro(''); }
  }, [isOpen]);

  if (!isOpen) return null;

  const isRetirada = tipo === 'retirada';
  const corBase = isRetirada ? '#10B981' : '#8D3046';
  const agora = new Date();

  const handleAction = () => {
    if (preAssinado) {
      // Colaborador já assinou — agente só confirma, passa o solicitante como responsável
      onConfirm(solicitante, true);
      return;
    }
    const nomeFinal = euMesmo ? solicitante : nomeTerceiro.trim();
    if (!nomeFinal) {
      alert(`Informe o nome de quem está ${isRetirada ? 'retirando' : 'devolvendo'}.`);
      return;
    }
    onConfirm(nomeFinal, false);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 dark:bg-black/90 backdrop-blur-md animate-in fade-in overflow-hidden">
      <div className="relative bg-[var(--bg-card)] w-full max-w-xl max-h-[90vh] rounded-[2rem] flex flex-col p-6 md:p-8 animate-in zoom-in-95 duration-300 shadow-2xl overflow-y-auto custom-scrollbar">

        <button onClick={onClose} className="absolute top-4 right-4 p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all bg-[var(--bg-page)] rounded-xl shadow-sm z-50">
          <X size={18} />
        </button>

        {/* CABEÇALHO */}
        <div className="text-center pb-4 mb-4">
          <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#254E70] dark:text-[#38bdf8] mb-1">Termo de Responsabilidade Eletrônico</h4>
          <p className="text-3xl font-black text-slate-900 dark:text-white italic tracking-tighter">TI LEND.</p>
        </div>

        {/* ITENS */}
        <div className="space-y-3 mb-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
            Equipamentos em Processo de {isRetirada ? 'RETIRADA' : 'DEVOLUÇÃO'}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {itens?.map((item, idx) => {
              const obs = item.observacoes || '';
              const isGLPI = obs.includes('[GLPI]');
              let glpiNome = '';
              let glpiSN = '';

              if (isGLPI) {
                glpiNome = obs.match(/\[GLPI\] (.*?) \| SN:/)?.[1]?.trim() || 'Equipamento GLPI';
                glpiSN = obs.match(/SN: (.*?)($|\n|---)/)?.[1]?.trim() || '';
              }

              return (
                <div key={idx} className="flex justify-between items-center bg-[var(--bg-page)]/50 p-4 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-xl shrink-0">
                      <Package size={18} className="text-[#8D3046]" />
                    </div>
                    <div>
                      <span className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-tight">
                        {isGLPI ? glpiNome : (item.nome || item.item?.nome_equipamento || item.nome_equipamento || 'Item Desconhecido')}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                          {isGLPI ? 'Equipamento GLPI' : (item.modelo || item.item?.modelo_detalhes || 'Mod. N/I')}
                        </span>
                        {(glpiSN || item.numero_serie || item.item?.numero_serie) && (
                          <span className="text-[9px] font-mono font-bold text-[#8D3046] bg-[#8D3046]/5 px-2 py-0.5 rounded-md uppercase">
                            SN: {isGLPI ? glpiSN : (item.numero_serie || item.item?.numero_serie)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white text-xs px-3 py-1.5 bg-[var(--bg-card)] rounded-lg shadow-sm">
                    x{item.quantidade || item.quantidade_emprestada || 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SOLICITANTE */}
        <div className="grid grid-cols-2 gap-6 bg-[var(--bg-page)]/80 p-5 rounded-2xl mb-8">
          <div>
            <p className="text-slate-400 font-black uppercase tracking-widest mb-1 text-[9px]">Titular da Requisição</p>
            <p className="font-black text-slate-900 dark:text-white text-xs uppercase">{solicitante}</p>
          </div>
          <div>
            <p className="text-slate-400 font-black uppercase tracking-widest mb-1 text-[9px]">Setor / Área Unidade</p>
            <p className="font-black text-slate-900 dark:text-white text-xs uppercase">{setor || 'N/I'}</p>
          </div>
          <div className="col-span-2 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500">
              <CalendarDays size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest">
                {agora.toLocaleDateString('pt-BR')} às {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-emerald-500/80">
              <BadgeCheck size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest">Digital Auditável</span>
            </div>
          </div>
        </div>

        {/* SEÇÃO DE AÇÃO */}
        <div className="bg-slate-900 dark:bg-black rounded-3xl p-6 md:p-8 shadow-inner">

          {preAssinado ? (
            <>
              <div className={`flex items-start gap-3 mb-6 p-4 rounded-xl ${isRetirada ? 'bg-emerald-500/5' : 'bg-[#8D3046]/5'}`}>
                <BadgeCheck size={18} className={`shrink-0 mt-0.5 ${isRetirada ? 'text-emerald-500' : 'text-[#8D3046]'}`} />
                <div>
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isRetirada ? 'text-emerald-500' : 'text-[#8D3046]'}`}>Assinatura Digital</p>
                  <p className="text-[9px] font-bold uppercase leading-relaxed text-white/40">
                    {limparTextoAssinatura(detalhesAssinaturaPortal) || `TERMO ASSINADO POR ${solicitante?.toUpperCase()} VIA PORTAL`}
                  </p>
                </div>
              </div>

              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-5 text-center">
                Confirme a entrega/recebimento
              </p>

              <button
                onClick={handleAction}
                disabled={loading}
                className="w-full py-4 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 hover:opacity-90 active:scale-[0.98] disabled:opacity-30"
                style={{ backgroundColor: corBase }}
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><ArrowUpRight size={16} className={isRetirada ? '' : 'rotate-180'} /> Confirmar Transação</>
                }
              </button>
            </>
          ) : (
            <>
              <div className="mb-5 px-1">
                <h5 className="text-white font-black text-sm uppercase tracking-widest mb-1 flex items-center gap-2">
                  <PenLine size={16} className="text-emerald-500" /> Validação
                </h5>
                <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">
                  Responsável pela {isRetirada ? 'retirada' : 'devolução'}:
                </p>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-4 cursor-pointer bg-white/5 p-4 rounded-xl hover:bg-white/10 transition-all">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${euMesmo ? 'bg-emerald-500 border-emerald-500' : 'border-neutral-700'}`}>
                    {euMesmo && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <input type="checkbox" checked={euMesmo} onChange={e => { setEuMesmo(e.target.checked); if (e.target.checked) setNomeTerceiro(''); }} className="hidden" />
                  <span className="text-[11px] font-black text-white uppercase tracking-tight">O PRÓPRIO SOLICITANTE ({solicitante})</span>
                </label>

                {!euMesmo && (
                  <div className="animate-in fade-in slide-in-from-top-2 relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text" value={nomeTerceiro} onChange={e => setNomeTerceiro(e.target.value)}
                      placeholder="Nome Completo do Responsável"
                      className="w-full bg-white/5 focus:ring-2 focus:ring-emerald-500/30 text-white pl-11 pr-5 py-4 rounded-xl outline-none text-[10px] font-black uppercase tracking-widest placeholder:text-neutral-700"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-start gap-3 p-4 bg-emerald-500/5 rounded-xl mb-6">
                <Info size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-[8px] leading-relaxed text-emerald-500/60 font-bold uppercase tracking-widest">
                  Certifico que recebi/entreguei os itens acima citados e me responsabilizo pelo uso adequado dos mesmos.
                </p>
              </div>

              <button
                onClick={handleAction}
                disabled={loading || (!euMesmo && !nomeTerceiro.trim())}
                className="w-full py-4 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 hover:opacity-90 active:scale-[0.98] disabled:opacity-30"
                style={{ backgroundColor: corBase }}
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><PenLine size={16} /> Confirmar e Assinar</>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
