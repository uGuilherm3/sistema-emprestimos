import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import {
  Printer, Activity, HardDrive, Gauge,
  RefreshCw, MapPin, Cpu, Wifi, TrendingUp, BarChart3,
  AlertTriangle, XCircle, Zap
} from 'lucide-react';

const MOCK_PRINTERS = [
  { id: 1, nome: "OKI ALMOXARIFADO", status: "ONLINE", online: true, ip: "192.168.0.31", mac: "00:25:36:11:BD:5A", serial: "AK8A013355", modelo: "ES4172LP MFP", asset: "1308", localizacao: "SUBSOLO", uptime: "0 Dias / 8 Horas / 29 Minutos", impressoes: 153413, copias: 17096, scanner: 34474, total: 170929, hoje: 0, mes: 0, toner: 54 },
  { id: 2, nome: "OKIPROCURADORIA", status: "ONLINE", online: true, ip: "192.168.0.40", mac: "00:25:36:51:77:50", serial: "AK92025494", modelo: "ES5162LP MFP", asset: "1393", localizacao: "2 ANDAR", uptime: "2 Dias / 6 Horas / 0 Minutos", impressoes: 153512, copias: 14183, scanner: 22735, total: 184723, hoje: 0, mes: 0, toner: 92 },
  { id: 3, nome: "OKIPRESIDENCIA COLOR", status: "ONLINE", online: true, ip: "192.168.0.41", mac: "2C:FF:65:5C:F8:27", serial: "BX0A024337", modelo: "ES8473 MFP", asset: "2150", localizacao: "2 ANDAR", uptime: "1 Dias / 1 Horas / 33 Minutos", impressoes: 36502, copias: 2805, scanner: 24192, total: 46958, hoje: 2, mes: 2, toner: 88 },
  { id: 4, nome: "EPSONRH.OABCE", status: "ONLINE", online: true, ip: "10.10.20.5", mac: "38:1A:52:E8:B5:A9", serial: "X8GQ003421", modelo: "EPSON L5290 Series", asset: "None", localizacao: "RH", uptime: "2 Dias / 2 Horas / 46 Minutos", impressoes: 0, copias: 0, scanner: 0, total: 22551, hoje: 2, mes: 2, toner: 14 },
  { id: 5, nome: "EPSONIMPRENSA.OABCE", status: "ONLINE", online: true, ip: "10.10.20.7", mac: "38:1A:52:E8:B5:A8", serial: "X8GQ003422", modelo: "EPSON L5290 Series", asset: "None", localizacao: "IMPRENSA", uptime: "1 Dias / 4 Horas / 12 Minutos", impressoes: 0, copias: 0, scanner: 0, total: 15420, hoje: 1, mes: 5, toner: 45 },
  { id: 6, nome: "OKI CONSELHO", status: "OFFLINE", online: false, ip: "192.168.0.32", mac: "00:25:36:11:BD:5B", serial: "AK8A013356", modelo: "ES4172LP MFP", asset: "1310", localizacao: "CONSELHO", uptime: "OFFLINE", impressoes: 89000, copias: 5000, scanner: 12000, total: 94000, hoje: 0, mes: 0, toner: 0 },
  { id: 7, nome: "OKI CERIMONIAL", status: "ONLINE", online: true, ip: "192.168.0.33", mac: "00:25:36:11:BD:5C", serial: "AK8A013357", modelo: "ES4172LP MFP", asset: "1311", localizacao: "CERIMONIAL", uptime: "4 Dias", impressoes: 45000, copias: 1200, scanner: 8000, total: 53000, hoje: 12, mes: 450, toner: 78 },
  { id: 8, nome: "OKI FINANCEIRO", status: "ONLINE", online: true, ip: "192.168.0.34", mac: "00:25:36:11:BD:5D", serial: "AK8A013358", modelo: "ES4172LP MFP", asset: "1312", localizacao: "FINANCEIRO", uptime: "12 Dias", impressoes: 120000, copias: 25000, scanner: 15000, total: 145000, hoje: 85, mes: 2400, toner: 12 },
  { id: 9, nome: "EPSON GABINETE", status: "ONLINE", online: true, ip: "10.10.20.10", mac: "38:1A:52:E8:B5:B1", serial: "X8GQ003430", modelo: "L5290 Series", asset: "None", localizacao: "GABINETE", uptime: "1 Dia", impressoes: 0, copias: 0, scanner: 0, total: 1240, hoje: 4, mes: 120, toner: 89 },
  { id: 10, nome: "OKI PROTOCOLO", status: "ONLINE", online: true, ip: "192.168.0.35", mac: "00:25:36:11:BD:5E", serial: "AK8A013359", modelo: "ES4172LP MFP", asset: "1313", localizacao: "PROTOCOLO", uptime: "5 Horas", impressoes: 230000, copias: 15000, scanner: 45000, total: 275000, hoje: 150, mes: 5000, toner: 65 },
  { id: 11, nome: "OKI RH 2", status: "ONLINE", online: true, ip: "192.168.0.36", mac: "00:25:36:11:BD:5F", serial: "AK8A013360", modelo: "ES4172LP MFP", asset: "1314", localizacao: "RH", uptime: "2 Dias", impressoes: 56000, copias: 8000, scanner: 12000, total: 64000, hoje: 20, mes: 800, toner: 34 },
  { id: 12, nome: "EPSON TI", status: "ONLINE", online: true, ip: "10.10.20.12", mac: "38:1A:52:E8:B5:B2", serial: "X8GQ003431", modelo: "L5290 Series", asset: "None", localizacao: "TI", uptime: "45 Dias", impressoes: 0, copias: 0, scanner: 0, total: 850, hoje: 0, mes: 15, toner: 95 },
  { id: 13, nome: "OKI BIBLIOTECA", status: "OFFLINE", online: false, ip: "192.168.0.37", mac: "00:25:36:11:BD:60", serial: "AK8A013361", modelo: "ES4172LP MFP", asset: "1315", localizacao: "BIBLIOTECA", uptime: "OFFLINE", impressoes: 12000, copias: 200, scanner: 500, total: 12200, hoje: 0, mes: 0, toner: 0 },
  { id: 14, nome: "OKI AUDITORIO", status: "ONLINE", online: true, ip: "192.168.0.38", mac: "00:25:36:11:BD:61", serial: "AK8A013362", modelo: "ES4172LP MFP", asset: "1316", localizacao: "AUDITORIO", uptime: "1 Hora", impressoes: 5000, copias: 100, scanner: 200, total: 5100, hoje: 0, mes: 50, toner: 99 },
  { id: 15, nome: "EPSON COPA", status: "ONLINE", online: true, ip: "10.10.20.15", mac: "38:1A:52:E8:B5:B3", serial: "X8GQ003432", modelo: "L5290 Series", asset: "None", localizacao: "COPA", uptime: "2 Horas", impressoes: 0, copias: 0, scanner: 0, total: 150, hoje: 0, mes: 5, toner: 100 },
  { id: 16, nome: "OKI SALA 01", status: "ONLINE", online: true, ip: "192.168.0.39", mac: "00:25:36:11:BD:62", serial: "AK8A013363", modelo: "ES4172LP MFP", asset: "1317", localizacao: "SALA 01", uptime: "10 Dias", impressoes: 8900, copias: 1200, scanner: 3400, total: 12300, hoje: 5, mes: 180, toner: 56 }
];

export default function PrintersAdmin({ externalAba }) {
  const abaAtiva = externalAba || 'ativos';

  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [, setApiError] = useState(null);

  useEffect(() => { fetchPrinters(); }, []);

  const fetchPrinters = async () => {
    setRefreshing(true);
    try {
      const base = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${base}/api/printers-data`);
      if (!response.ok) throw new Error('Falha ao buscar dados reais');
      const data = await response.json();
      if (data && data.impressoras) {
        const rawPrinters = Object.values(data.impressoras);
        const mappedPrinters = rawPrinters.map((p, index) => ({
          id: p.ip || index,
          nome: p.nome || `Impressora ${index + 1}`,
          status: p.status || (p.online ? 'ONLINE' : 'OFFLINE'),
          online: p.online,
          ip: p.ip || '---',
          mac: p.mac || '---',
          serial: p.num_serie || '---',
          modelo: p.modelo || '---',
          asset: p.asset_number || '---',
          localizacao: p.location || 'Não informada',
          uptime: p.uptime || '---',
          impressoes: p.impressoes || 0,
          copias: p.copias || 0,
          scanner: p.scanner || 0,
          total: p.total_impressoes || 0,
          hoje: p.impressoes_dia || 0,
          mes: p.impressoes_mes || 0,
          toner: p.toner ? parseInt(p.toner.replace('%', '')) : 0
        }));
        setPrinters(mappedPrinters);
        setApiError(null);
      } else {
        throw new Error('Formato de dados inesperado');
      }
    } catch (e) {
      console.error('ERRO DE CONEXÃO COM O MONITOR:', e.message);
      setPrinters(MOCK_PRINTERS);
      setApiError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const isOnline = (p) => p.online || p.status === 'ONLINE';

  const stats = {
    total: printers.length,
    online: printers.filter(isOnline).length,
    offline: printers.filter(p => !isOnline(p)).length,
    totalHoje: printers.reduce((s, p) => s + (Number(p.hoje) || 0), 0),
    totalMes: printers.reduce((s, p) => s + (Number(p.mes) || 0), 0),
    isRealTime: printers[0] && printers[0].id !== 1
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-in fade-in duration-500">
        <div className="w-12 h-12 border-4 border-[var(--accent)]/10 border-t-[var(--accent)] rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-[0.3em]">Sincronizando Ativos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-in fade-in duration-700 h-full">
      {abaAtiva === 'dashboard' ? (
        <PrintersDashboard printers={printers} stats={stats} refreshing={refreshing} onRefresh={fetchPrinters} isOnline={isOnline} />
      ) : (
        <div className="pb-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 pt-4">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-widest mb-1">Total de Ativos</span>
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-light text-slate-900 dark:text-white leading-none">{stats.total}</span>
                  {!stats.isRealTime && (
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase rounded-md border border-amber-500/20">Simulado</span>
                  )}
                </div>
              </div>
              <div className="h-10 w-px bg-slate-200 dark:bg-white/10 hidden md:block"></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Disponíveis</span>
                <span className="text-4xl font-light text-emerald-500 leading-none">{stats.online}</span>
              </div>
              <div className="h-10 w-px bg-slate-200 dark:bg-white/10 hidden md:block"></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Interrompidos</span>
                <span className="text-4xl font-light text-rose-500 leading-none">{stats.offline}</span>
              </div>
            </div>
            <button onClick={fetchPrinters} disabled={refreshing}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-slate-200 dark:border-white/5 rounded-2xl text-xs font-bold text-slate-600 dark:text-[#A0A0A0] transition-all active:scale-95 disabled:opacity-50">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Sincronizando...' : 'Atualizar Status'}
            </button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
            {printers.map((printer) => (
              <PrinterCard key={printer.id} printer={printer} isOnline={isOnline(printer)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const CUSTO_POR_IMPRESSAO = 0.04;

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#18181b] border border-white/10 rounded-2xl px-4 py-3 shadow-xl text-left min-w-[160px]">
      <p className="text-[10px] font-black uppercase text-white mb-2">{d.nomeCompleto}</p>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-sm bg-[#254E70] shrink-0" />
        <span className="text-[10px] font-bold text-[#254E70]">Hoje: {d.hoje} · R$ {Number(d.custoHoje).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-sm bg-[#8D3046] shrink-0" />
        <span className="text-[10px] font-bold text-[#8D3046]">Mês: {d.mes} · R$ {Number(d.custoMes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
};

function PrintersDashboard({ printers, stats, refreshing, onRefresh, isOnline }) {
  const dadosGrafico = [...printers]
    .map(p => ({
      nome: p.nome.length > 11 ? p.nome.slice(0, 11) : p.nome,
      nomeCompleto: p.nome,
      hoje: Number(p.hoje) || 0,
      mes: Number(p.mes) || 0,
      custoHoje: ((Number(p.hoje) || 0) * CUSTO_POR_IMPRESSAO).toFixed(2),
      custoMes: ((Number(p.mes) || 0) * CUSTO_POR_IMPRESSAO).toFixed(2),
    }))
    .filter(p => p.hoje > 0 || p.mes > 0)
    .sort((a, b) => (b.hoje + b.mes) - (a.hoje + a.mes));

  const totalHoje = dadosGrafico.reduce((s, p) => s + p.hoje, 0);
  const totalMes = dadosGrafico.reduce((s, p) => s + p.mes, 0);
  const custoHoje = (totalHoje * CUSTO_POR_IMPRESSAO).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const custoMes = (totalMes * CUSTO_POR_IMPRESSAO).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const tonerOrdenado = [...printers].sort((a, b) => a.toner - b.toner);
  const topHoje = [...printers].filter(p => Number(p.hoje) > 0).sort((a, b) => b.hoje - a.hoje).slice(0, 6);
  const topMes = [...printers].filter(p => Number(p.mes) > 0).sort((a, b) => b.mes - a.mes).slice(0, 6);
  const alertas = printers.filter(p => (isOnline(p) && p.toner < 20) || !isOnline(p));
  const maxHoje = Math.max(...printers.map(p => Number(p.hoje) || 0), 1);
  const maxMes = Math.max(...printers.map(p => Number(p.mes) || 0), 1);

  return (
    <div className="pb-10 space-y-6 pt-4">

      {/* MÉTRICAS PRINCIPAIS */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-6 flex-wrap">
          <StatCard label="Total de Ativos" value={stats.total} color="slate" />
          <div className="h-10 w-px bg-slate-200 dark:bg-white/10 hidden md:block" />
          <StatCard label="Online" value={stats.online} color="emerald" />
          <div className="h-10 w-px bg-slate-200 dark:bg-white/10 hidden md:block" />
          <StatCard label="Offline" value={stats.offline} color="rose" />
          <div className="h-10 w-px bg-slate-200 dark:bg-white/10 hidden md:block" />
          <StatCard label="Impressões Hoje" value={stats.totalHoje.toLocaleString('pt-BR')} color="blue" />
          <div className="h-10 w-px bg-slate-200 dark:bg-white/10 hidden md:block" />
          <StatCard label="Impressões no Mês" value={stats.totalMes.toLocaleString('pt-BR')} color="violet" />
        </div>
        <button onClick={onRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-slate-200 dark:border-white/5 rounded-2xl text-xs font-bold text-slate-600 dark:text-[#A0A0A0] transition-all active:scale-95 disabled:opacity-50 shrink-0">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Sincronizando...' : 'Atualizar'}
        </button>
      </div>

      {/* ALERTAS */}
      {alertas.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-[2rem] border border-amber-500/20 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500"><AlertTriangle size={16} /></div>
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Atenção Necessária — {alertas.length} ativo(s)</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {alertas.map(p => (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border text-xs font-bold ${!isOnline(p) ? 'bg-rose-500/5 border-rose-500/20 text-rose-500' : 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
                {!isOnline(p) ? <XCircle size={13} /> : <Gauge size={13} />}
                <span className="uppercase">{p.nome}</span>
                <span className="text-[10px] opacity-70">{!isOnline(p) ? 'OFFLINE' : `${p.toner}%`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GRÁFICO DE IMPRESSÕES */}
      <div className="bg-[var(--bg-card)] rounded-[2rem] border border-slate-200 dark:border-white/5 p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-widest mb-2">Impressões por Impressora</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[9px] text-slate-400 dark:text-[#606060]">
                <span className="w-2 h-2 rounded-sm bg-[#254E70] inline-block" />
                Hoje: <span className="font-black text-slate-700 dark:text-slate-300 ml-0.5">{totalHoje}</span>
                <span className="text-emerald-500 font-bold ml-1">· R$ {custoHoje}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[9px] text-slate-400 dark:text-[#606060]">
                <span className="w-2 h-2 rounded-sm bg-[#8D3046] inline-block" />
                Mês: <span className="font-black text-slate-700 dark:text-slate-300 ml-0.5">{totalMes.toLocaleString('pt-BR')}</span>
                <span className="text-emerald-500 font-bold ml-1">· R$ {custoMes}</span>
              </span>
            </div>
          </div>
        </div>

        {dadosGrafico.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-[10px] font-black uppercase text-slate-400 dark:text-[#606060]">Nenhuma impressão registrada</p>
          </div>
        ) : (
          <div className="w-full" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGrafico} margin={{ top: 28, right: 16, left: 0, bottom: 24 }} barCategoryGap="35%" barGap={3}>
                <XAxis
                  dataKey="nome"
                  tick={{ fontSize: 9, fontWeight: 700, textAnchor: 'middle', fill: '#606060' }}
                  angle={0}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                  height={28}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="hoje" fill="#254E70" radius={[4, 4, 0, 0]} maxBarSize={14}>
                  <LabelList dataKey="hoje" position="top" style={{ fontSize: 8, fontWeight: 700, fill: '#254E70' }} />
                </Bar>
                <Bar dataKey="mes" fill="#8D3046" radius={[4, 4, 0, 0]} maxBarSize={14}>
                  <LabelList dataKey="mes" position="top" style={{ fontSize: 8, fontWeight: 700, fill: '#8D3046' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* TONER + ATIVIDADE */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* NÍVEL DE TONER */}
        <div className="bg-[var(--bg-card)] rounded-[2rem] border border-slate-200 dark:border-white/5 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-[var(--bg-soft)] rounded-xl text-slate-400"><Gauge size={16} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-widest">Nível de Toner</p>
              <p className="text-[9px] text-slate-400 dark:text-[#606060] mt-0.5">Ordenado do crítico ao cheio</p>
            </div>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
            {tonerOrdenado.map(p => {
              const cor = p.toner < 20 ? 'bg-rose-500' : p.toner < 50 ? 'bg-amber-400' : 'bg-emerald-500';
              const textCor = p.toner < 20 ? 'text-rose-500' : p.toner < 50 ? 'text-amber-500' : 'text-emerald-500';
              return (
                <div key={p.id} className={`${!isOnline(p) ? 'opacity-40' : ''}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase truncate max-w-[70%]">{p.nome}</span>
                    <span className={`text-[10px] font-black ${textCor} ${p.toner < 20 ? 'animate-pulse' : ''}`}>{isOnline(p) ? `${p.toner}%` : 'OFF'}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--bg-page)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${cor}`} style={{ width: `${p.toner}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MAIS ATIVAS */}
        <div className="bg-[var(--bg-card)] rounded-[2rem] border border-slate-200 dark:border-white/5 p-8 flex flex-col gap-6">

          {/* TOP HOJE */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-[var(--bg-soft)] rounded-xl text-slate-400"><Zap size={16} /></div>
              <p className="text-[10px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-widest">Mais Ativas — Hoje</p>
            </div>
            {topHoje.length === 0 ? (
              <p className="text-[10px] text-slate-400 dark:text-[#606060] uppercase">Nenhuma impressão registrada hoje</p>
            ) : (
              <div className="space-y-3">
                {topHoje.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-slate-300 dark:text-[#404040] w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 truncate">{p.nome}</span>
                        <span className="text-[10px] font-black text-slate-900 dark:text-white ml-3 shrink-0">{p.hoje}</span>
                      </div>
                      <div className="h-1 w-full bg-[var(--bg-page)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#254E70]" style={{ width: `${(p.hoje / maxHoje) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-200 dark:bg-white/5" />

          {/* TOP MÊS */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-[var(--bg-soft)] rounded-xl text-slate-400"><TrendingUp size={16} /></div>
              <p className="text-[10px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-widest">Mais Ativas — Este Mês</p>
            </div>
            {topMes.length === 0 ? (
              <p className="text-[10px] text-slate-400 dark:text-[#606060] uppercase">Nenhuma impressão registrada</p>
            ) : (
              <div className="space-y-3">
                {topMes.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-slate-300 dark:text-[#404040] w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 truncate">{p.nome}</span>
                        <span className="text-[10px] font-black text-slate-900 dark:text-white ml-3 shrink-0">{p.mes.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="h-1 w-full bg-[var(--bg-page)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#8D3046]/70" style={{ width: `${(p.mes / maxMes) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GRID DE STATUS */}
      <div className="bg-[var(--bg-card)] rounded-[2rem] border border-slate-200 dark:border-white/5 p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-[var(--bg-soft)] rounded-xl text-slate-400"><BarChart3 size={16} /></div>
          <p className="text-[10px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-widest">Visão Geral — Todos os Ativos</p>
          {!stats.isRealTime && <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase rounded-md border border-amber-500/20 ml-auto">Dados Simulados</span>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {printers.map(p => {
            const on = isOnline(p);
            return (
              <div key={p.id} className={`p-4 rounded-2xl border transition-all ${on ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20 opacity-60'}`}>
                <div className={`w-2 h-2 rounded-full mb-3 ${on ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <p className="text-[9px] font-black uppercase text-slate-700 dark:text-slate-300 leading-tight mb-1 truncate">{p.nome}</p>
                <p className="text-[8px] text-slate-400 dark:text-[#606060] uppercase truncate">{p.localizacao}</p>
                {on && (
                  <div className="mt-2 h-1 w-full bg-[var(--bg-page)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${p.toner < 20 ? 'bg-rose-500' : p.toner < 50 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${p.toner}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    slate: 'text-slate-900 dark:text-white',
    emerald: 'text-emerald-500',
    rose: 'text-rose-500',
    blue: 'text-[#254E70]',
    violet: 'text-violet-500',
  };
  const labelColors = {
    slate: 'text-slate-400 dark:text-[#606060]',
    emerald: 'text-emerald-500',
    rose: 'text-rose-500',
    blue: 'text-[#254E70]',
    violet: 'text-violet-500',
  };
  return (
    <div className="flex flex-col">
      <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${labelColors[color]}`}>{label}</span>
      <span className={`text-4xl font-light leading-none ${colors[color]}`}>{value}</span>
    </div>
  );
}

function PrinterCard({ printer, isOnline }) {
  return (
    <div className={`group relative bg-[var(--bg-card)] rounded-[2rem] border border-slate-200 dark:border-white/5 overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-black/5 dark:hover:shadow-black/20 flex flex-col ${!isOnline ? 'opacity-70 grayscale-[0.5]' : ''}`}>
      <div className="absolute top-6 right-6 z-10">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md ${isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          <span className="text-[9px] font-black uppercase tracking-widest">{printer.status}</span>
        </div>
      </div>
      <div className="p-8 flex flex-col flex-1">
        <div className="flex items-start gap-6 mb-8">
          <div className="w-20 h-20 bg-[var(--bg-page)] rounded-2xl flex items-center justify-center text-slate-400 dark:text-[#606060] shrink-0 border border-slate-200 dark:border-white/5 group-hover:scale-105 transition-transform duration-500">
            <Printer size={32} strokeWidth={1.5} />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate leading-tight mb-1 group-hover:text-[var(--accent)] transition-colors">{printer.nome}</h3>
            <div className="flex items-center gap-2 text-slate-500 dark:text-[#A0A0A0]">
              <MapPin size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider truncate">{printer.localizacao}</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-400 mt-2">{printer.modelo}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-8">
          <InfoRow label="IP Address" value={printer.ip} icon={Wifi} />
          <InfoRow label="Serial Number" value={printer.serial} icon={Cpu} />
          <InfoRow label="Asset ID" value={printer.asset} icon={HardDrive} />
          <InfoRow label="Uptime" value={printer.uptime} icon={Activity} isSmall />
        </div>
        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-white/5">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Gauge size={14} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-500 dark:text-[#606060] uppercase tracking-widest">Nível de Toner</span>
            </div>
            <span className={`text-[11px] font-black ${printer.toner < 20 ? 'text-rose-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>{printer.toner}%</span>
          </div>
          <div className="h-1.5 w-full bg-[var(--bg-page)] rounded-full overflow-hidden p-[1px]">
            <div className={`h-full rounded-full transition-all duration-1000 ease-out ${printer.toner < 20 ? 'bg-rose-500' : printer.toner < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${printer.toner}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-6">
          <MiniMetric label="Total" value={printer.total} />
          <MiniMetric label="Hoje" value={printer.hoje} highlight={printer.hoje > 0} />
          <MiniMetric label="Mês" value={printer.mes} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon: Icon, isSmall = false }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[9px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-widest mb-1">{label}</span>
      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
        <Icon size={12} className="shrink-0 text-slate-400" />
        <span className={`${isSmall ? 'text-[10px]' : 'text-[11px]'} font-bold truncate`}>{value}</span>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, highlight = false }) {
  return (
    <div className={`p-2 rounded-xl text-center border ${highlight ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-200 dark:border-white/5 bg-[var(--bg-page)]'}`}>
      <span className="block text-[8px] font-black text-slate-400 dark:text-[#606060] uppercase tracking-tighter mb-0.5">{label}</span>
      <span className={`text-[12px] font-black ${highlight ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>{value}</span>
    </div>
  );
}
