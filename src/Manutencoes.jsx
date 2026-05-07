// src/Manutencoes.jsx
import React from 'react';
import { Wrench } from 'lucide-react';

export default function Manutencoes() {
  return (
    <div className="h-full flex flex-col items-center justify-center animate-in fade-in duration-700 pb-20">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-[#254E70]/10 text-[#254E70] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-[#254E70]/5">
          <Wrench size={40} strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-2 uppercase">Gestão de Manutenções</h2>
        <p className="text-sm text-slate-500 dark:text-[#A0A0A0] font-medium leading-relaxed">
          O módulo de <span className="text-[#254E70] font-bold italic">controle preventivo e corretivo</span> está sendo preparado. 
          Em breve você poderá registrar e acompanhar o status de manutenção de todos os equipamentos por aqui.
        </p>
        <div className="mt-8 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-full inline-flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#254E70] animate-pulse"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#606060]">Em desenvolvimento</span>
        </div>
      </div>
    </div>
  );
}
