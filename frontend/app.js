/**
 * Sistema de Votação Eletrônica — Frontend S3 Web Client
 * Responsabilidade: Pessoa 1 (Frontend, UX/UI e Hospedagem no Amazon S3)
 */

// Global State
const state = {
  apiUrl: localStorage.getItem('voter_api_url') || 'http://localhost:3000',
  token: localStorage.getItem('voter_jwt_token') || null,
  user: JSON.parse(localStorage.getItem('voter_user_data') || 'null'),
  candidates: [],
  votesMap: {}
};

// Fallback Mock Candidates (Utilizado caso a API Gateway ou Backend esteja offline/carregando)
const mockCandidates = [
  { id: 1, name: "Ana Silva", party: "Partido da Tecnologia (PTech)", description: "Propostas focadas em inovação digital e infraestrutura de nuvem.", votes: 42 },
  { id: 2, name: "Carlos Oliveira", party: "Aliança Sustentável (AS)", description: "Foco em energia limpa e desenvolvimento sustentável.", votes: 28 },
  { id: 3, name: "Mariana Costa", party: "Frente Educacional (FE)", description: "Investimentos maciços em educação tecnológica e ciência.", votes: 35 }
];

// DOM Elements
const elements = {
  // Navigation & User
  btnOpenLogin: document.getElementById('btn-open-login'),
  userPill: document.getElementById('user-pill'),
  userNameDisplay: document.getElementById('user-name-display'),
  userRoleDisplay: document.getElementById('user-role-display'),
  userAvatarInitials: document.getElementById('user-avatar-initials'),
  btnLogout: document.getElementById('btn-logout'),

  // API Config
  btnApiConfig: document.getElementById('btn-api-config'),
  lblApiTarget: document.getElementById('lbl-api-target'),
  modalApiConfig: document.getElementById('modal-api-config'),
  btnCloseApiConfig: document.getElementById('btn-close-api-config'),
  inputApiUrl: document.getElementById('input-api-url'),
  btnSaveApiUrl: document.getElementById('btn-save-api-url'),

  // Login Modal
  modalLogin: document.getElementById('modal-login'),
  btnCloseLogin: document.getElementById('btn-close-login'),
  formLogin: document.getElementById('form-login'),
  inputEmail: document.getElementById('input-email'),
  inputPassword: document.getElementById('input-password'),
  loginErrorMsg: document.getElementById('login-error-msg'),
  btnSubmitLogin: document.getElementById('btn-submit-login'),
  lblLoginSubmit: document.getElementById('lbl-login-submit'),

  // Main UI
  loginAlert: document.getElementById('login-alert'),
  btnAlertLogin: document.getElementById('btn-alert-login'),
  candidatesGrid: document.getElementById('candidates-grid'),
  btnRefreshCandidatos: document.getElementById('btn-refresh-candidatos'),
  resultsContainer: document.getElementById('results-container'),
  toastContainer: document.getElementById('toast-container'),

  // Stats
  statTotalCandidatos: document.getElementById('stat-total-candidatos'),
  statTotalVotos: document.getElementById('stat-total-votos'),
  statStatusGateway: document.getElementById('stat-status-gateway')
};

// Initializer
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

function initApp() {
  updateApiTargetLabel();
  renderUserAuthState();
  fetchCandidates();
}

function updateApiTargetLabel() {
  const isLocal = state.apiUrl.includes('localhost') || state.apiUrl.includes('127.0.0.1');
  elements.lblApiTarget.textContent = isLocal ? 'API Gateway (Local)' : 'API Gateway (AWS)';
  elements.inputApiUrl.value = state.apiUrl;
}

// Event Listeners
function setupEventListeners() {
  // Login Modals
  elements.btnOpenLogin?.addEventListener('click', () => showModal(elements.modalLogin));
  elements.btnAlertLogin?.addEventListener('click', () => showModal(elements.modalLogin));
  elements.btnCloseLogin?.addEventListener('click', () => hideModal(elements.modalLogin));
  elements.formLogin?.addEventListener('submit', handleLogin);
  elements.btnLogout?.addEventListener('click', handleLogout);

  // API Config Modal
  elements.btnApiConfig?.addEventListener('click', () => showModal(elements.modalApiConfig));
  elements.btnCloseApiConfig?.addEventListener('click', () => hideModal(elements.modalApiConfig));
  elements.btnSaveApiUrl?.addEventListener('click', handleSaveApiUrl);

  // Refresh
  elements.btnRefreshCandidatos?.addEventListener('click', () => fetchCandidates(true));
}

// User Auth Rendering
function renderUserAuthState() {
  if (state.token && state.user) {
    elements.btnOpenLogin.classList.add('hidden');
    elements.userPill.classList.remove('hidden');
    elements.loginAlert.classList.add('hidden');

    elements.userNameDisplay.textContent = state.user.name || 'Eleitor';
    elements.userRoleDisplay.textContent = state.user.role || 'VOTER';
    elements.userAvatarInitials.textContent = (state.user.name || 'E').charAt(0).toUpperCase();
  } else {
    elements.btnOpenLogin.classList.remove('hidden');
    elements.userPill.classList.add('hidden');
    elements.loginAlert.classList.remove('hidden');
  }
}

// Modal Helpers
function showModal(modal) {
  modal.classList.remove('hidden');
}
function hideModal(modal) {
  modal.classList.add('hidden');
  if (elements.loginErrorMsg) elements.loginErrorMsg.classList.add('hidden');
}

// Handle Login
async function handleLogin(e) {
  e.preventDefault();
  const email = elements.inputEmail.value.trim();
  const password = elements.inputPassword.value.trim();

  elements.loginErrorMsg.classList.add('hidden');
  elements.btnSubmitLogin.disabled = true;
  elements.lblLoginSubmit.textContent = "Autenticando...";

  try {
    const response = await fetch(`${state.apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error?.message || 'Falha ao realizar login.');
    }

    // Save state
    state.token = data.accessToken;
    state.user = data.user;
    localStorage.setItem('voter_jwt_token', state.token);
    localStorage.setItem('voter_user_data', JSON.stringify(state.user));

    renderUserAuthState();
    hideModal(elements.modalLogin);
    showToast('Autenticação realizada com sucesso! Token JWT armazenado.', 'success');

    // Refresh candidates with token
    fetchCandidates();

  } catch (err) {
    console.warn('Erro ao conectar na API Gateway:', err.message);
    elements.loginErrorMsg.textContent = err.message || 'Erro ao conectar à API Gateway. Verifique se o servidor está online.';
    elements.loginErrorMsg.classList.remove('hidden');
    showToast('Falha na autenticação JWT', 'error');
  } finally {
    elements.btnSubmitLogin.disabled = false;
    elements.lblLoginSubmit.textContent = "Entrar e Obter Token JWT";
  }
}

// Handle Logout
function handleLogout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('voter_jwt_token');
  localStorage.removeItem('voter_user_data');
  renderUserAuthState();
  showToast('Você encerrou sua sessão.', 'info');
}

// Handle Save API URL
function handleSaveApiUrl() {
  const newUrl = elements.inputApiUrl.value.trim().replace(/\/$/, "");
  if (newUrl) {
    state.apiUrl = newUrl;
    localStorage.setItem('voter_api_url', newUrl);
    updateApiTargetLabel();
    hideModal(elements.modalApiConfig);
    showToast(`URL da API Gateway atualizada para: ${newUrl}`, 'success');
    fetchCandidates();
  }
}

// Fetch Candidates
async function fetchCandidates(userTriggered = false) {
  elements.statStatusGateway.textContent = 'Verificando...';

  try {
    const headers = {};
    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    const response = await fetch(`${state.apiUrl}/api/v1/voting/candidatos`, { headers });

    if (response.ok) {
      const data = await response.json();
      state.candidates = Array.isArray(data) ? data : (data.candidatos || mockCandidates);
      elements.statStatusGateway.textContent = 'Online';
      elements.statStatusGateway.style.color = 'var(--accent-green)';
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (err) {
    console.info('Utilizando candidatos simulados (Modo Demonstração/Offline):', err.message);
    state.candidates = mockCandidates;
    elements.statStatusGateway.textContent = 'Modo Demo (S3)';
    elements.statStatusGateway.style.color = 'var(--accent-amber)';
  }

  renderCandidates();
  renderResults();

  if (userTriggered) {
    showToast('Lista de candidatos e apuração atualizadas!', 'success');
  }
}

// Render Candidates Cards
function renderCandidates() {
  elements.candidatesGrid.innerHTML = '';
  elements.statTotalCandidatos.textContent = state.candidates.length;

  state.candidates.forEach(candidate => {
    const card = document.createElement('div');
    card.className = 'candidate-card';

    const initials = candidate.name.split(' ').map(n => n[0]).join('').substring(0, 2);

    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:16px;">
        <div class="candidate-avatar">${initials}</div>
        <div class="candidate-info">
          <h4>${candidate.name}</h4>
          <span class="candidate-party">${candidate.party || 'Candidato Votação'}</span>
        </div>
      </div>
      <p class="text-sm">${candidate.description || 'Propostas registradas na plataforma eleitoral.'}</p>
      <button class="btn-primary btn-vote" ${!state.token ? 'disabled title="Faça login para votar"' : ''} data-id="${candidate.id}">
        🗳️ Votar em ${candidate.name.split(' ')[0]}
      </button>
    `;

    // Attach vote event
    const btnVote = card.querySelector('.btn-vote');
    btnVote.addEventListener('click', () => submitVote(candidate.id, candidate.name));

    elements.candidatesGrid.appendChild(card);
  });
}

// Submit Vote
async function submitVote(candidateId, candidateName) {
  if (!state.token) {
    showToast('Você precisa fazer login para registrar seu voto!', 'error');
    showModal(elements.modalLogin);
    return;
  }

  try {
    showToast(`Registrando voto em ${candidateName}...`, 'info');

    const response = await fetch(`${state.apiUrl}/api/v1/voting/votar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ candidato_id: candidateId })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || errData.message || `Erro HTTP ${response.status}`);
    }

    showToast(`✅ Voto para "${candidateName}" computado com sucesso!`, 'success');

    // Update local counter
    const cand = state.candidates.find(c => c.id === candidateId);
    if (cand) {
      cand.votes = (cand.votes || 0) + 1;
    }
    renderResults();

  } catch (err) {
    console.warn('Erro na requisição de voto:', err);

    // Fallback demo increment if local gateway proxy is not running python backend
    const cand = state.candidates.find(c => c.id === candidateId);
    if (cand) cand.votes = (cand.votes || 0) + 1;

    renderResults();
    showToast(`Voto registrado em modo de simulação! (${err.message})`, 'success');
  }
}

// Render Results Progress Bars
function renderResults() {
  elements.resultsContainer.innerHTML = '';

  const totalVotes = state.candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
  elements.statTotalVotos.textContent = totalVotes;

  if (state.candidates.length === 0) {
    elements.resultsContainer.innerHTML = '<div class="empty-state">Nenhum candidato cadastrado.</div>';
    return;
  }

  state.candidates.forEach(candidate => {
    const votes = candidate.votes || 0;
    const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;

    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div class="result-label">
        <span>${candidate.name} (${candidate.party || 'Opção'})</span>
        <span>${votes} votos (${percentage}%)</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${percentage}%"></div>
      </div>
    `;
    elements.resultsContainer.appendChild(item);
  });
}

// Toast Notifications Helper
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
