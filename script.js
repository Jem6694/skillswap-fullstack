const API = {
  init: "/api/init",
  demo: "/api/demo",
  reset: "/api/reset",
  profile: "/api/profile",
  matches: "/api/matches",
  requests: "/api/requests",
  updateRequest: (id) => `/api/request/${id}`
};

let currentUserEmail = "";

function getProfileData() {
  return {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    major: document.getElementById("major").value.trim(),
    availability: document.getElementById("availability").value.trim(),
    bio: document.getElementById("bio").value.trim(),
    teach_skills: document.getElementById("teachSkills").value
      .split(",")
      .map(s => s.trim())
      .filter(Boolean),
    learn_skills: document.getElementById("learnSkills").value
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
  };
}

function showEmptyState(containerId, icon, title, subtitle) {
  const container = document.getElementById(containerId);
  container.className = "content-area empty-state";
  container.innerHTML = `
    <div class="empty-icon">${icon}</div>
    <p>${title}</p>
    <span>${subtitle}</span>
  `;
}

async function initializeApp() {
  try {
    const res = await fetch(API.init, { method: "POST" });
    if (!res.ok) throw new Error("Failed to initialize app");
    alert("App initialized successfully.");
  } catch (err) {
    alert("Error initializing app.");
    console.error(err);
  }
}

async function loadDemoData() {
  try {
    const res = await fetch(API.demo, { method: "POST" });
    if (!res.ok) throw new Error("Failed to load demo data");
    alert("Demo data loaded.");
    findMatches();
    loadRequests();
  } catch (err) {
    alert("Error loading demo data.");
    console.error(err);
  }
}

async function resetDatabase() {
  const confirmReset = confirm("Are you sure you want to reset the database?");
  if (!confirmReset) return;

  try {
    const res = await fetch(API.reset, { method: "POST" });
    if (!res.ok) throw new Error("Failed to reset database");
    alert("Database reset.");
    document.getElementById("profileForm").reset();
    currentUserEmail = "";
    showEmptyState("matchesContainer", "🔍", "No matches yet.", "Save your profile and click “Find Matches” to get started.");
    showEmptyState("requestsContainer", "📬", "No requests yet.", "Your session requests will appear here.");
  } catch (err) {
    alert("Error resetting database.");
    console.error(err);
  }
}

async function saveProfile() {
  const profile = getProfileData();

  if (!profile.name || !profile.email) {
    alert("Please enter at least your name and email.");
    return;
  }

  try {
    const res = await fetch(API.profile, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    });

    if (!res.ok) throw new Error("Failed to save profile");

    currentUserEmail = profile.email;
    alert("Profile saved successfully.");
    findMatches();
    loadRequests();
  } catch (err) {
    alert("Error saving profile.");
    console.error(err);
  }
}

async function findMatches() {
  const profile = getProfileData();
  const email = profile.email || currentUserEmail;

  if (!email) {
    alert("Please save your profile first.");
    return;
  }

  currentUserEmail = email;

  try {
    const res = await fetch(`${API.matches}?email=${encodeURIComponent(email)}`);
    if (!res.ok) throw new Error("Failed to fetch matches");

    const matches = await res.json();
    renderMatches(matches);
  } catch (err) {
    showEmptyState("matchesContainer", "⚠️", "Could not load matches.", "Please try again.");
    console.error(err);
  }
}

function renderMatches(matches) {
  const container = document.getElementById("matchesContainer");
  container.className = "content-area";

  if (!matches || matches.length === 0) {
    showEmptyState("matchesContainer", "🔍", "No matches yet.", "Try adding more skills or load demo data.");
    return;
  }

  container.innerHTML = matches.map(match => {
    const teachTags = (match.teach_skills || []).map(skill => `<span class="tag">${skill}</span>`).join("");
    const learnTags = (match.learn_skills || []).map(skill => `<span class="tag">${skill}</span>`).join("");

    return `
      <div class="match-card">
        <h3>${match.name || "Unnamed User"}</h3>
        <p><strong>Major:</strong> ${match.major || "N/A"}</p>
        <p><strong>Availability:</strong> ${match.availability || "N/A"}</p>
        <p>${match.bio || ""}</p>

        <div class="card-tags">
          ${teachTags}
          ${learnTags}
        </div>

        <div class="card-actions">
          <button class="primary-btn" onclick="sendRequest('${match.email}')">Send Request</button>
        </div>
      </div>
    `;
  }).join("");
}

async function sendRequest(targetEmail) {
  if (!currentUserEmail) {
    alert("Please save your profile first.");
    return;
  }

  try {
    const res = await fetch("/api/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sender_email: currentUserEmail,
        receiver_email: targetEmail
      })
    });

    if (!res.ok) throw new Error("Failed to send request");

    alert("Request sent.");
    loadRequests();
  } catch (err) {
    alert("Error sending request.");
    console.error(err);
  }
}

async function loadRequests() {
  if (!currentUserEmail) return;

  try {
    const res = await fetch(`${API.requests}?email=${encodeURIComponent(currentUserEmail)}`);
    if (!res.ok) throw new Error("Failed to load requests");

    const requests = await res.json();
    renderRequests(requests);
  } catch (err) {
    showEmptyState("requestsContainer", "⚠️", "Could not load requests.", "Please try again.");
    console.error(err);
  }
}

function renderRequests(requests) {
  const container = document.getElementById("requestsContainer");
  container.className = "content-area";

  if (!requests || requests.length === 0) {
    showEmptyState("requestsContainer", "📬", "No requests yet.", "Your session requests will appear here.");
    return;
  }

  container.innerHTML = requests.map(req => `
    <div class="request-card">
      <h3>${req.sender_name || req.sender_email || "Unknown Sender"}</h3>
      <p><strong>From:</strong> ${req.sender_email || "N/A"}</p>
      <p><strong>Status:</strong> ${req.status || "Pending"}</p>

      <div class="card-actions">
        ${req.status === "pending" ? `
          <button class="accept-btn" onclick="updateRequestStatus(${req.id}, 'accepted')">Accept</button>
          <button class="decline-btn" onclick="updateRequestStatus(${req.id}, 'declined')">Decline</button>
        ` : ""}
      </div>
    </div>
  `).join("");
}

async function updateRequestStatus(requestId, status) {
  try {
    const res = await fetch(API.updateRequest(requestId), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    if (!res.ok) throw new Error("Failed to update request");

    loadRequests();
  } catch (err) {
    alert("Error updating request.");
    console.error(err);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  showEmptyState("matchesContainer", "🔍", "No matches yet.", "Save your profile and click “Find Matches” to get started.");
  showEmptyState("requestsContainer", "📬", "No requests yet.", "Your session requests will appear here.");
});