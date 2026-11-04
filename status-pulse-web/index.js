"use strict";

const API_URL = "https://getstatus.onrender.com";
const SLIDE_COUNT = 3;
const SESSION_TOKEN_KEY = "statusPulseToken";
const SESSION_USER_KEY = "statusPulseUser";
const DASHBOARD_REFRESH_INTERVAL = 60_000;

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
let dashboardRefreshTimer = null;
let dashboardLoadInProgress = false;

let pendingInviteToken = new URLSearchParams(
  window.location.search
).get("invite");

const $ = (id) => document.getElementById(id);

/* ---------- Session persistence ---------- */

function saveSession() {
  if (!token) return;

  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    localStorage.setItem(
      SESSION_USER_KEY,
      JSON.stringify(user || {})
    );
  } catch (error) {
    console.error("Unable to save login session:", error);
  }
}

function clearSavedSession() {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
  } catch (error) {
    console.error("Unable to clear saved session:", error);
  }
}

function restoreSavedSession() {
  try {
    const savedToken = localStorage.getItem(SESSION_TOKEN_KEY);
    const savedUser = localStorage.getItem(SESSION_USER_KEY);

    if (!savedToken) return false;

    token = savedToken;

    try {
      user = savedUser ? JSON.parse(savedUser) : null;
    } catch {
      user = null;
    }

    return true;
  } catch (error) {
    console.error("Unable to restore login session:", error);
    clearSavedSession();
    return false;
  }
}

function stopDashboardPolling() {
  if (dashboardRefreshTimer !== null) {
    clearInterval(dashboardRefreshTimer);
    dashboardRefreshTimer = null;
  }
}

function startDashboardPolling() {
  stopDashboardPolling();

  dashboardRefreshTimer = setInterval(() => {
    if (
      token &&
      currentScreen === "dashboardScreen" &&
      !document.hidden
    ) {
      loadDashboard({ silent: true });
    }
  }, DASHBOARD_REFRESH_INTERVAL);
}

function expireSession() {
  stopDashboardPolling();

  token = null;
  user = null;

  clearSavedSession();

  showAuth("login");

  setMessage(
    $("authMessage"),
    "Your session has expired. Please sign in again.",
    "error"
  );
}

/* ---------- Helpers ---------- */

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
  if (!element) return;

  element.textContent = message;
  element.className = "message";
  element.style.color = type === "success" ? "var(--green)" : "";
}

/* ---------- API ---------- */

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
    throw new Error(
      "Cannot reach the API. Check that your backend is running."
    );
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

    const error = new Error(message);
    error.status = response.status;

    throw error;
  }

  return data;
}

/* ---------- Screens ---------- */

function showScreen(screen) {
  currentScreen = screen;

  ["onboarding", "authScreen", "dashboardScreen"].forEach((id) => {
    $(id).classList.toggle("hidden", id !== screen);
  });

  $("headerAction").classList.toggle(
    "hidden",
    screen !== "onboarding"
  );

  window.scrollTo(0, 0);
}

/* ---------- Onboarding ---------- */

function renderSlide() {
  document.querySelectorAll(".onboard-slide").forEach((slide) => {
    slide.classList.toggle(
      "active",
      Number(slide.dataset.slide) === currentSlide
    );
  });

  const isLast = currentSlide === SLIDE_COUNT - 1;

  $("stepCount").textContent =
    `${String(currentSlide + 1).padStart(2, "0")} / ${String(SLIDE_COUNT).padStart(2, "0")}`;

  $("progressFill").style.width =
    `${((currentSlide + 1) / SLIDE_COUNT) * 100}%`;

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

  if (!pendingInviteToken) {
    notice.classList.add("hidden");
    notice.textContent = "";
    return;
  }

  notice.textContent =
    "You have a workspace invitation. Sign in or create an account to accept it.";

  notice.classList.remove("hidden");
}

$("loginTab").addEventListener("click", () => showAuth("login"));
$("registerTab").addEventListener("click", () => showAuth("register"));
$("backToIntro").addEventListener("click", goToIntro);

async function acceptPendingInvitation() {
  if (!pendingInviteToken || !token) return;

  try {
    await api("/workspaces/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token: pendingInviteToken })
    });

    pendingInviteToken = null;

    const url = new URL(window.location.href);
    url.searchParams.delete("invite");

    window.history.replaceState({}, "", url.toString());

    setMessage(
      $("dashboardMessage"),
      "Workspace invitation accepted.",
      "success"
    );
  } catch (error) {
    setMessage(
      $("dashboardMessage"),
      `Unable to accept invitation: ${error.message}`,
      "error"
    );
  }
}

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("email").value.trim().toLowerCase();
  const password = $("password").value;
  const button = $("authSubmit");

  button.disabled = true;

  setMessage(
    $("authMessage"),
    isRegisterMode ? "Creating your account..." : "Signing in..."
  );

  try {
    const endpoint = isRegisterMode
      ? "/auth/register"
      : "/auth/login";

    let result;

    try {
      result = await api(endpoint, {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
    } catch (error) {
      if (isRegisterMode) {
        throw error;
      }

      throw error;
    }

    token =
      result.access_token ||
      result.accessToken ||
      result.token;

    user = result.user || { email };

    if (!token) {
      throw new Error(
        isRegisterMode
          ? "Registration succeeded, but login did not return an access token."
          : "Login response did not include an access token."
      );
    }

    saveSession();

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
  $("welcomeText").textContent =
    `Signed in as ${user?.email || "your account"}.`;

  showScreen("dashboardScreen");
  setView("overview");

  setMessage($("dashboardMessage"), "");

  await acceptPendingInvitation();

  if (!token) return;

  await loadDashboard();

  if (!token) return;

  await loadWorkspaces();

  if (!token) return;

  startDashboardPolling();
}

function logout() {
  stopDashboardPolling();

  token = null;
  user = null;
  projects = [];
  services = [];
  workspaces = [];
  activeWorkspaceId = null;
  activeWorkspaceRole = null;

  clearSavedSession();

  $("serviceList").innerHTML =
    '<div class="empty-state">YOUR SERVICES WILL APPEAR HERE.</div>';

  $("overviewChecks").innerHTML =
    '<div class="empty-state">NO CHECK RESULTS YET.</div>';

  $("recentChecks").innerHTML =
    '<div class="empty-state">NO CHECK RESULTS YET.</div>';

  $("memberList").innerHTML =
    '<div class="empty-state">LOADING TEAM...</div>';

  ["totalServices", "upServices", "downServices", "checkCount", "successRate"]
    .forEach((id) => {
      $(id).textContent = "—";
    });

  $("serviceCount").textContent = "0 ENDPOINTS";
  $("createProjectForm").classList.add("hidden");
  $("serviceForm").classList.add("hidden");
  $("inviteLinkWrap").classList.add("hidden");
  $("inviteLink").value = "";

  const historySearch = $("historySearch");

  if (historySearch) {
    historySearch.value = "";
  }

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
  return new Date(
    check.checkedAt || check.createdAt || 0
  ).getTime();
}

/* ---------- Monitoring formatters ---------- */

function formatHttpStatus(check) {
  return check?.statusCode != null
    ? `HTTP ${escapeHTML(check.statusCode)}`
    : "HTTP —";
}

function formatDnsTime(check) {
  return check?.dnsResolutionTime != null
    ? `${escapeHTML(check.dnsResolutionTime)} ms`
    : "—";
}

function formatSslStatus(check) {
  if (check?.sslValid === true) return "VALID";
  if (check?.sslValid === false) return "INVALID";
  return "N/A";
}

function formatSslExpiry(check) {
  if (!check?.sslExpiresAt) {
    return "Expiry unavailable";
  }

  const expiry = new Date(check.sslExpiresAt);

  if (Number.isNaN(expiry.getTime())) {
    return "Expiry unavailable";
  }

  const date = expiry.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  const remaining = Math.ceil(
    (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (remaining < 0) {
    return `Expired ${date}`;
  }

  if (remaining === 0) {
    return `Expires ${date} · Less than 1 day left`;
  }

  return `Expires ${date} · ${remaining} days left`;
}

/* ---------- Failure classification ---------- */

function classifyCheckFailure(check) {
  if (!check || check.success) return null;

  const statusCode = Number(check.statusCode);
  const rawError = String(check.error || "").trim();
  const message = rawError.toLowerCase();

  // An HTTP response means DNS, connection and TLS negotiation succeeded.
  if (Number.isFinite(statusCode) && statusCode >= 400) {
    return {
      type: "http_error",
      label: "HTTP error response",
      detail: `HTTP ${statusCode}`
    };
  }

  // DNS errors must be identified before generic connection errors.
  if (
    /\b(ENOTFOUND|EAI_AGAIN|ENODATA|ESERVFAIL|EAI_FAIL)\b/i.test(rawError) ||
    message.includes("getaddrinfo") ||
    message.includes("dns lookup") ||
    message.includes("name or service not known")
  ) {
    return {
      type: "dns_failure",
      label: "DNS resolution failure",
      detail: rawError
    };
  }

  // Connection timeouts.
  if (
    /\b(ETIMEDOUT|ESOCKETTIMEDOUT|ECONNABORTED|ABORT_ERR|ERR_SOCKET_TIMEOUT)\b/i.test(rawError) ||
    message.includes("timed out") ||
    message.includes("timeout")
  ) {
    return {
      type: "connection_timeout",
      label: "Connection timeout",
      detail: rawError
    };
  }

  // Connection refused.
  if (
    /\bECONNREFUSED\b/i.test(rawError) ||
    message.includes("connection refused")
  ) {
    return {
      type: "connection_refused",
      label: "Connection refused",
      detail: rawError
    };
  }

  // TLS and certificate errors.
  if (
    /\b(CERT_[A-Z0-9_]+|ERR_TLS_[A-Z0-9_]+|ERR_SSL_[A-Z0-9_]+|DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_VERIFY_LEAF_SIGNATURE)\b/i.test(rawError) ||
    message.includes("certificate") ||
    message.includes("tls") ||
    message.includes("ssl routines")
  ) {
    return {
      type: "tls_error",
      label: "TLS certificate error",
      detail: rawError
    };
  }

  if (rawError) {
    return {
      type: "connection_error",
      label: "Connection error",
      detail: rawError
    };
  }

  return {
    type: "check_failed",
    label: "Check failed",
    detail: "The endpoint did not pass its health check."
  };
}

function checkFailureMarkup(check, className = "activity-error") {
  const failure = classifyCheckFailure(check);

  if (!failure) return "";

  return `
    <small class="${className}" data-failure-type="${failure.type}">
      <strong>${escapeHTML(failure.label)}</strong>
      ${failure.detail ? ` — ${escapeHTML(failure.detail)}` : ""}
    </small>
  `;
}

function checkDetailsMarkup(check) {
  if (!check) return "";

  const sslStatus = formatSslStatus(check);

  const sslClass = sslStatus === "VALID"
    ? "ssl-valid"
    : sslStatus === "INVALID"
      ? "ssl-invalid"
      : "ssl-unknown";

  return `
    <div class="check-details">
      <span>${formatHttpStatus(check)}</span>
      <span>DNS ${formatDnsTime(check)}</span>
      <span class="${sslClass}">SSL ${sslStatus}</span>
      <span>${escapeHTML(formatSslExpiry(check))}</span>
    </div>
  `;
}
/* ---------- Dashboard data loading ---------- */

async function loadDashboard({ silent = false } = {}) {
  if (!token || dashboardLoadInProgress) {
    return false;
  }

  dashboardLoadInProgress = true;

  try {
    const projectData = await api("/projects");

    projects = Array.isArray(projectData)
      ? projectData
      : projectData?.projects || [];

    services = [];

    for (const project of projects) {
      try {
        const data = await api(
          `/projects/${encodeURIComponent(project.id)}/services`
        );

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
        if (error.status === 401) {
          throw error;
        }

        console.error(
          `Unable to load services for project ${project.id}:`,
          error
        );
      }
    }

    if (!token) return false;

    renderProjects();
    renderServices();
    renderHistory();
    renderMetrics();

    if (!silent) {
      setMessage($("dashboardMessage"), "");
    }

    return true;
  } catch (error) {
    if (error.status === 401) {
      expireSession();
      return false;
    }

    if (!silent) {
      setMessage(
        $("dashboardMessage"),
        error.message,
        "error"
      );
    } else {
      console.error("Automatic dashboard refresh failed:", error);
    }

    return false;
  } finally {
    dashboardLoadInProgress = false;
  }
}

/* ---------- Rendering ---------- */

function renderProjects() {
  const select = $("serviceProject");
  const previousValue = select.value;

  select.innerHTML = "";

  if (!projects.length) {
    select.innerHTML =
      '<option value="">Create a project first</option>';

    return;
  }

  for (const project of projects) {
    const option = document.createElement("option");

    option.value = project.id;
    option.textContent = project.name;

    select.appendChild(option);
  }

  if (projects.some(
    (project) => String(project.id) === previousValue
  )) {
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

    const statusClass = healthy === null
      ? "unknown"
      : healthy
        ? ""
        : "failed";

    const statusText = healthy === null
      ? "NOT CHECKED"
      : healthy
        ? "OPERATIONAL"
        : "FAILING";

    const response = latest?.responseTime != null
      ? `${escapeHTML(latest.responseTime)} MS`
      : "—";

    return `
      <article class="service-row">
        <div class="service-info">
          <strong>${escapeHTML(service.name)}</strong>
          <small>
            ${escapeHTML(service.projectName || "Project")}
            · ${escapeHTML(service.url)}
          </small>
        </div>

        <span class="service-status ${statusClass}">
          ${statusText}
        </span>

        <span class="response-value">${response}</span>

        <button
          class="check-button"
          type="button"
          data-check-service="${escapeHTML(service.id)}"
        >
          CHECK NOW ↗
        </button>

        <button
          class="delete-button"
          type="button"
          data-delete-service="${escapeHTML(service.id)}"
          aria-label="Delete ${escapeHTML(service.name)}"
        >
          DELETE
        </button>

        ${checkDetailsMarkup(latest)}
        ${checkFailureMarkup(latest, "activity-error service-error")}
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

    const when = date
      ? new Date(date).toLocaleString()
      : "Time unavailable";

    const response = check.responseTime != null
      ? ` · ${escapeHTML(check.responseTime)} ms`
      : "";

    return `
      <article class="activity-row">
        <div class="activity-name">
          ${escapeHTML(check.serviceName)}

          <small>${escapeHTML(when)}${response}</small>

          ${checkDetailsMarkup(check)}

          ${checkFailureMarkup(check)}
        </div>

        <span class="activity-result ${ok ? "" : "failed"}">
          ${ok ? "SUCCESS" : "FAILED"}
        </span>
      </article>
    `;
  }).join("");
}

/* ---------- History search ---------- */

function filterHistoryChecks(checks, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return checks;
  }

  return checks.filter((check) => {
    const result = check.success ? "success" : "failed";
    const failure = classifyCheckFailure(check);

    const searchableText = [
      check.serviceName,
      check.projectName,
      result,
      check.statusCode,
      check.error,
      failure?.label,
      failure?.type,
      check.responseTime,
      check.dnsResolutionTime
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}

function renderHistory() {
  const checks = collectChecks();

  const empty =
    '<div class="empty-state">NO CHECK RESULTS YET.</div>';

  $("overviewChecks").innerHTML = checks.length
    ? activityMarkup(checks.slice(0, 5))
    : empty;

  const historySearch = $("historySearch");
  const query = historySearch?.value || "";

  const filteredChecks = filterHistoryChecks(checks, query);

  if (!checks.length) {
    $("recentChecks").innerHTML = empty;
    return;
  }

  if (!filteredChecks.length) {
    $("recentChecks").innerHTML =
      '<div class="empty-state">NO CHECKS MATCH YOUR SEARCH.</div>';

    return;
  }

  $("recentChecks").innerHTML =
    activityMarkup(filteredChecks.slice(0, 20));
}

const historySearchInput = $("historySearch");

if (historySearchInput) {
  historySearchInput.addEventListener("input", renderHistory);
}

/* ---------- Metrics ---------- */

function renderMetrics() {
  const checks = collectChecks();
  const latestChecks = checks.slice(0, 10);

  const successes = latestChecks.filter(
    (check) => check.success
  ).length;

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

/* ---------- Services ---------- */

$("serviceList").addEventListener("click", async (event) => {
  const checkButton = event.target.closest("[data-check-service]");
  const deleteButton = event.target.closest("[data-delete-service]");

  if (checkButton) {
    const serviceId = checkButton.dataset.checkService;

    checkButton.disabled = true;
    checkButton.textContent = "CHECKING...";

    try {
      await api(
        `/services/${encodeURIComponent(serviceId)}/check`,
        { method: "POST" }
      );

      setMessage(
        $("dashboardMessage"),
        "Service check completed.",
        "success"
      );

      await loadDashboard();
    } catch (error) {
      setMessage(
        $("dashboardMessage"),
        error.message,
        "error"
      );
    } finally {
      checkButton.disabled = false;
      checkButton.textContent = "CHECK NOW ↗";
    }

    return;
  }

  if (deleteButton) {
    const serviceId = deleteButton.dataset.deleteService;

    const service = services.find(
      (item) => String(item.id) === String(serviceId)
    );

    const serviceName = service?.name || "this service";

    const confirmed = window.confirm(
      `Are you sure you want to delete "${serviceName}"?\n\nThis will also permanently delete its monitoring history.`
    );

    if (!confirmed) return;

    deleteButton.disabled = true;
    deleteButton.textContent = "DELETING...";

    try {
      await api(
        `/services/${encodeURIComponent(serviceId)}`,
        { method: "DELETE" }
      );

      setMessage(
        $("dashboardMessage"),
        "Service and its monitoring history deleted successfully.",
        "success"
      );

      await loadDashboard();
    } catch (error) {
      setMessage(
        $("dashboardMessage"),
        error.message,
        "error"
      );

      deleteButton.disabled = false;
      deleteButton.textContent = "DELETE";
    }
  }
});

/* ---------- Projects and service forms ---------- */

function openProjectForm() {
  $("serviceForm").classList.add("hidden");
  $("createProjectForm").classList.remove("hidden");

  $("projectName").focus();
}

function openServiceForm() {
  setView("services");

  $("createProjectForm").classList.add("hidden");
  $("serviceForm").classList.remove("hidden");

  if (!projects.length) {
    setMessage(
      $("dashboardMessage"),
      "Create a project before adding a service.",
      "error"
    );

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

    setMessage(
      $("dashboardMessage"),
      "Project created.",
      "success"
    );

    await loadDashboard();
  } catch (error) {
    setMessage(
      $("dashboardMessage"),
      error.message,
      "error"
    );
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
    setMessage(
      $("dashboardMessage"),
      "Create or select a project first.",
      "error"
    );

    return;
  }

  if (button) button.disabled = true;

  try {
    await api("/services", {
      method: "POST",
      body: JSON.stringify({ name, url, projectId })
    });

    $("serviceName").value = "";
    $("serviceUrl").value = "";
    $("serviceForm").classList.add("hidden");

    setMessage(
      $("dashboardMessage"),
      "Service added.",
      "success"
    );

    await loadDashboard();
  } catch (error) {
    setMessage(
      $("dashboardMessage"),
      error.message,
      "error"
    );
  } finally {
    if (button) button.disabled = false;
  }
});
/* ---------- Workspaces and team members ---------- */

async function loadWorkspaces() {
  try {
    const data = await api("/workspaces");

    workspaces = Array.isArray(data)
      ? data
      : data?.workspaces || [];

    const select = $("workspaceSelect");
    select.innerHTML = "";

    if (!workspaces.length) {
      select.innerHTML =
        '<option value="">No workspaces found</option>';

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
      option.textContent =
        workspace.name || `Workspace ${workspace.id}`;

      select.appendChild(option);
    }

    const chosen = workspaces.find((workspace) =>
      String(workspace.id) === String(activeWorkspaceId)
    ) || workspaces[0];

    activeWorkspaceId = chosen.id;
    select.value = String(chosen.id);

    await loadWorkspaceMembers();
  } catch (error) {
    if (error.status === 401) {
      expireSession();
      return;
    }

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
    const data = await api(
      `/workspaces/${encodeURIComponent(activeWorkspaceId)}/members`
    );

    const members = Array.isArray(data)
      ? data
      : data?.members || [];

    const normalized = members.map((item) => ({
      user: item.user || item.member || item,
      role: item.role || item.membership?.role || "VIEWER"
    }));

    const ownMembership = normalized.find((item) => {
      const memberId = item.user.id ?? item.user.userId;

      return user?.id != null &&
        String(memberId) === String(user.id);
    });

    const selectedWorkspace = workspaces.find(
      (workspace) =>
        String(workspace.id) === String(activeWorkspaceId)
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
        const memberEmail =
          item.user.email || item.user.name || "Workspace member";

        const isOwner =
          String(item.role).toUpperCase() === "OWNER";

        return `
          <article class="member-row">
            <div class="member-info">
              <strong>${escapeHTML(memberEmail)}</strong>
              <small>Workspace member</small>
            </div>

            <span class="member-role${isOwner ? " owner" : ""}">
              ${escapeHTML(String(item.role).toUpperCase())}
            </span>
          </article>
        `;
      }).join("");
    }

    renderTeamControls();
  } catch (error) {
    if (error.status === 401) {
      expireSession();
      return;
    }

    $("memberList").innerHTML =
      `<div class="empty-state">${escapeHTML(error.message)}</div>`;

    activeWorkspaceRole = null;

    renderTeamControls();
  }
}

function renderTeamControls() {
  const canInvite = ["OWNER", "ADMIN"].includes(
    String(activeWorkspaceRole || "").toUpperCase()
  );

  $("inviteForm").classList.toggle("hidden", !canInvite);

  if (!canInvite) {
    $("inviteLinkWrap").classList.add("hidden");
  }

  setMessage($("inviteMessage"), "");
}

$("inviteForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activeWorkspaceId) {
    setMessage(
      $("inviteMessage"),
      "Select a workspace first.",
      "error"
    );

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
      throw new Error(
        "Invitation created, but the API did not return its token."
      );
    }

    const inviteUrl = new URL(
      window.location.pathname,
      window.location.origin
    );

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
    setMessage(
      $("inviteMessage"),
      error.message,
      "error"
    );
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

      if (!copied) {
        throw new Error("Copy was blocked by the browser.");
      }
    }

    setMessage(
      $("inviteMessage"),
      "Invitation link copied.",
      "success"
    );
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

async function startApplication() {
  renderSlide();

  if (restoreSavedSession()) {
    await enterDashboard();
    return;
  }

  if (pendingInviteToken) {
    showAuth("login");
    $("email").focus();
  } else {
    showScreen("onboarding");
  }
}

startApplication();