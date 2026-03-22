let currentUser = null;

function $(id) {
  return document.getElementById(id);
}

function showEmptyState(containerId, icon, title, subtitle) {
  const container = $(containerId);
  if (!container) return;

  container.className = "content-area empty-state";
  container.innerHTML = `
    <div class="empty-icon">${icon}</div>
    <p>${title}</p>
    <span>${subtitle}</span>
  `;
}

function getProfileData() {
  return {
    name: $("name")?.value.trim() || "",
    email: $("email")?.value.trim() || "",
    major: $("major")?.value.trim() || "",
    availability: $("availability")?.value.trim() || "",
    bio: $("bio")?.value.trim() || "",
    teach_skills: ($("teachSkills")?.value || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean),
    learn_skills: ($("learnSkills")?.value || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
  };
}

async function initializeApp() {
  try {
    const res = await fetch("/api/init", { method: "POST" });
    if (!res.ok) throw new Error("Init failed");
    alert("App initialized successfully.");
  } catch (err) {
    console.error(err);
    alert("Error initializing app.");
  }
}

async function loadDemoData() {
  try {
    const res = await fetch("/api/seed", { method: "POST" });
    if (!res.ok) throw new Error("Seed failed");
    alert("Demo data loaded.");

    if (currentUser?.id) {
      await findMatches();
      await loadRequests();
    }
  } catch (err) {
    console.error(err);
    alert("Error loading demo data.");
  }
}

async function resetDatabase() {
  const confirmed = confirm("Are you sure you want to reset the database?");
  if (!confirmed) return;

  try {
    const res = await fetch("/api/reset", { method: "POST" });
    if (!res.ok) throw new Error("Reset failed");

    if ($("profileForm")) $("profileForm").reset();
    currentUser = null;

    showEmptyState(
      "matchesContainer",
      "🔍",
      "No matches yet.",
      "Save your profile and click Find Matches."
    );
    showEmptyState(
      "requestsContainer",
      "📬",
      "No requests yet.",
      "Your requests will appear here."
    );

    alert("Database reset.");
  } catch (err) {
    console.error(err);
    alert("Error resetting database.");
  }
}

async function saveProfile() {
  const profile = getProfileData();

  if (!profile.name || !profile.email || !profile.teach_skills.length || !profile.learn_skills.length) {
    alert("Please fill in name, email, teach skills, and learn skills.");
    return;
  }

  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(profile)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to save profile");
    }

    currentUser = data;
    alert("Profile saved successfully.");

    await findMatches();
    await loadRequests();
  } catch (err) {
    console.error(err);
    alert(err.message || "Error saving profile.");
  }
}

async function findMatches() {
  if (!currentUser?.id) {
    alert("Please save your profile first.");
    return;
  }

  try {
    const res = await fetch(`/api/matches/${currentUser.id}`);
    const matches = await res.json();

    if (!res.ok) {
      throw new Error(matches.error || "Failed to load matches");
    }

    renderMatches(matches);
  } catch (err) {
    console.error(err);
    showEmptyState(
      "matchesContainer",
      "⚠️",
      "Could not load matches.",
      "Please try again."
    );
  }
}

function renderMatches(matches) {
  const container = $("matchesContainer");
  if (!container) return;

  container.className = "content-area";

  if (!matches || matches.length === 0) {
    showEmptyState(
      "matchesContainer",
      "🔍",
      "No matches yet.",
      "Try loading demo data or adding more skills."
    );
    return;
  }

  container.innerHTML = matches.map(match => {
    const teachMeTags = (match.they_can_teach_me || [])
      .map(skill => `<span class="tag">Can teach you: ${skill}</span>`)
      .join("");

    const iTeachThemTags = (match.i_can_teach_them || [])
      .map(skill => `<span class="tag">You can teach: ${skill}</span>`)
      .join("");

    return `
      <div class="match-card">
        <h3>${match.name}</h3>
        <p><strong>Email:</strong> ${match.email}</p>
        <p><strong>Major:</strong> ${match.major || "N/A"}</p>
        <p><strong>Availability:</strong> ${match.availability || "N/A"}</p>
        <p>${match.bio || ""}</p>
        <div class="card-tags">
          ${teachMeTags}
          ${iTeachThemTags}
        </div>
        <div class="card-actions">
          <button class="primary-btn" onclick="sendRequest(${match.id})">Send Request</button>
        </div>
      </div>
    `;
  }).join("");
}

async function sendRequest(toUserId) {
  if (!currentUser?.id) {
    alert("Please save your profile first.");
    return;
  }

  try {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from_user_id: currentUser.id,
        to_user_id: toUserId,
        message: "I'd like to connect for a SkillSwap session."
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to send request");
    }

    alert("Request sent.");
    await loadRequests();
  } catch (err) {
    console.error(err);
    alert(err.message || "Error sending request.");
  }
}

async function loadRequests() {
  if (!currentUser?.id) return;

  try {
    const res = await fetch(`/api/requests/${currentUser.id}`);
    const requests = await res.json();

    if (!res.ok) {
      throw new Error("Failed to load requests");
    }

    renderRequests(requests);
  } catch (err) {
    console.error(err);
    showEmptyState(
      "requestsContainer",
      "⚠️",
      "Could not load requests.",
      "Please try again."
    );
  }
}

function renderRequests(requests) {
  const container = $("requestsContainer");
  if (!container) return;

  container.className = "content-area";

  if (!requests || requests.length === 0) {
    showEmptyState(
      "requestsContainer",
      "📬",
      "No requests yet.",
      "Your requests will appear here."
    );
    return;
  }

  container.innerHTML = requests.map(req => {
    const isIncoming = req.to_user_id === currentUser.id;
    const otherName = isIncoming ? req.from_name : req.to_name;

    return `
      <div class="request-card">
        <h3>${otherName}</h3>
        <p><strong>Type:</strong> ${isIncoming ? "Incoming" : "Outgoing"}</p>
        <p><strong>Status:</strong> ${req.status}</p>
        <p><strong>Message:</strong> ${req.message || "No message"}</p>
        <div class="card-actions">
          ${isIncoming && req.status === "pending" ? `
            <button class="accept-btn" onclick="updateRequestStatus(${req.id}, 'accepted')">Accept</button>
            <button class="decline-btn" onclick="updateRequestStatus(${req.id}, 'declined')">Decline</button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

async function updateRequestStatus(requestId, status) {
  try {
    const res = await fetch(`/api/requests/${requestId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to update request");
    }

    await loadRequests();
  } catch (err) {
    console.error(err);
    alert(err.message || "Error updating request.");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  showEmptyState(
    "matchesContainer",
    "🔍",
    "No matches yet.",
    "Save your profile and click Find Matches."
  );
  showEmptyState(
    "requestsContainer",
    "📬",
    "No requests yet.",
    "Your requests will appear here."
  );
});