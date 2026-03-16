const api = async (url, options = {}) => {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
};

const toastEl = document.getElementById('toast');
const currentUserEl = document.getElementById('currentUser');
const matchesEl = document.getElementById('matches');
const requestsEl = document.getElementById('requests');
const findMatchesBtn = document.getElementById('findMatchesBtn');
let currentUser = null;

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function splitSkills(value) {
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function renderPills(items) {
  return `<div class="pill-group">${items.map(item => `<span class="pill">${item}</span>`).join('')}</div>`;
}

function setCurrentUser(user) {
  currentUser = user;
  currentUserEl.textContent = `Current user: ${user.name} (${user.email})`;
  findMatchesBtn.classList.remove('hidden');
  loadRequests();
}

async function loadMatches() {
  if (!currentUser) return;
  const matches = await api(`/api/matches/${currentUser.id}`);
  if (!matches.length) {
    matchesEl.className = 'list empty';
    matchesEl.textContent = 'No matches found yet. Try different skills or load demo data.';
    return;
  }
  matchesEl.className = 'list';
  matchesEl.innerHTML = matches.map(match => `
    <div class="match-card">
      <h3>${match.name}</h3>
      <p><strong>Major:</strong> ${match.major || 'N/A'}</p>
      <p>${match.bio || ''}</p>
      <p><strong>They can teach you:</strong></p>
      ${renderPills(match.they_can_teach_me.length ? match.they_can_teach_me : ['No direct overlap'])}
      <p><strong>You can teach them:</strong></p>
      ${renderPills(match.i_can_teach_them.length ? match.i_can_teach_them : ['No direct overlap'])}
      <p><strong>Availability:</strong> ${match.availability || 'Not provided'}</p>
      <p><strong>Match score:</strong> ${match.match_score}</p>
      <button onclick="sendRequest(${match.id}, '${match.name.replace(/'/g, "\\'")}')">Send Request</button>
    </div>
  `).join('');
}

async function loadRequests() {
  if (!currentUser) return;
  const requests = await api(`/api/requests/${currentUser.id}`);
  if (!requests.length) {
    requestsEl.className = 'list empty';
    requestsEl.textContent = 'No requests yet.';
    return;
  }
  requestsEl.className = 'list';
  requestsEl.innerHTML = requests.map(req => {
    const incoming = req.to_user_id === currentUser.id;
    return `
      <div class="request-card">
        <h3>${incoming ? 'Incoming Request' : 'Outgoing Request'}</h3>
        <p><strong>From:</strong> ${req.from_name}</p>
        <p><strong>To:</strong> ${req.to_name}</p>
        <p><strong>Message:</strong> ${req.message || 'No message added'}</p>
        <p class="status ${req.status}">Status: ${req.status}</p>
        ${incoming && req.status === 'pending' ? `
          <div class="inline-actions">
            <button onclick="updateRequest(${req.id}, 'accepted')">Accept</button>
            <button class="danger" onclick="updateRequest(${req.id}, 'declined')">Decline</button>
          </div>` : ''}
      </div>
    `;
  }).join('');
}

async function sendRequest(toUserId, name) {
  if (!currentUser) return toast('Create a profile first.');
  const message = `Hi ${name}, I would love to connect for a SkillSwap session.`;
  await api('/api/requests', {
    method: 'POST',
    body: JSON.stringify({
      from_user_id: currentUser.id,
      to_user_id: toUserId,
      message,
    }),
  });
  toast(`Request sent to ${name}`);
  loadRequests();
}
window.sendRequest = sendRequest;

async function updateRequest(requestId, status) {
  await api(`/api/requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  toast(`Request ${status}`);
  loadRequests();
}
window.updateRequest = updateRequest;

document.getElementById('initBtn').addEventListener('click', async () => {
  await api('/api/init', { method: 'POST' });
  toast('App initialized');
});

document.getElementById('seedBtn').addEventListener('click', async () => {
  await api('/api/seed', { method: 'POST' });
  toast('Demo data loaded');
});

document.getElementById('resetBtn').addEventListener('click', async () => {
  await api('/api/reset', { method: 'POST' });
  currentUser = null;
  currentUserEl.textContent = '';
  findMatchesBtn.classList.add('hidden');
  matchesEl.className = 'list empty';
  matchesEl.textContent = 'No matches yet.';
  requestsEl.className = 'list empty';
  requestsEl.textContent = 'No requests yet.';
  toast('Database reset');
});

findMatchesBtn.addEventListener('click', loadMatches);

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim(),
    major: document.getElementById('major').value.trim(),
    bio: document.getElementById('bio').value.trim(),
    availability: document.getElementById('availability').value.trim(),
    teach_skills: splitSkills(document.getElementById('teach_skills').value),
    learn_skills: splitSkills(document.getElementById('learn_skills').value),
  };
  const user = await api('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setCurrentUser(user);
  toast('Profile saved');
  e.target.reset();
});
