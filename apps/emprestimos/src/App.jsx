import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase } from '@shared/utils/supabaseClient';
import DashboardEmprestimos from '@shared/DashboardEmprestimos';
import CadastroItem from '@shared/CadastroItem';
import GestaoEstoqueList from '@shared/GestaoEstoqueList';
import NovoEmprestimo from '@shared/NovoEmprestimo';
import ListaEmprestimosAtivos from '@shared/ListaEmprestimosAtivos';
import CalendarioAgendamentos from '@shared/CalendarioAgendamentos';
import { useAuth } from './useAuth';

export default function App() {
  const { user, loading } = useAuth();
  const [itens, setItens] = useState([]);
  const [trigger, setTrigger] = useState(0);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('tema_tilend') === 'escuro');

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'tema_tilend') setIsDark(e.newValue === 'escuro');
    };
    const onMessage = (e) => {
      if (e.data?.type === 'TILEND_THEME') setIsDark(e.data.dark);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('itens').select('*').then(({ data }) => {
      if (data) setItens(data);
    });
  }, [user, trigger]);

  if (loading || !user) return null;

  const refresh = () => setTrigger((t) => t + 1);

  return (
    <Routes>
      <Route
        path="/"
        element={<DashboardEmprestimos itens={itens} />}
      />
      <Route
        path="/estoque"
        element={
          <div className="h-screen grid grid-cols-1 xl:grid-cols-3 gap-8 p-4 items-stretch">
            <div className="xl:col-span-1">
              <CadastroItem onItemCadastrado={refresh} />
            </div>
            <div className="xl:col-span-2">
              <GestaoEstoqueList
                itens={itens}
                onItemEditadoOrExcluido={refresh}
                onRefresh={refresh}
              />
            </div>
          </div>
        }
      />
      <Route
        path="/saidas"
        element={
          <NovoEmprestimo
            itensDisponiveis={itens}
            usuarioAtual={user}
            onEmprestimoRealizado={refresh}
          />
        }
      />
      <Route
        path="/entradas"
        element={
          <ListaEmprestimosAtivos
            triggerAtualizacao={trigger}
            onDevolucao={refresh}
            onOpenDetails={() => {}}
          />
        }
      />
      <Route
        path="/calendario"
        element={
          <CalendarioAgendamentos
            itensDisponiveis={itens}
            onOpenDetails={() => {}}
          />
        }
      />
    </Routes>
  );
}
