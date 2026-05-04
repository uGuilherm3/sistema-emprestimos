import React, { useEffect } from 'react';
import ChamadosAdmin from '@shared/ChamadosAdmin';
import { useAuth } from './useAuth';

export default function App() {
  const { loading } = useAuth();

  useEffect(() => {
    const tema = localStorage.getItem('tema_tilend');
    if (tema === 'escuro') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    const onMessage = (e) => {
      if (e.data?.type !== 'TILEND_THEME') return;
      if (e.data.dark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      localStorage.setItem('tema_tilend', e.data.dark ? 'escuro' : 'claro');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (loading) return null;

  return (
    <div className="bg-[var(--bg-page)] h-screen overflow-hidden text-slate-900 dark:text-[#F8FAFC]">
      <ChamadosAdmin onOpenDetails={() => {}} />
    </div>
  );
}
