"use strict";

const API_URL = window.STATUS_PULSE_API_URL || "http://localhost:3000";
const SLIDE_COUNT = 3;

let token = null;
let user = null;
let projects = [];
let services = [];
let workspaces = [];
let activeWorkspaceId = null;
let activeWorkspaceRole = null;
let isRegisterMode = false;
let currentSlide = 0;
let currentScreen = "onboarding";
let currentView = "overview";
let pendingInviteToken = new URLSearchParams(window.location.search).get("invite");

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function setMessage(element, message, type = "") {
  element.textContent = message;
  element.className = "message";
  // The stylesheet only styles errors (red); successes get the accent colour.
  element.style.color = type === "success" ? "var(--green)" : "";
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });
  } catch {
    throw new Error("Cannot reach the API. Check that your backend is running.");
  }

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message || `Request failed (${response.status})`;

    throw new Error(message);
  }

  return data;
}

/* ---------- Screens ---------- */

function showScreen(screen) {
  currentScreen = screen;

  ["onboarding", "authScreen", "dashboardScreen"].forEach((id) => {
    $(id).classList.toggle("hidden", id !== screen);
  });

  // The header action only makes sense during the introduction.
  $("headerAction").classList.toggle("hidden", screen !== "onboarding");

  window.scrollTo(0, 0);
}

/* ---------- Onboarding ---------- */

function renderSlide() {
  document.querySelectorAll(".onboard-slide").forEach((slide) => {
    slide.classList.toggle("active", Number(slide.dataset.slide) === currentSlide);
  });

  const isLast = currentSlide === SLIDE_COUNT - 1;

  $("stepCount").textContent =
    `${String(currentSlide + 1).padStart(2, "0")} / ${String(SLIDE_COUNT).padStart(2, "0")}`;
  $("progressFill").style.width = `${((currentSlide + 1) / SLIDE_COUNT) * 100}%`;
  $("previousSlide").disabled = currentSlide === 0;
  $("nextSlide").innerHTML = isLast
    ? "GET STARTED <span>↗</span>"
    : "CONTINUE <span>↗</span>";
}

function goToIntro() {
  currentSlide = 0;
  renderSlide();
  showScreen("onboarding");
}

$("nextSlide").addEventListener("click", () => {
  if (currentSlide >= SLIDE_COUNT - 1) {
    showAuth("login");
    return;
  }

  currentSlide += 1;
  renderSlide();
});

$("previousSlide").addEventListener("click", () => {
  if (currentSlide === 0) return;

  currentSlide -= 1;
  renderSlide();
});

$("headerAction").addEventListener("click", () => showAuth("login"));

$("homeLink").addEventListener("click", (event) => {
  event.preventDefault();

  if (token) {
    showScreen("dashboardScreen");
    setView("overview");
  } else {
    goToIntro();
  }
});

/* ---------- Auth ---------- */

function showAuth(mode = "login") {
  isRegisterMode = mode === "register";

  $("loginTab").classList.toggle("active", !isRegisterMode);
  $("registerTab").classList.toggle("active", isRegisterMode);

  $("authTitle").innerHTML = isRegisterMode
    ? '<span>Start</span><span class="statement-second">your <span class="muted-word">workspace.</span></span>'
    : '<span>Come</span><span class="statement-second">into <span class="muted-word">focus.</span></span>';

  $("authSubmit").innerHTML = isRegisterMode
    ? "CREATE ACCOUNT <span>↗</span>"
    : "SIGN IN <span>↗</span>";

  $("password").autocomplete = isRegisterMode
    ? "new-password"
    : "current-password";

  setMessage($("authMessage"), "");
  updateInviteNotice();
  showScreen("authScreen");
}

function updateInviteNotice() {
  const notice = $("inviteNotice");

  if (pendingInviteToken) {
    notice.textContent =
      "You have a workspace invitation. Sign in or create an account using the email address the invitation was sent to.";
    notice.classList.remove("hidden");
  } else {
    notice.classList.add("hidden");
  }
}

function clearInviteFromAddressBar() {
  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

async function acceptPendingInvitation() {
  if (!pendingInviteToken) return;

  const inviteToken = pendingInviteToken;

  setMessage($("dashboardMessage"), "Accepting your workspace invitation...");

  try {
    await api("/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token: inviteToken })
    });

    pendingInviteToken = null;
    clearInviteFromAddressBar();

    setMessage($("dashboardMessage"), "Invitation accepted. Your workspace is ready.", "success");
  } catch (error) {
    setMessage(
      $("dashboardMessage"),
      `Could not accept invitation: ${error.message}`,
      "error"
    );
  }
}

$("backToIntro").addEventListener("click", goToIntro);
$("loginTab").addEventListener("click", () => showAuth("login"));
$("registerTab").addEventListener("click", () => showAuth("register"));

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("email").value.trim().toLowerCase();
  const password = $("password").value;
  const button = $("authSubmit");

  button.disabled = true;
  setMessage($("authMessage"), isRegisterMode ? "Creating account..." : "Signing in...");

  try {
    if (isRegisterMode) {
      await api("/users/register", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
    }

    // Registration creates the account; a separate login returns the JWT.
    const result = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    token = result.access_token || result.accessToken || result.token;
    user = result.user || { email };

    if (!token) {
      throw new Error(
        isRegisterMode
          ? "Registration succeeded, but login did not return an access token."
          : "Login response did not include an access token."
      );
    }

    $("password").value = "";
    setMessage($("authMessage"), "");

    await enterDashboard();
  } catch (error) {
    setMessage($("authMessage"), error.message, "error");
  } finally {
    button.disabled = false;
  }
});

/* ---------- Dashboard navigation ---------- */

function setView(view) {
  currentView = view;

  document.querySelectorAll(".dashboard-view").forEach((section) => {
    const active = section.dataset.view === view;
    section.classList.toggle("hidden", !active);
    section.classList.toggle("active", active);
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle("active", active);

    if (active) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });

  window.scrollTo(0, 0);
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.view));
});

document.querySelectorAll("[data-goto]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.goto));
});

async function enterDashboard() {
  $("welcomeText").textContent = `Signed in as ${user?.email || "your account"}.`;

  showScreen("dashboardScreen");
  setView("overview");
  setMessage($("dashboardMessage"), "");

  await acceptPendingInvitation();
  await loadDashboard();
  await loadWorkspaces();
}

function logout() {
  token = null;
  user = null;
  projects = [];
  services = [];
  workspaces = [];
  activeWorkspaceId = null;
  activeWorkspaceRole = null;

  $("serviceList").innerHTML =
    '<div class="empty-state">YOUR SERVICES WILL APPEAR HERE.</div>';
  $("overviewChecks").innerHTML =
    '<div class="empty-state">NO CHECK RESULTS YET.</div>';
  $("recentChecks").innerHTML =
    '<div class="empty-state">NO CHECK RESULTS YET.</div>';
  $("memberList").innerHTML =
    '<div class="empty-state">LOADING TEAM...</div>';

  ["totalServices", "upServices", "downServices", "checkCount", "successRate"]
    .forEach((id) => { $(id).textContent = "—"; });

  $("serviceCount").textContent = "0 ENDPOINTS";
  $("createProjectForm").classList.add("hidden");
  $("serviceForm").classList.add("hidden");
  $("inviteLinkWrap").classList.add("hidden");
  $("inviteLink").value = "";
  setMessage($("dashboardMessage"), "");

  goToIntro();
}

$("logoutButton").addEventListener("click", logout);
$("navLogout").addEventListener("click", logout);

/* ---------- Data loading ---------- */

function getChecks(service) {
  return service.checks || service.recentChecks || [];
}

function getLatestCheck(service) {
  return getChecks(service)[0] || service.latestCheck || null;
}

function checkTime(check) {
  return new Date(check.checkedAt || check.createdAt || 0).getTime();
}

async function loadDashboard() {
  try {
    const projectData = await api("/projects");
    projects = Array.isArray(projectData)
      ? projectData
      : projectData?.projects || [];

    services = [];

    for (const project of projects) {
      try {
        const data = await api(`/projects/${encodeURIComponent(project.id)}/services`);
        const projectServices = Array.isArray(data)
          ? data
          : data?.services || [];

        for (const service of projectServices) {
          services.push({
            ...service,
            projectName: project.name
          });
        }
      } catch (error) {
        console.error(`Unable to load services for project ${project.id}:`, error);
      }
    }

    renderProjects();
    renderServices();
    renderHistory();
    renderMetrics();
  } catch (error) {
    setMessage($("dashboardMessage"), error.message, "error");
  }
}

/* ---------- Rendering ---------- */

function renderProjects() {
  const select = $("serviceProject");
  const previousValue = select.value;

  select.innerHTML = "";

  if (!projects.length) {
    select.innerHTML = '<option value="">Create a project first</option>';
    return;
  }

  for (const project of projects) {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    select.appendChild(option);
  }

  if (projects.some((project) => String(project.id) === previousValue)) {
    select.value = previousValue;
  }
}

function renderServices() {
  $("serviceCount").textContent =
    `${services.length} ENDPOINT${services.length === 1 ? "" : "S"}`;

  if (!services.length) {
    $("serviceList").innerHTML =
      '<div class="empty-state">NO SERVICES YET. CREATE A PROJECT AND ADD A SERVICE.</div>';
    return;
  }

  $("serviceList").innerHTML = services.map((service) => {
    const latest = getLatestCheck(service);
    const healthy = latest ? Boolean(latest.success) : null;
    const statusClass = healthy === null ? "unknown" : healthy ? "" : "failed";
    const statusText = healthy === null ? "NOT CHECKED" : healthy ? "OPERATIONAL" : "FAILING";
    const response = latest && latest.responseTime != null
      ? `${escapeHTML(latest.responseTime)} MS`
      : "—";

    return `
      <article class="service-row">
        <div class="service-info">
          <strong>${escapeHTML(service.name)}</strong>
          <small>${escapeHTML(service.projectName || "Project")} · ${escapeHTML(service.url)}</small>
        </div>
        <span class="service-status ${statusClass}">${statusText}</span>
        <span class="response-value">${response}</span>
        <button class="check-button" type="button" data-check-service="${escapeHTML(service.id)}">CHECK NOW ↗</button>
      </article>
    `;
  }).join("");
}

function collectChecks() {
  const checks = [];

  for (const service of services) {
    for (const check of getChecks(service)) {
      checks.push({
        ...check,
        serviceName: service.name,
        projectName: service.projectName
      });
    }
  }

  checks.sort((a, b) => checkTime(b) - checkTime(a));
  return checks;
}

function activityMarkup(checks) {
  return checks.map((check) => {
    const ok = Boolean(check.success);
    const date = check.checkedAt || check.createdAt;
    const when = date ? new Date(date).toLocaleString() : "Time unavailable";
    const response = check.responseTime != null ? ` · ${check.responseTime} ms` : "";

    return `
      <article class="activity-row">
        <div class="activity-name">
          ${escapeHTML(check.serviceName)}
          <small>${escapeHTML(when)}${escapeHTML(response)}</small>
          ${check.error ? `<small>${escapeHTML(check.error)}</small>` : ""}
        </div>
        <span class="activity-result ${ok ? "" : "failed"}">${ok ? "SUCCESS" : "FAILED"}</span>
      </article>
    `;
  }).join("");
}

function renderHistory() {
  const checks = collectChecks();
  const empty = '<div class="empty-state">NO CHECK RESULTS YET.</div>';

  $("overviewChecks").innerHTML = checks.length
    ? activityMarkup(checks.slice(0, 5))
    : empty;

  $("recentChecks").innerHTML = checks.length
    ? activityMarkup(checks.slice(0, 20))
    : empty;
}

function renderMetrics() {
  const checks = collectChecks();
  const latestChecks = checks.slice(0, 10);
  const successes = latestChecks.filter((check) => check.success).length;
  const rate = latestChecks.length
    ? `${Math.round((successes / latestChecks.length) * 100)}%`
    : "—";

  let up = 0;
  let down = 0;

  for (const service of services) {
    const latest = getLatestCheck(service);
    if (!latest) continue;

    if (latest.success) up += 1;
    else down += 1;
  }

  $("totalServices").textContent = services.length;
  $("upServices").textContent = up;
  $("downServices").textContent = down;
  $("checkCount").textContent = checks.length;
  $("successRate").textContent = rate;
}

/* ---------- Services and projects ---------- */

$("serviceList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-check-service]");
  if (!button) return;

  const serviceId = button.dataset.checkService;
  button.disabled = true;
  button.textContent = "CHECKING...";

  try {
    await api(`/services/${encodeURIComponent(serviceId)}/check`, {
      method: "POST"
    });

    setMessage($("dashboardMessage"), "Service check completed.", "success");
    await loadDashboard();
  } catch (error) {
    setMessage($("dashboardMessage"), error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "CHECK NOW ↗";
  }
});

function openProjectForm() {
  $("serviceForm").classList.add("hidden");
  $("createProjectForm").classList.remove("hidden");
  $("projectName").focus();
}

function openServiceForm() {
  // Both "add service" buttons land on the Services view where the form lives.
  setView("services");
  $("createProjectForm").classList.add("hidden");
  $("serviceForm").classList.remove("hidden");

  if (!projects.length) {
    setMessage($("dashboardMessage"), "Create a project before adding a service.", "error");
    return;
  }

  setMessage($("dashboardMessage"), "");
  $("serviceName").focus();
}

$("openProjectForm").addEventListener("click", openProjectForm);
$("openServiceForm").addEventListener("click", openServiceForm);
$("openServiceFormAlt").addEventListener("click", openServiceForm);

$("cancelProject").addEventListener("click", () => {
  $("createProjectForm").classList.add("hidden");
  $("projectName").value = "";
});

$("cancelService").addEventListener("click", () => {
  $("serviceForm").classList.add("hidden");
  $("serviceName").value = "";
  $("serviceUrl").value = "";
});

$("createProjectForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("projectName").value.trim();
  const button = event.submitter;
  if (!name) return;

  if (button) button.disabled = true;

  try {
    await api("/projects", {
      method: "POST",
      body: JSON.stringify({ name })
    });

    $("projectName").value = "";
    $("createProjectForm").classList.add("hidden");
    setMessage($("dashboardMessage"), "Project created.", "success");
    await loadDashboard();
  } catch (error) {
    setMessage($("dashboardMessage"), error.message, "error");
  } finally {
    if (button) button.disabled = false;
  }
});

$("serviceForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const projectId = $("serviceProject").value;
  const name = $("serviceName").value.trim();
  const url = $("serviceUrl").value.trim();
  const button = event.submitter;

  if (!projectId) {
    setMessage($("dashboardMessage"), "Create or select a project first.", "error");
    return;
  }

  if (button) button.disabled = true;

  try {
    await api(`/projects/${encodeURIComponent(projectId)}/services`, {
      method: "POST",
      body: JSON.stringify({ name, url })
    });

    $("serviceName").value = "";
    $("serviceUrl").value = "";
    $("serviceForm").classList.add("hidden");
    setMessage($("dashboardMessage"), "Service added.", "success");
    await loadDashboard();
  } catch (error) {
    setMessage($("dashboardMessage"), error.message, "error");
  } finally {
    if (button) button.disabled = false;
  }
});

/* ---------- Workspaces and team members ---------- */

async function loadWorkspaces() {
  try {
    const data = await api("/workspaces");
    workspaces = Array.isArray(data) ? data : data?.workspaces || [];

    const select = $("workspaceSelect");
    select.innerHTML = "";

    if (!workspaces.length) {
      select.innerHTML = '<option value="">No workspaces found</option>';
      activeWorkspaceId = null;
      activeWorkspaceRole = null;
      $("teamRole").textContent = "YOUR ROLE";
      renderTeamControls();
      $("memberList").innerHTML =
        '<div class="empty-state">NO WORKSPACES AVAILABLE.</div>';
      return;
    }

    for (const workspace of workspaces) {
      const option = document.createElement("option");
      option.value = workspace.id;
      option.textContent = workspace.name || `Workspace ${workspace.id}`;
      select.appendChild(option);
    }

    const chosen = workspaces.find((workspace) =>
      String(workspace.id) === String(activeWorkspaceId)
    ) || workspaces[0];

    activeWorkspaceId = chosen.id;
    select.value = String(chosen.id);

    await loadWorkspaceMembers();
  } catch (error) {
    $("memberList").innerHTML =
      `<div class="empty-state">${escapeHTML(error.message)}</div>`;
  }
}

$("workspaceSelect").addEventListener("change", async () => {
  activeWorkspaceId = $("workspaceSelect").value || null;
  activeWorkspaceRole = null;
  $("inviteLinkWrap").classList.add("hidden");
  setMessage($("inviteMessage"), "");
  await loadWorkspaceMembers();
});

async function loadWorkspaceMembers() {
  if (!activeWorkspaceId) return;

  $("memberList").innerHTML =
    '<div class="empty-state">LOADING TEAM MEMBERS...</div>';

  try {
    const data = await api(`/workspaces/${encodeURIComponent(activeWorkspaceId)}/members`);
    const members = Array.isArray(data) ? data : data?.members || [];

    // Accept common API response shapes for memberships.
    const normalized = members.map((item) => ({
      user: item.user || item.member || item,
      role: item.role || item.membership?.role || "VIEWER"
    }));

    const ownMembership = normalized.find((item) => {
      const memberId = item.user.id ?? item.user.userId;
      return user?.id != null && String(memberId) === String(user.id);
    });

    // Fall back to the role supplied in the workspace list, if the API provides it.
    const selectedWorkspace = workspaces.find(
      (workspace) => String(workspace.id) === String(activeWorkspaceId)
    );

    activeWorkspaceRole =
      ownMembership?.role ||
      selectedWorkspace?.role ||
      selectedWorkspace?.myRole ||
      null;

    $("teamRole").textContent = activeWorkspaceRole
      ? `YOUR ROLE: ${String(activeWorkspaceRole).toUpperCase()}`
      : "MEMBERS";

    if (!normalized.length) {
      $("memberList").innerHTML =
        '<div class="empty-state">NO MEMBERS RETURNED.</div>';
    } else {
      $("memberList").innerHTML = normalized.map((item) => {
        const memberEmail = item.user.email || item.user.name || "Workspace member";
        const isOwner = String(item.role).toUpperCase() === "OWNER";

        return `
          <article class="member-row">
            <div class="member-info">
              <strong>${escapeHTML(memberEmail)}</strong>
              <small>Workspace member</small>
            </div>
            <span class="member-role${isOwner ? " owner" : ""}">${escapeHTML(String(item.role).toUpperCase())}</span>
          </article>
        `;
      }).join("");
    }

    renderTeamControls();
  } catch (error) {
    $("memberList").innerHTML =
      `<div class="empty-state">${escapeHTML(error.message)}</div>`;
    activeWorkspaceRole = null;
    renderTeamControls();
  }
}

function renderTeamControls() {
  // This is a usability hint only. The backend must enforce authorization.
  const canInvite = ["OWNER", "ADMIN"].includes(
    String(activeWorkspaceRole || "").toUpperCase()
  );

  // The invite form (including its message line) is hidden for everyone else.
  $("inviteForm").classList.toggle("hidden", !canInvite);

  if (!canInvite) {
    $("inviteLinkWrap").classList.add("hidden");
  }

  setMessage($("inviteMessage"), "");
}

$("inviteForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activeWorkspaceId) {
    setMessage($("inviteMessage"), "Select a workspace first.", "error");
    return;
  }

  const email = $("inviteEmail").value.trim().toLowerCase();
  const role = $("inviteRole").value;
  const button = $("inviteSubmit");

  button.disabled = true;
  $("inviteLinkWrap").classList.add("hidden");
  setMessage($("inviteMessage"), "Creating invitation...");

  try {
    const data = await api(
      `/workspaces/${encodeURIComponent(activeWorkspaceId)}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({ email, role })
      }
    );

    const rawToken = data?.token || data?.invitation?.token;

    if (!rawToken) {
      throw new Error("Invitation created, but the API did not return its token.");
    }

    // The URL contains the one-time token. Share it only with the intended invitee.
    const inviteUrl = new URL(window.location.pathname, window.location.origin);
    inviteUrl.searchParams.set("invite", rawToken);

    $("inviteLink").value = inviteUrl.toString();
    $("inviteLinkWrap").classList.remove("hidden");
    $("inviteEmail").value = "";

    setMessage(
      $("inviteMessage"),
      "Invitation created. Copy the link and send it to the invited person.",
      "success"
    );
  } catch (error) {
    setMessage($("inviteMessage"), error.message, "error");
  } finally {
    button.disabled = false;
  }
});

$("copyInviteLink").addEventListener("click", async () => {
  const input = $("inviteLink");
  const value = input.value;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      input.focus();
      input.select();
      const copied = document.execCommand("copy");

      if (!copied) throw new Error("Copy was blocked by the browser.");
    }

    setMessage($("inviteMessage"), "Invitation link copied.", "success");
  } catch {
    input.focus();
    input.select();
    setMessage(
      $("inviteMessage"),
      "Automatic copy failed. Select the link above and copy it manually.",
      "error"
    );
  }
});

/* ---------- Start ---------- */

renderSlide();

if (pendingInviteToken) {
  showAuth("login");
  $("email").focus();
} else {
  showScreen("onboarding");
}