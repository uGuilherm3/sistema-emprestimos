const GLPI_URL = import.meta.env.VITE_GLPI_URL || 'https://chamados.oabce.org.br/apirest.php';
const APP_TOKEN = import.meta.env.VITE_GLPI_APP_TOKEN || '7uq6DCSHn6hAPfGrquvoHcuMgCjX5Pff5zLeS1ON';

async function initSession(credentials) {
  const auth = btoa(`${credentials.username}:${credentials.password}`);
  const response = await fetch(`${GLPI_URL}/initSession`, {
    method: 'GET',
    headers: {
      'App-Token': APP_TOKEN,
      'Authorization': `login_password ${auth}`,
    },
  });
  if (!response.ok) throw new Error(`GLPI session failed: ${response.status}`);
  const data = await response.json();
  return data.session_token;
}

export async function loginGLPI(username, password) {
  try {
    const sessionToken = await initSession({ username, password });
    const response = await fetch(`${GLPI_URL}/getFullSession`, {
      method: 'GET',
      headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken },
    });
    if (!response.ok) throw new Error('GLPI session fetch failed');
    const data = await response.json();
    const user = data.session.glpi_realname
      ? {
          id: `GLPI-${data.session.glpiID}`,
          username: data.session.glpi_name,
          tipo_usuario: 'agente',
          sessionToken,
        }
      : null;
    fetch(`${GLPI_URL}/killSession`, {
      method: 'GET',
      headers: { 'App-Token': APP_TOKEN, 'Session-Token': sessionToken },
    }).catch(() => {});
    return user;
  } catch (err) {
    console.error('GLPI login error:', err);
    return null;
  }
}
