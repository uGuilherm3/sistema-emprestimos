import React, { useEffect } from 'react';
import EditarPerfil from '@shared/EditarPerfil';
import { useAuth, createUserMock } from './useAuth';
import { supabase } from '@shared/utils/supabaseClient';

export default function App() {
  const { user, loading } = useAuth();

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

  const handlePerfilAtualizado = async () => {
    const { data } = await supabase.from('perfil').select('*').eq('id', user.id).single();
    if (data) window.location.reload();
  };

  return (
    <div className="bg-[var(--bg-page)] min-h-screen text-slate-900 dark:text-[#F8FAFC] pt-4">
      <EditarPerfil usuarioAtual={user} onPerfilAtualizado={handlePerfilAtualizado} />
    </div>
  );
}
