// src/RelatoriosExportacao.jsx
import React from 'react';
import { FileText } from 'lucide-react';

export default function RelatoriosExportacao() {
  return (
    <div className="h-full flex flex-col items-center justify-center animate-in fade-in duration-700 pb-20">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-[#8D3046]/10 text-[#8D3046] rounded-3xl flex items-center justify-center mx-auto mb-6">
          <FileText size={40} strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-2">Módulo de Inteligência</h2>
        <p className="text-sm text-slate-500 dark:text-[#A0A0A0] font-medium leading-relaxed">Esta funcionalidade está em <span className="text-[#254E70] font-bold">fase de testes</span> interna. Em breve você poderá gerar relatórios avançados e dashboards personalizados por aqui.</p>
      </div>
    </div>
  );
}
