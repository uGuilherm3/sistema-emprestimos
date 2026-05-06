import { CalendarDays, Package, User, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import LogoImg from './assets/logo.jpg';

export default function VoucherPreview({ dados, isPrintable = false }) {
  if (!dados) return null;

  // Helper para ler campos de objetos simples ou Parse-like
  const g = (field, fallback = null) => {
    if (dados.get && typeof dados.get === 'function') return dados.get(field) || fallback;
    return dados[field] || fallback;
  };

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

  const extraData = tryExtractFromText(g('observacoes') || g('descricao') || '');

  let solicitante = g('nome_solicitante') || g('solicitante') || g('nome') || 'N/I';
  if (solicitante.toUpperCase().includes('PROTOCOLO') && extraData.solicitante) {
    solicitante = extraData.solicitante;
  } else if (solicitante === 'N/I' && extraData.solicitante) {
    solicitante = extraData.solicitante;
  }

  const setor = extraData.setor || g('setor_solicitante') || g('setor') || 'N/I';
  const data = g('data_reserva') || g('data') || g('created_at');

  const tecnico_saida = g('nome_tecnico_saida') || g('tecnico_saida') || extraData.tecnico || 'PENDENTE';
  const quem_vai_buscar = g('quem_vai_buscar') || solicitante;

  const assinatura_eletronica = g('assinatura_eletronica');
  const detalhes_assinatura = g('detalhes_assinatura');

  const status_emprestimo = g('status_emprestimo');
  const data_hora_retorno = g('data_hora_retorno');
  const tecnico_retorno = g('nome_tecnico_retorno') || g('tecnico_retorno') || '-';

  const assinatura_dev_eletronica = g('assinatura_dev_eletronica');
  const detalhes_assinatura_dev = g('detalhes_assinatura_dev');
  const quem_vai_entregar = g('quem_vai_entregar') || solicitante;

  const rawItens = g('itens');
  const itens = (rawItens && rawItens.length > 0) ? rawItens : [dados];

  const formatarDataSegura = (d) => {
    if (!d) return 'Pendente';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return 'Não registrada';
    return dateObj.toLocaleDateString('pt-BR') + ' às ' + dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`voucher-container bg-white dark:bg-white text-black pt-8 pb-4 relative overflow-hidden min-h-full flex flex-col flex-1 ${isPrintable ? 'print:shadow-none print:m-0 print:w-full print:max-w-none' : 'shadow-2xl rounded-[2rem]'}`}>
      {/* BRANDING COMPACTO */}
      <div className="text-center pb-4 mb-2 border-b border-slate-100 flex flex-col items-center shrink-0 px-6 md:px-8">
        <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2 relative w-full">
          Documento de Controle de Ativos
        </h4>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-sm overflow-hidden">
            <img src={LogoImg} className="w-full h-full object-cover" alt="Logo" />
          </div>
          <p className="text-xl font-black text-slate-900 italic tracking-tighter">TI LEND.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar-thin px-6 md:px-8 py-2 space-y-4 relative z-10">
        {/* INFO GRIDS COMPACTOS */}
        <div className="grid grid-cols-2 gap-4 bg-stone-50 p-5 rounded-[1.25rem]">
          <div>
            <p className="text-slate-500 font-bold uppercase tracking-widest mb-1 text-[8px]">Solicitante</p>
            <p className="font-bold text-slate-900 text-xs">{solicitante}</p>
          </div>
          <div>
            <p className="text-slate-500 font-bold uppercase tracking-widest mb-1 text-[8px]">Setor / Área</p>
            <p className="font-bold text-slate-900 text-xs">{setor || 'N/I'} <span className="ml-1 text-[8px] bg-slate-200 print:bg-slate-300 text-slate-600 px-1.5 py-0.5 rounded-sm">{g('status_emprestimo') === 'Consumido' || (dados.protocolo && dados.protocolo.endsWith('IS')) ? 'INSUMO' : 'ATIVO'}</span></p>
          </div>

          <div className="col-span-2 pt-3 mt-1 flex justify-between gap-4 border-t border-stone-200/50">
            {g('status_emprestimo') === 'Consumido' || (dados.protocolo && dados.protocolo.endsWith('IS')) ? (
              <>
                <div>
                  <p className="text-slate-500 print:text-slate-700 font-bold uppercase tracking-widest mb-1 flex items-center gap-1 text-[8px]"><CalendarDays size={12} /> Data do Fornecimento</p>
                  <p className="text-slate-900 print:text-black font-black text-sm">{formatarDataSegura(data)}</p>
                  <p className="text-slate-400 print:text-slate-600 font-bold uppercase tracking-widest mt-2 text-[7px]">Técnico Responsável</p>
                  <p className="font-bold text-slate-800 print:text-black text-[10px] capitalize">{tecnico_saida || 'Aguardando...'}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-[#8D3046]/10 text-[#8D3046] px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest">
                    Fornecimento Sem Retorno (Insumo)
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* BLOCO SAÍDA */}
                <div>
                  <p className="text-slate-500 print:text-slate-700 font-bold uppercase tracking-widest mb-1 flex items-center gap-1 text-[8px]"><CalendarDays size={12} /> Saída Oficial</p>
                  <p className="text-slate-900 print:text-black font-black text-sm">{formatarDataSegura(data)}</p>
                  <p className="text-slate-400 print:text-slate-600 font-bold uppercase tracking-widest mt-2 text-[7px]">Técnico (Saída)</p>
                  <p className="font-bold text-slate-800 print:text-black text-[10px] capitalize">{tecnico_saida || 'Aguardando...'}</p>
                </div>

                {/* BLOCO ENTRADA (VISÍVEL SE DEVOLVIDO) */}
                <div className={`text-right ${status_emprestimo === 'Aberto' ? 'opacity-20 print:opacity-50' : ''}`}>
                  <p className="text-slate-500 print:text-slate-700 font-bold uppercase tracking-widest mb-1 flex items-center justify-end gap-1 text-[8px]">Entrada Oficial <CheckCircle2 size={12} /></p>
                  <p className="text-slate-900 print:text-black font-black text-sm">{formatarDataSegura(data_hora_retorno)}</p>
                  <p className="text-slate-400 print:text-slate-600 font-bold uppercase tracking-widest mt-2 text-[7px]">Técnico (Retorno)</p>
                  <p className="font-bold text-slate-800 print:text-black text-[10px] capitalize">{tecnico_retorno || '-'}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ITEMS LIST - ULTRA COMPACTO E MONOCROMÁTICO */}
        <div className="bg-white rounded-[1rem] overflow-hidden border border-stone-100 print:border-stone-300">
          <div className="px-4 py-2 border-b border-stone-100 bg-stone-50/50 print:bg-stone-100">
            <h4 className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-900 print:text-black">Itens do Empréstimo</h4>
          </div>
          <div className="divide-y divide-stone-100 print:divide-stone-200">
            {itens.map((item, idx) => {
              const obs = item.get ? (item.get('observacoes') || '') : (item.observacoes || '');
              const glpiInfo = obs.includes('[GLPI]') ? (() => {
                const matchNome = obs.match(/\[GLPI\] (.*?) \| SN:/);
                const matchSerial = obs.match(/SN: (.*?)($|\n|---)/);
                return {
                  nome: matchNome ? matchNome[1].trim() : null,
                  serial: matchSerial ? matchSerial[1].trim() : null
                };
              })() : null;

              const displayNome = (item.nome || item.get?.('item')?.get?.('nome_equipamento') || item.get?.('nome_equipamento') || glpiInfo?.nome) || 'N/I';
              const displayModelo = (item.modelo || item.get?.('item')?.get?.('modelo_detalhes') || item.get?.('modelo_detalhes') || (glpiInfo ? 'GLPI Asset' : null)) || 'Sem detalhes';
              const displaySerial = (item.numero_serie || item.get?.('item')?.get?.('numero_serie') || item.get?.('numero_serie') || glpiInfo?.serial);

              return (
                <div key={idx} className="flex justify-between items-center p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-stone-50 border border-stone-100 print:border-stone-300 flex items-center justify-center text-slate-600 shrink-0">
                      <Package size={12} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 print:text-black text-[11px] uppercase tracking-tight leading-none">{displayNome}</p>
                      <div className="flex flex-col gap-0.5 mt-1">
                        <p className="text-[8px] font-medium text-slate-600 print:text-slate-800">{displayModelo}</p>
                        {displaySerial && (
                          <p className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50 print:bg-slate-100 px-1.5 py-0.5 rounded-md inline-block">
                            SN: {displaySerial}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 border border-slate-200 print:border-slate-400 text-slate-900 print:text-black font-black text-[9px] rounded-md">
                    x{item.quantidade || item.get?.('quantidade_emprestada') || 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ASSINATURAS LADO A LADO */}
        {g('status_emprestimo') === 'Consumido' || (dados.protocolo && dados.protocolo.endsWith('IS')) ? (
          <div className="pt-8 space-y-8 max-w-3xl mx-auto">
            <div className="text-[12px] text-justify text-slate-800 print:text-black leading-relaxed font-medium pb-4 border-b border-stone-200">
              <p className="font-black uppercase mb-3 text-sm text-center text-slate-900 print:text-black tracking-widest">Termo de Responsabilidade e Consumo</p>
              Declaramos para os devidos fins que o(s) item(ns) acima listado(s) foi(ram) fornecido(s) em caráter definitivo ao solicitante <strong>{solicitante}</strong>, sob supervisão e entrega do técnico <strong>{tecnico_saida}</strong> na presente data e horário ({formatarDataSegura(data)}). O recebedor ou portador autorizado (<strong>{quem_vai_buscar}</strong>) atesta o recebimento dos materiais em perfeitas condições. A partir deste ato, o uso, guarda e gestão dos materiais descritos passam a ser de inteira responsabilidade do solicitante ou de sua respectiva área de atuação, isentando a equipe de Tecnologia da Informação de devoluções destes itens.
            </div>
            {/* ASSINATURA RETIRADA CENTRADA */}
            <div className="flex flex-col items-center justify-end text-center max-w-sm mx-auto pt-2">
              {assinatura_eletronica ? (
                <div className="animate-in fade-in zoom-in duration-500">
                  <div className="flex items-center justify-center gap-2 text-emerald-600 mb-3 print:bg-transparent print:border-none bg-emerald-50 px-5 py-2.5 rounded-xl border border-emerald-100">
                    <ShieldCheck size={18} />
                    <span className="font-black tracking-[0.2em] uppercase text-[10px]">Fornecimento Eletrônico Validado</span>
                  </div>
                  <p className="text-[9px] text-slate-500 uppercase font-bold leading-relaxed">{detalhes_assinatura}</p>
                </div>
              ) : (
                <div className="w-full mt-8">
                  <div className="w-full h-[1px] bg-slate-300 print:bg-slate-400 mb-4"></div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Assinatura do Recebedor Confirmada</p>
                  <p className="text-[10px] text-slate-800 print:text-black mt-1 uppercase font-bold">{quem_vai_buscar || solicitante}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-8 pt-6">
            {/* ASSINATURA RETIRADA */}
            <div className="flex flex-col items-center justify-end text-center">
              {assinatura_eletronica ? (
                <div className="animate-in fade-in zoom-in duration-500">
                  <div className="flex items-center gap-2 text-emerald-600 mb-3 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                    <ShieldCheck size={16} />
                    <span className="font-black tracking-widest uppercase text-[8px]">Retirada Validada</span>
                  </div>
                  <p className="text-[8px] text-slate-500 uppercase font-bold leading-tight max-w-[150px]">{detalhes_assinatura}</p>
                </div>
              ) : (
                <div className="w-full">
                  <div className="w-full h-[1px] bg-slate-200 mb-3"></div>
                  <p className="text-[8px] text-slate-400 uppercase tracking-widest font-black">Assinatura de Retirada</p>
                  <p className="text-[8px] text-slate-300 mt-1 uppercase font-bold">{quem_vai_buscar || solicitante}</p>
                </div>
              )}
            </div>

            {/* ASSINATURA DEVOLUÇÃO */}
            <div className="flex flex-col items-center justify-end text-center">
              {assinatura_dev_eletronica ? (
                <div className="animate-in fade-in zoom-in duration-500">
                  <div className="flex items-center gap-2 text-[#254E70] mb-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                    <ShieldCheck size={16} />
                    <span className="font-black tracking-widest uppercase text-[8px]">Entrada Validada</span>
                  </div>
                  <p className="text-[8px] text-slate-500 uppercase font-bold leading-tight max-w-[150px]">{detalhes_assinatura_dev}</p>
                </div>
              ) : (
                <div className="w-full">
                  <div className="w-full h-[1px] bg-slate-200 mb-3"></div>
                  <p className="text-[8px] text-slate-400 uppercase tracking-widest font-black">Assinatura de Devolução</p>
                  <p className="text-[8px] text-slate-300 mt-1 uppercase font-bold">{quem_vai_entregar || solicitante}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* WATERMARK OR DECORATION */}
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <Package size={120} className="rotate-12" />
      </div>
    </div>
  );
}
