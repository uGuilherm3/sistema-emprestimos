// src/utils/glpiClient.js

const GLPI_URL = import.meta.env.VITE_GLPI_URL || 'https://chamados.oabce.org.br/apirest.php';
const APP_TOKEN = import.meta.env.VITE_GLPI_APP_TOKEN || '7uq6DCSHn6hAPfGrquvoHcuMgCjX5Pff5zLeS1ON';
const USER_TOKEN = import.meta.env.VITE_GLPI_USER_TOKEN || 'IJz6r1DV1LFVJT2hFvPZtHaVxjtIT3eC1YSMXQen';

// IDs Fixos do GLPI
const GLPI_CONFIG = {
  CATEGORY_ID: 165,         // Categoria correta de empréstimos
  DEFAULT_LOCATION_ID: 284, // ID da OAB SEDE (Usado apenas como Plano B)
  GROUP_OBSERVER_ID: 1,
  USER_ASSIGNED_ID: 481
};

/**
 * Inicia uma sessão no GLPI e retorna o session_token.
 */
async function initSession(credentials = null) {
  const headers = { 'App-Token': APP_TOKEN };
  
  if (credentials) {
    const { username, password } = credentials;
    const auth = btoa(`${username}:${password}`);
    headers['Authorization'] = `Basic ${auth}`;
  } else {
    headers['Authorization'] = `user_token ${USER_TOKEN}`;
  }

  const response = await fetch(`${GLPI_URL}/initSession`, {
    method: 'GET',
    headers: headers
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Erro GLPI initSession:', errorBody);
    throw new Error(`Falha ao iniciar sessão no GLPI: ${response.status}`);
  }

  const data = await response.json();
  return data.session_token;
}

/**
 * Tenta logar um usuário no GLPI e retornar seus dados básicos.
 */
export async function loginGLPI(username, password) {
  try {
    const sessionToken = await initSession({ username, password });
    
    const response = await fetch(`${GLPI_URL}/getFullSession`, {
      method: 'GET',
      headers: {
        'App-Token': APP_TOKEN,
        'Session-Token': sessionToken
      }
    });

    if (!response.ok) throw new Error('Falha ao obter dados da sessão GLPI');
    
    const data = await response.json();
    const user = data.session.glpi_realname ? {
      id: `GLPI-${data.session.glpiID}`,
      username: data.session.glpi_name,
      nome: `${data.session.glpi_firstname} ${data.session.glpi_realname}`.toUpperCase(),
      setor: 'GLPI',
      tipo_usuario: 'agente',
      origem: 'GLPI',
      sessionToken
    } : null;

    await fetch(`${GLPI_URL}/killSession`, {
      method: 'GET',
      headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken }
    }).catch(() => {});

    return user;
  } catch (error) {
    console.error('Erro no loginGLPI:', error);
    return null;
  }
}

/**
 * Busca itens do GLPI (Computers, Monitors, etc) e mapeia para o formato do sistema
 */
export async function fetchGLPIInventory() {
  let sessionToken;
  try {
    sessionToken = await initSession();

    const itemTypes = ['ConsumableItem', 'ReservationItem'];
    let allItems = [];

    for (const type of itemTypes) {
      const response = await fetch(`${GLPI_URL}/${type}?expand_dropdowns=true&range=0-1000`, {
        method: 'GET',
        headers: {
          'App-Token': APP_TOKEN,
          'Session-Token': sessionToken
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const mapped = data.map(item => {
            const isReserva = type === 'ReservationItem';
            
            let nome = (item.name || (isReserva ? 'ATIVO RESERVA' : 'INSUMO')).toUpperCase();
            let serial = '';
            let modelo = item.ref || item.completename || '';

            // Consolidação de Memórias RAM
            if (nome.includes('MEMÓRIA') || nome.includes('MEMORIA') || nome.includes('RAM ')) {
              const ddrMatch = nome.match(/DDR\d/i);
              const ddr = ddrMatch ? ddrMatch[0].toUpperCase() : '';
              const gbMatch = nome.match(/\d+GB/i);
              const gb = gbMatch ? gbMatch[0].toUpperCase() : '';
              const specs = [ddr, gb].filter(Boolean).join(' ');

              if (modelo && !serial) {
                serial = modelo;
              } else if (modelo && serial && modelo !== serial) {
                serial = `${serial} | ${modelo}`;
              }
              
              nome = 'MEMÓRIA RAM';
              modelo = specs || 'COMPONENTE';
            }

            if (isReserva) {
              nome = item.itemtype === 'Computer' ? 'COMPUTADOR' : item.itemtype.toUpperCase();
              let rawName = item._itemname || item.completename || item.itemname || item.name || '';
              serial = rawName.replace(/.*?\s-\s/i, '').replace(/^ID\s/i, '').trim(); 
              
              if (!serial && item.items_id) serial = String(item.items_id).replace(/^ID\s/i, '');
              modelo = 'ATIVO DE RESERVA';
            }

            const qtdFinal = Number(item.count || item.stock_count || item.otherserial || 1);

            return {
              id: `GLPI-${type}-${item.id}`,
              nome_equipamento: nome,
              modelo_detalhes: modelo,
              numero_serie: serial, 
              quantidade: qtdFinal, 
              origem: 'GLPI',
              bloqueado_insumo: isReserva,
              get: (field) => {
                if (field === 'nome_equipamento') return nome;
                if (field === 'modelo_detalhes') return modelo;
                if (field === 'numero_serie') return serial;
                if (field === 'quantidade') return qtdFinal;
                if (field === 'bloqueado_insumo') return isReserva;
                return item[field];
              }
            };
          });
          allItems = [...allItems, ...mapped];
        }
      }
    }

    return allItems;
  } catch (error) {
    console.error('Erro ao buscar inventário GLPI:', error);
    throw error;
  } finally {
    if (sessionToken) {
      fetch(`${GLPI_URL}/killSession`, {
        method: 'GET',
        headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken }
      }).catch(() => {});
    }
  }
}

/**
 * Cria um chamado no GLPI com enriquecimento de dados e atores
 */
export async function createGLPITicket(title, content, requesterInfo = {}) {
  let sessionToken;
  try {
    sessionToken = await initSession();

    let requesterId = null;
    let locationId = requesterInfo.locationId || GLPI_CONFIG.DEFAULT_LOCATION_ID;

    // Tenta localizar o requerente no GLPI pelo nome completo ou username
    const searchStr = requesterInfo.email || requesterInfo.username || requesterInfo.nome || requesterInfo.solicitante;
    
    if (searchStr && searchStr.toUpperCase() !== 'GLPI') {
       try {
         const nameParts = searchStr.trim().split(/\s+/);
         const lastName  = nameParts[nameParts.length - 1]; // Ex: "ALVES" de "ISAAC ALVES"
         const firstName = nameParts[0];                    // Ex: "ISAAC"

         const trySearch = async (field, value) => {
           const encoded = encodeURIComponent(value);
           const res = await fetch(
             `${GLPI_URL}/User?expand_dropdowns=true&range=0-5&criteria[0][field]=${field}&criteria[0][searchoperator]=contains&criteria[0][value]=${encoded}`,
             { headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken } }
           );
           if (!res.ok) return null;
           const data = await res.json();
           return Array.isArray(data) && data[0] ? data[0] : null;
         };

         // Ordem de busca: login (1) → sobrenome (9) → primeiro nome (34)
         const found =
           await trySearch(1, searchStr.trim()) ||
           (lastName.length > 2 && await trySearch(9, lastName)) ||
           (lastName.length > 2 && await trySearch(34, lastName)) ||
           (nameParts.length > 1 && await trySearch(9, searchStr.trim())) ||
           (nameParts.length > 1 && await trySearch(34, searchStr.trim())) ||
           (firstName.length > 2 && await trySearch(9, firstName)) ||
           (firstName.length > 2 && await trySearch(34, firstName));

         if (found) {
           requesterId = found.id;
           locationId  = found.locations_id || locationId;
           console.log('[GLPI] Requerente encontrado:', found.name, '→ ID:', requesterId);
         } else {
           console.warn('[GLPI] Requerente não localizado para:', searchStr);
         }
       } catch (e) {
         console.warn('[GLPI] Erro ao localizar o requerente:', e);
       }
    }

    // Monta o payload base — categoria como integer explícito
    const ticketInput = {
      name: title,
      content: content,
      itilcategories_id: parseInt(GLPI_CONFIG.CATEGORY_ID, 10),
      type: 2,
      status: 1,
      priority: 3,
      locations_id: parseInt(locationId, 10),
      _groups_id_observer: parseInt(GLPI_CONFIG.GROUP_OBSERVER_ID, 10),
      _users_id_assign: parseInt(GLPI_CONFIG.USER_ASSIGNED_ID, 10)
    };

    // Só inclui o requerente se encontrou um ID válido (> 0).
    // NÃO enviar o campo faz o GLPI usar o usuário do token;
    // enviar 0 também faz o mesmo. Por isso só enviamos quando temos o ID real.
    if (requesterId && requesterId > 0) {
      ticketInput._users_id_requester = parseInt(requesterId, 10);
    }

    const ticketPayload = { input: ticketInput };

    const response = await fetch(`${GLPI_URL}/Ticket`, {
      method: 'POST',
      headers: {
        'App-Token': APP_TOKEN,
        'Session-Token': sessionToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ticketPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[GLPI] Erro ao criar ticket:', errText);
      throw new Error(`Erro GLPI: ${response.status}`);
    }
    
    const data = await response.json();
    const ticket = Array.isArray(data) ? data[0] : data;
    console.log('[GLPI] Chamado criado com sucesso. ID:', ticket?.id, '| Categoria: 165 | Requerente ID:', requesterId);
    return ticket;
  } catch (error) {
    console.error('Erro na criação de chamado GLPI:', error);
    throw error;
  } finally {
    if (sessionToken) {
      fetch(`${GLPI_URL}/killSession`, {
        method: 'GET',
        headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken }
      }).catch(() => {});
    }
  }
}

/**
 * Faz o upload de um documento para o GLPI e o associa a um ticket
 */
export async function uploadGLPIDocument(blob, filename, ticketId = null) {
  let sessionToken;
  try {
    sessionToken = await initSession();

    const formData = new FormData();
    const uploadManifest = {
      input: {
        name: filename,
        filename: filename
      }
    };

    formData.append('uploadManifest', JSON.stringify(uploadManifest));
    formData.append('filename[0]', blob, filename);

    const response = await fetch(`${GLPI_URL}/Document`, {
      method: 'POST',
      headers: {
        'App-Token': APP_TOKEN,
        'Session-Token': sessionToken
      },
      body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro GLPI upload (Document):', errorText);
        throw new Error(`Erro ao subir arquivo: ${response.status}`);
    }

    const docResultRaw = await response.json();
    const docResult = Array.isArray(docResultRaw) ? docResultRaw[0] : docResultRaw;
    const docId = docResult.id;

    if (!docId) return docResult;

    // Vincula o documento ao ticket
    if (ticketId && docId) {
      const items_id = parseInt(ticketId);
      const linkResponse = await fetch(`${GLPI_URL}/Document_Item`, {
        method: 'POST',
        headers: {
          'App-Token': APP_TOKEN,
          'Session-Token': sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: {
            documents_id: docId,
            items_id: items_id,
            itemtype: 'Ticket'
          }
        })
      });

      if (!linkResponse.ok) {
         const linkError = await linkResponse.text();
         console.error('Erro ao vincular documento ao ticket:', linkError);
      }
    }

    return docResult;
  } catch (error) {
    console.error('Erro ao subir documento no GLPI:', error);
    throw error;
  } finally {
    if (sessionToken) {
      fetch(`${GLPI_URL}/killSession`, {
        method: 'GET',
        headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken }
      }).catch(() => {});
    }
  }
}

/**
 * Soluciona um chamado no GLPI
 */
export async function solveGLPITicket(ticketId, comment = "Empréstimo finalizado e item devolvido.") {
  let sessionToken;
  try {
    sessionToken = await initSession();
    
    const solResponse = await fetch(`${GLPI_URL}/ITILSolution`, {
      method: 'POST',
      headers: {
        'App-Token': APP_TOKEN,
        'Session-Token': sessionToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          items_id: ticketId,
          itemtype: 'Ticket',
          content: comment
        }
      })
    });

    if (!solResponse.ok) {
       const solErr = await solResponse.text();
       console.error('Erro ao adicionar solução ITIL:', solErr);
    }

    const response = await fetch(`${GLPI_URL}/Ticket/${ticketId}`, {
      method: 'PUT',
      headers: {
        'App-Token': APP_TOKEN,
        'Session-Token': sessionToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          id: ticketId,
          status: 5 // Solucionado
        }
      })
    });

    if (!response.ok) {
      const respErr = await response.text();
      console.error(`Falha ao alterar status do chamado ${ticketId}:`, respErr);
    }

    return true;
  } catch (error) {
    console.error('Erro ao solucionar chamado GLPI:', error);
    return false;
  } finally {
    if (sessionToken) {
      fetch(`${GLPI_URL}/killSession`, {
        method: 'GET',
        headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken }
      }).catch(() => {});
    }
  }
}

/**
 * Busca usuários (Colaboradores) do GLPI
 */
export async function fetchGLPIUsers() {
  let sessionToken;
  try {
    sessionToken = await initSession();

    const response = await fetch(`${GLPI_URL}/User?expand_dropdowns=true&range=0-2000`, {
      method: 'GET',
      headers: {
        'App-Token': APP_TOKEN,
        'Session-Token': sessionToken
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter(u => u.is_deleted !== 1 && u.is_active !== 0) // Filtra inativos/excluídos
      .map(u => {
        let finalName = '';
        if (u.realname && u.firstname) {
           finalName = `${u.firstname} ${u.realname}`;
        } else {
           finalName = u.name || '';
        }
        return {
          id: `GLPI-USER-${u.id}`,
          nome: finalName.toUpperCase(),
          setor: u.locations_id || 'GLPI',
          isGLPI: true
        };
      })
      .filter(u => u.nome && u.nome !== 'GLPI' && !u.nome.includes('.')); // Remove duplicatas de login (ex: isaac.alves)
      
  } catch (error) {
    console.error('Erro na fetchGLPIUsers:', error);
    return [];
  } finally {
    if (sessionToken) {
      fetch(`${GLPI_URL}/killSession`, {
        method: 'GET',
        headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken }
      }).catch(() => {});
    }
  }
}

/**
 * Busca chamados (Tickets) do GLPI baseados em filtros
 */
export async function fetchGLPITickets(params = {}) {
  let sessionToken;
  try {
    sessionToken = await initSession();
    
    const range = params.range || '0-100';
    const url = new URL(`${GLPI_URL}/Ticket`);
    url.searchParams.append('expand_dropdowns', 'true');
    url.searchParams.append('range', range);
    url.searchParams.append('order', 'DESC');
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'App-Token': APP_TOKEN,
        'Session-Token': sessionToken
      }
    });

    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Erro na fetchGLPITickets:', error);
    return [];
  } finally {
    if (sessionToken) {
      fetch(`${GLPI_URL}/killSession`, {
        method: 'GET',
        headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken }
      }).catch(() => {});
    }
  }
}

/**
 * Busca chamados ativos (Não solucionados/fechados) vinculados a empréstimos
 * IMPORTANTE: O GLPI omite o campo "content" nas listagens por padrão.
 * Usamos forcedisplay para forçar o retorno dos campos necessários.
 */
export async function fetchActiveGLPITickets() {
  let sessionToken;
  try {
    sessionToken = await initSession();
    
    // forcedisplay força o retorno de campos específicos que o GLPI omite por padrão:
    // Campo 21 = content (descrição do chamado)
    // Campo 1  = name (título)
    // Campo 12 = status
    // Campo 7  = itilcategories_id
    // Campo 83 = requesters (requerentes)
    const forceFields = `&forcedisplay[0]=21&forcedisplay[1]=1&forcedisplay[2]=12&forcedisplay[3]=7&forcedisplay[4]=83&forcedisplay[5]=15&forcedisplay[6]=2`;

    // Busca os 100 chamados mais recentes, independentemente do status.
    // Isso é importante para que o front-end consiga detectar chamados que acabaram
    // de ser solucionados (status >= 5) e faça a baixa automática no Supabase.
    let url = `${GLPI_URL}/Ticket?expand_dropdowns=true&range=0-100&order=DESC&sort=date_mod${forceFields}`;
    
    // Filtra por categoria 165 (ou categoria configurada)
    if (GLPI_CONFIG.CATEGORY_ID && GLPI_CONFIG.CATEGORY_ID !== 0) {
      url += `&criteria[0][field]=7&criteria[0][searchoperator]==&criteria[0][value]=${GLPI_CONFIG.CATEGORY_ID}`;
    }

    console.log('[GLPI] Buscando chamados ativos com content:', url);

    const response = await fetch(url, {
      headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[GLPI] Erro na busca de chamados:', errText);
      throw new Error('Erro ao buscar chamados no GLPI');
    }
    
    const data = await response.json();

    if (!Array.isArray(data)) {
      console.warn('[GLPI] fetchActiveGLPITickets retornou não-array:', data);
      return [];
    }

    // DEBUG: Loga o primeiro ticket para inspecionar os campos disponíveis
    if (data[0]) {
      console.log('[GLPI] Campos do 1º ticket:', Object.keys(data[0]));
      console.log('[GLPI] content do 1º ticket:', data[0].content ? data[0].content.substring(0, 200) : 'VAZIO/NULL');
    }

    // Se os tickets não têm content, busca individualmente (fallback)
    const hasContent = data.some(t => t.content && t.content.length > 10);
    if (!hasContent && data.length > 0) {
      console.warn('[GLPI] content ausente nos tickets — buscando individualmente...');
      const enriched = await Promise.all(
        data.map(async (ticket) => {
          try {
            const r = await fetch(`${GLPI_URL}/Ticket/${ticket.id}?expand_dropdowns=true`, {
              headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken }
            });
            if (r.ok) {
              const full = await r.json();
              return { ...ticket, content: full.content || ticket.content };
            }
          } catch (_) {}
          return ticket;
        })
      );
      return enriched;
    }

    return data;
  } catch (error) {
    console.error('Erro fetchActiveGLPITickets:', error);
    return [];
  } finally {
    if (sessionToken) {
      fetch(`${GLPI_URL}/killSession`, {
        method: 'GET',
        headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken }
      }).catch(() => {});
    }
  }
}

/**
 * Verifica quais tickets GLPI estão Solucionados (5) ou Fechados (6).
 * Retorna a lista de IDs que devem receber baixa automática no sistema.
 * @param {number[]} ticketIds - Array de IDs de tickets a verificar
 * @returns {Promise<number[]>} - IDs que estão concluídos no GLPI
 */
export async function checkClosedGLPITickets(ticketIds = []) {
  if (!ticketIds || ticketIds.length === 0) return [];
  let sessionToken;
  try {
    sessionToken = await initSession();
    const closedIds = [];

    // Busca em paralelo (lote de até 10 por vez para não sobrecarregar)
    const chunkSize = 10;
    for (let i = 0; i < ticketIds.length; i += chunkSize) {
      const chunk = ticketIds.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (ticketId) => {
        try {
          const res = await fetch(`${GLPI_URL}/Ticket/${ticketId}?expand_dropdowns=false`, {
            headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken }
          });
          if (!res.ok) return;
          const ticket = await res.json();
          // Status 5 = Solucionado, 6 = Fechado
          if (ticket && (ticket.status === 5 || ticket.status === 6)) {
            console.log(`[GLPI] Ticket #${ticketId} está concluído (status ${ticket.status}) → baixa automática`);
            closedIds.push(ticketId);
          }
        } catch (_) {}
      }));
    }

    return closedIds;
  } catch (error) {
    console.error('Erro em checkClosedGLPITickets:', error);
    return [];
  } finally {
    if (sessionToken) {
      fetch(`${GLPI_URL}/killSession`, {
        method: 'GET',
        headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken }
      }).catch(() => {});
    }
  }
}