let currentUser = null;

const CURRENT_USER_KEY = "skillswapCurrentUser";

function $(id) {
  return document.getElementById(id);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function capitalize(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* =========================================================
   NOTIFICATIONS
   ========================================================= */

function showToast(message, type = "success") {
  let container = document.querySelector(".toast-container");

  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("toast-visible");
  });

  window.setTimeout(() => {
    toast.classList.remove("toast-visible");

    window.setTimeout(() => {
      toast.remove();
    }, 250);
  }, 3500);
}

/* =========================================================
   CURRENT USER STORAGE
   ========================================================= */

function saveCurrentUser(user) {
  currentUser = user;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

function clearCurrentUser() {
  currentUser = null;
  localStorage.removeItem(CURRENT_USER_KEY);
}

function restoreCurrentUser() {
  const storedUser = localStorage.getItem(CURRENT_USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    currentUser = JSON.parse(storedUser);
    return currentUser;
  } catch (error) {
    console.error("Could not restore current user:", error);
    clearCurrentUser();
    return null;
  }
}

function populateProfileForm(user) {
  if (!user) return;

  if ($("name")) {
    $("name").value = user.name || "";
  }

  if ($("email")) {
    $("email").value = user.email || "";
  }

  if ($("major")) {
    $("major").value = user.major || "";
  }

  if ($("availability")) {
    $("availability").value = user.availability || "";
  }

  if ($("bio")) {
    $("bio").value = user.bio || "";
  }

  if ($("teachSkills")) {
    $("teachSkills").value = (user.teach_skills || []).join(", ");
  }

  if ($("learnSkills")) {
    $("learnSkills").value = (user.learn_skills || []).join(", ");
  }
}

/* =========================================================
   MOBILE NAVIGATION
   ========================================================= */

function setupMobileNavigation() {
  const menuButton = $("mobileMenuButton");
  const navLinks = $("navLinks");

  if (!menuButton || !navLinks) return;

  menuButton.addEventListener("click", () => {
    const menuIsOpen = navLinks.classList.toggle("open");

    menuButton.setAttribute(
      "aria-expanded",
      String(menuIsOpen)
    );

    menuButton.textContent = menuIsOpen ? "×" : "☰";
  });

  navLinks.querySelectorAll("a, button").forEach(item => {
    item.addEventListener("click", () => {
      navLinks.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.textContent = "☰";
    });
  });

  document.addEventListener("click", event => {
    const clickedInsideMenu = navLinks.contains(event.target);
    const clickedMenuButton = menuButton.contains(event.target);

    if (!clickedInsideMenu && !clickedMenuButton) {
      navLinks.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.textContent = "☰";
    }
  });
}

/* =========================================================
   EMPTY STATES
   ========================================================= */

function showEmptyState(containerId, icon, title, subtitle) {
  const container = $(containerId);

  if (!container) return;

  container.className = "content-area empty-state";

  container.innerHTML = `
    <div class="empty-icon">${escapeHTML(icon)}</div>
    <p>${escapeHTML(title)}</p>
    <span>${escapeHTML(subtitle)}</span>
  `;
}

/* =========================================================
   PROFILE
   ========================================================= */

function getProfileData() {
  return {
    name: $("name")?.value.trim() || "",
    email: $("email")?.value.trim() || "",
    major: $("major")?.value.trim() || "",
    availability: $("availability")?.value.trim() || "",
    bio: $("bio")?.value.trim() || "",

    teach_skills: ($("teachSkills")?.value || "")
      .split(",")
      .map(skill => skill.trim())
      .filter(Boolean),

    learn_skills: ($("learnSkills")?.value || "")
      .split(",")
      .map(skill => skill.trim())
      .filter(Boolean)
  };
}

function validateProfile(profile) {
  if (!profile.name) {
    showToast("Please enter your full name.", "error");
    $("name")?.focus();
    return false;
  }

  if (!profile.email) {
    showToast("Please enter your university email.", "error");
    $("email")?.focus();
    return false;
  }

  if (!profile.email.includes("@")) {
    showToast("Please enter a valid email address.", "error");
    $("email")?.focus();
    return false;
  }

  if (!profile.teach_skills.length) {
    showToast(
      "Add at least one skill you can teach.",
      "error"
    );
    $("teachSkills")?.focus();
    return false;
  }

  if (!profile.learn_skills.length) {
    showToast(
      "Add at least one skill you want to learn.",
      "error"
    );
    $("learnSkills")?.focus();
    return false;
  }

  return true;
}

async function saveProfile() {
  const profile = getProfileData();

  if (!validateProfile(profile)) {
    return;
  }

  try {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(profile)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to save profile."
      );
    }

    saveCurrentUser(data);

    showToast(
      "Your SkillSwap profile was created successfully."
    );

    await findMatches();
    await loadRequests();

    $("matchesContainer")?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  } catch (error) {
    console.error(error);

    showToast(
      error.message || "Could not save your profile.",
      "error"
    );
  }
}

/* =========================================================
   ADMIN AND DEMO TOOLS
   ========================================================= */

async function initializeApp() {
  try {
    const response = await fetch("/api/init", {
      method: "POST"
    });

    if (!response.ok) {
      throw new Error("Initialization failed.");
    }

    showToast("SkillSwap was initialized successfully.");
  } catch (error) {
    console.error(error);

    showToast(
      "SkillSwap could not be initialized.",
      "error"
    );
  }
}

async function loadDemoData() {
  try {
    const response = await fetch("/api/seed", {
      method: "POST"
    });

    if (!response.ok) {
      throw new Error("Demo data could not be loaded.");
    }

    showToast("Demo student profiles were loaded.");

    if (currentUser?.id) {
      await findMatches();
      await loadRequests();
    }
  } catch (error) {
    console.error(error);

    showToast(
      "Demo data could not be loaded.",
      "error"
    );
  }
}

async function resetDatabase() {
  const confirmed = window.confirm(
    "This will remove every profile and request. Continue?"
  );

  if (!confirmed) return;

  try {
    const response = await fetch("/api/reset", {
      method: "POST"
    });

    if (!response.ok) {
      throw new Error("Database reset failed.");
    }

    $("profileForm")?.reset();
    clearCurrentUser();

    showEmptyState(
      "matchesContainer",
      "01",
      "No recommendations yet",
      "Save your profile and select Find Matches to begin."
    );

    showEmptyState(
      "requestsContainer",
      "02",
      "No requests yet",
      "Requests will appear after you connect with another student."
    );

    showToast("The demonstration database was reset.");
  } catch (error) {
    console.error(error);

    showToast(
      "The database could not be reset.",
      "error"
    );
  }
}

/* =========================================================
   MATCHES
   ========================================================= */

async function findMatches() {
  if (!currentUser?.id) {
    showToast(
      "Create and save your profile before finding matches.",
      "error"
    );

    $("profile-section")?.scrollIntoView({
      behavior: "smooth"
    });

    return;
  }

  try {
    const response = await fetch(
      `/api/matches/${currentUser.id}`
    );

    const matches = await response.json();

    if (!response.ok) {
      if (response.status === 404) {
        clearCurrentUser();
      }

      throw new Error(
        matches.error || "Failed to load matches."
      );
    }

    renderMatches(matches);
  } catch (error) {
    console.error(error);

    showEmptyState(
      "matchesContainer",
      "!",
      "Recommendations could not be loaded",
      "Please verify that the server is running and try again."
    );

    showToast(
      error.message || "Could not load recommendations.",
      "error"
    );
  }
}

function renderSkillTags(skills, label) {
  return (skills || [])
    .map(skill => {
      return `
        <span class="tag">
          ${escapeHTML(label)}: ${escapeHTML(skill)}
        </span>
      `;
    })
    .join("");
}

function renderMatches(matches) {
  const container = $("matchesContainer");

  if (!container) return;

  container.className = "content-area";

  if (!Array.isArray(matches) || matches.length === 0) {
    showEmptyState(
      "matchesContainer",
      "01",
      "No compatible students found",
      "Try adding more skills or loading the demonstration profiles."
    );

    return;
  }

  container.innerHTML = matches
    .map(match => {
      const matchScore = Number(match.match_score || 0);

      const formattedScore = Number.isInteger(matchScore)
        ? matchScore
        : matchScore.toFixed(1);

      const teachMeTags = renderSkillTags(
        match.they_can_teach_me,
        "Can teach you"
      );

      const iTeachThemTags = renderSkillTags(
        match.i_can_teach_them,
        "You can teach"
      );

      return `
        <article class="match-card">
          <div class="match-card-header">
            <div class="match-person">
              <div class="avatar">
                ${escapeHTML(
                  match.name
                    ?.split(" ")
                    .map(part => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "SS"
                )}
              </div>

              <div>
                <h3>${escapeHTML(match.name)}</h3>

                <p class="match-major">
                  ${escapeHTML(match.major || "Major not listed")}
                </p>
              </div>
            </div>

            <span class="ai-match-score">
              ${formattedScore}% match
            </span>
          </div>

          <p>
            <strong>Availability:</strong>
            ${escapeHTML(
              match.availability || "Not provided"
            )}
          </p>

          ${
            match.bio
              ? `
                <p class="match-bio">
                  ${escapeHTML(match.bio)}
                </p>
              `
              : ""
          }

          <div class="card-tags">
            ${teachMeTags}
            ${iTeachThemTags}
          </div>

          <div class="card-actions">
            <button
              type="button"
              class="primary-btn"
              onclick="sendRequest(${Number(match.id)})"
            >
              Send Connection Request
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

/* =========================================================
   CONNECTION REQUESTS
   ========================================================= */

async function sendRequest(toUserId) {
  if (!currentUser?.id) {
    showToast(
      "Save your profile before sending a request.",
      "error"
    );

    return;
  }

  if (Number(toUserId) === Number(currentUser.id)) {
    showToast(
      "You cannot send a request to yourself.",
      "error"
    );

    return;
  }

  try {
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from_user_id: currentUser.id,
        to_user_id: toUserId,
        message:
          "I would like to connect for a SkillSwap learning session."
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to send request."
      );
    }

    showToast("Your connection request was sent.");

    await loadRequests();
  } catch (error) {
    console.error(error);

    showToast(
      error.message || "Could not send the request.",
      "error"
    );
  }
}

async function loadRequests() {
  if (!currentUser?.id) {
    showEmptyState(
      "requestsContainer",
      "02",
      "No active profile",
      "Save your profile to view connection requests."
    );

    return;
  }

  try {
    const response = await fetch(
      `/api/requests/${currentUser.id}`
    );

    const requests = await response.json();

    if (!response.ok) {
      throw new Error("Failed to load requests.");
    }

    renderRequests(requests);
  } catch (error) {
    console.error(error);

    showEmptyState(
      "requestsContainer",
      "!",
      "Requests could not be loaded",
      "Please try again."
    );
  }
}

function renderRequests(requests) {
  const container = $("requestsContainer");

  if (!container) return;

  container.className = "content-area";

  if (!Array.isArray(requests) || requests.length === 0) {
    showEmptyState(
      "requestsContainer",
      "02",
      "No requests yet",
      "Requests will appear after you connect with another student."
    );

    return;
  }

  container.innerHTML = requests
    .map(request => {
      const isIncoming =
        Number(request.to_user_id) === Number(currentUser.id);

      const otherName = isIncoming
        ? request.from_name
        : request.to_name;

      const status = request.status || "pending";

      return `
        <article class="request-card">
          <div class="request-card-header">
            <div>
              <h3>${escapeHTML(otherName)}</h3>

              <span class="request-direction">
                ${isIncoming ? "Incoming request" : "Outgoing request"}
              </span>
            </div>

            <span class="status-pill status-${escapeHTML(status)}">
              ${escapeHTML(capitalize(status))}
            </span>
          </div>

          <p>
            ${escapeHTML(
              request.message || "No message was included."
            )}
          </p>

          ${
            isIncoming && status === "pending"
              ? `
                <div class="card-actions">
                  <button
                    type="button"
                    class="accept-btn"
                    onclick="updateRequestStatus(
                      ${Number(request.id)},
                      'accepted'
                    )"
                  >
                    Accept
                  </button>

                  <button
                    type="button"
                    class="decline-btn"
                    onclick="updateRequestStatus(
                      ${Number(request.id)},
                      'declined'
                    )"
                  >
                    Decline
                  </button>
                </div>
              `
              : ""
          }
        </article>
      `;
    })
    .join("");
}

async function updateRequestStatus(requestId, status) {
  try {
    const response = await fetch(
      `/api/requests/${requestId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to update request."
      );
    }

    showToast(
      status === "accepted"
        ? "Connection request accepted."
        : "Connection request declined."
    );

    await loadRequests();
  } catch (error) {
    console.error(error);

    showToast(
      error.message || "Could not update the request.",
      "error"
    );
  }
}

/* =========================================================
   PAGE STARTUP
   ========================================================= */

window.addEventListener("DOMContentLoaded", async () => {
  setupMobileNavigation();

  showEmptyState(
    "matchesContainer",
    "01",
    "No recommendations yet",
    "Save your profile and select Find Matches to begin."
  );

  showEmptyState(
    "requestsContainer",
    "02",
    "No requests yet",
    "Requests will appear after you connect with another student."
  );

  const restoredUser = restoreCurrentUser();

  if (restoredUser?.id) {
    populateProfileForm(restoredUser);

    showToast(
      `Welcome back, ${restoredUser.name}.`
    );

    await findMatches();
    await loadRequests();
  }

  $("profileForm")?.addEventListener("submit", event => {
    event.preventDefault();
    saveProfile();
  });
});