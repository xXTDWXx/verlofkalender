import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://olntwuzkmxoyzaursdoz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XfSKuuPObdCSB6h2TchoaQ_GdUZ8ns7";
const LEGACY_STORAGE_KEY = "verlofuren-planner-state-v1";
const VOV = Object.freeze({ hours: 120, start: "2026-09-21", end: "2027-06-30" });
const ZV = Object.freeze({ days: 105, start: "2027-01-01", end: "2027-12-31" });
const ENTRY_LABELS = { leave: "Verlof", overtime: "Overuren", vov: "VOV", zv: "ZV" };

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const monthFormatter = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });
const dateFormatter = new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDateFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

const defaultState = {
  organizations: [],
  entries: [],
};

let state = structuredClone(defaultState);
let selectedDate = toDateInputValue(new Date());
let visibleMonth = startOfMonth(new Date());
let currentUser = null;
let isLoading = false;

const elements = {
  balanceLabel: document.querySelector("#balanceLabel"),
  totalBalance: document.querySelector("#totalBalance"),
  authView: document.querySelector("#authView"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authStatus: document.querySelector("#authStatus"),
  signOutButton: document.querySelector("#signOutButton"),
  userStrip: document.querySelector("#userStrip"),
  userEmail: document.querySelector("#userEmail"),
  mainTabs: document.querySelector("#mainTabs"),
  appContent: document.querySelector("#appContent"),
  summaryGrid: document.querySelector("#summaryGrid"),
  monthLabel: document.querySelector("#monthLabel"),
  calendarGrid: document.querySelector("#calendarGrid"),
  selectedDateLabel: document.querySelector("#selectedDateLabel"),
  entryForm: document.querySelector("#entryForm"),
  entryOrg: document.querySelector("#entryOrg"),
  entryHours: document.querySelector("#entryHours"),
  entryNote: document.querySelector("#entryNote"),
  vovHint: document.querySelector("#vovHint"),
  zvHint: document.querySelector("#zvHint"),
  entryQuantityLabel: document.querySelector("#entryQuantityLabel"),
  entrySubmit: document.querySelector("#entrySubmit"),
  selectedDayEntries: document.querySelector("#selectedDayEntries"),
  filterOrg: document.querySelector("#filterOrg"),
  filterType: document.querySelector("#filterType"),
  entryList: document.querySelector("#entryList"),
  orgForm: document.querySelector("#orgForm"),
  orgName: document.querySelector("#orgName"),
  orgLeaveStart: document.querySelector("#orgLeaveStart"),
  orgOvertimeStart: document.querySelector("#orgOvertimeStart"),
  orgColor: document.querySelector("#orgColor"),
  orgList: document.querySelector("#orgList"),
  toast: document.querySelector("#toast"),
};

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

document.querySelector("#prevMonth").addEventListener("click", () => {
  visibleMonth = addMonths(visibleMonth, -1);
  selectedDate = toDateInputValue(visibleMonth);
  render();
});

document.querySelector("#nextMonth").addEventListener("click", () => {
  visibleMonth = addMonths(visibleMonth, 1);
  selectedDate = toDateInputValue(visibleMonth);
  render();
});

elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await signIn();
});

elements.signOutButton.addEventListener("click", async () => {
  setBusy(true, "Uitloggen...");
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showAuthStatus("Uitloggen mislukt: " + error.message, true);
    setBusy(false);
    return;
  }
  await applySession(null);
});

elements.entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await createEntry();
});

elements.orgForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await createOrganization();
});

elements.filterOrg.addEventListener("change", renderEntryList);
elements.filterType.addEventListener("change", renderEntryList);
elements.entryForm.addEventListener("change", renderAllowanceHints);

elements.calendarGrid.addEventListener("click", (event) => {
  const dayButton = event.target.closest(".calendar-day");
  if (!dayButton) return;

  selectedDate = dayButton.dataset.date;
  visibleMonth = startOfMonth(parseLocalDate(selectedDate));
  render();
});

document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-plan-zv]")) {
    selectedDate = isZvDate(selectedDate) ? selectedDate : ZV.start;
    visibleMonth = startOfMonth(parseLocalDate(selectedDate));
    elements.entryForm.querySelector('[value="zv"]').checked = true;
    elements.entryHours.value = "";
    switchView("calendarView");
    render();
    elements.entrySubmit.focus();
    return;
  }
  const deleteEntryButton = event.target.closest("[data-delete-entry]");
  const deleteOrgButton = event.target.closest("[data-delete-org]");

  if (deleteEntryButton) {
    await deleteEntry(deleteEntryButton.dataset.deleteEntry);
  }

  if (deleteOrgButton) {
    await deleteOrganization(deleteOrgButton.dataset.deleteOrg);
  }
});

initialize();

async function initialize() {
  setBusy(true, "Sessie controleren...");
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showAuthStatus(error.message, true);
  }

  await applySession(data?.session || null);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    applySession(session);
  });
}

async function applySession(session) {
  currentUser = session?.user || null;
  document.body.classList.toggle("is-authenticated", Boolean(currentUser));
  document.body.classList.toggle("is-signed-out", !currentUser);
  elements.authView.classList.toggle("hidden", Boolean(currentUser));
  elements.appContent.classList.toggle("hidden", !currentUser);
  elements.mainTabs.classList.toggle("hidden", !currentUser);
  elements.userStrip.classList.toggle("hidden", !currentUser);
  elements.userEmail.textContent = currentUser?.email || "";

  if (!currentUser) {
    state = structuredClone(defaultState);
    elements.totalBalance.textContent = "0u";
    render();
    setBusy(false);
    return;
  }

  await loadRemoteData();
}

async function signIn() {
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  setBusy(true, "Inloggen...");

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showAuthStatus("Inloggen mislukt: " + error.message, true);
    setBusy(false);
    return;
  }

  elements.authPassword.value = "";
  showAuthStatus("");
}

async function loadRemoteData() {
  if (!currentUser) return;
  setBusy(true, "Gegevens laden...");

  const [organizationsResult, entriesResult] = await Promise.all([
    supabaseClient
      .from("organizations")
      .select("id,name,leave_start,annual_leave_hours,overtime_start,color,created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: true }),
    supabaseClient
      .from("entries")
      .select("id,organization_id,entry_date,entry_type,hours,days,note,created_at")
      .eq("user_id", currentUser.id)
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (organizationsResult.error || entriesResult.error) {
    const message = organizationsResult.error?.message || entriesResult.error?.message;
    showToast("Supabase kon de gegevens niet laden.");
    showAuthStatus("Controleer of de tabellen en policies zijn aangemaakt. Fout: " + message, true);
    setBusy(false);
    return;
  }

  state = {
    organizations: organizationsResult.data.map(mapOrganizationFromDb),
    entries: entriesResult.data.map(mapEntryFromDb),
  };

  maybeOfferLocalImport();
  render();
  setBusy(false);
}

async function createOrganization() {
  if (!currentUser || isLoading) return;

  const name = elements.orgName.value.trim();
  const leaveStart = Number.parseFloat(elements.orgLeaveStart.value);
  const overtimeStart = Number.parseFloat(elements.orgOvertimeStart.value);

  if (!name) {
    showToast("Vul een organisatienaam in.");
    return;
  }

  if (!Number.isFinite(leaveStart) || !Number.isFinite(overtimeStart)) {
    showToast("Vul geldige beginsaldi in.");
    return;
  }

  setBusy(true, "Organisatie opslaan...");
  const { data, error } = await supabaseClient
    .from("organizations")
    .insert({
      user_id: currentUser.id,
      name,
      leave_start: roundHours(leaveStart),
      overtime_start: roundHours(overtimeStart),
      color: elements.orgColor.value,
    })
    .select("id,name,leave_start,annual_leave_hours,overtime_start,color,created_at")
    .single();

  if (error) {
    showToast("Organisatie opslaan mislukt.");
    showAuthStatus(error.message, true);
    setBusy(false);
    return;
  }

  state.organizations.push(mapOrganizationFromDb(data));
  elements.orgForm.reset();
  elements.orgColor.value = "#1d8f86";
  showToast("Organisatie toegevoegd.");
  render();
  setBusy(false);
}

async function createEntry() {
  if (!currentUser || isLoading) return;

  const organizationId = elements.entryOrg.value;
  const type = new FormData(elements.entryForm).get("entryType");
  const hours = Number.parseFloat(elements.entryHours.value);
  const note = elements.entryNote.value.trim();

  if (!organizationId) {
    showToast("Voeg eerst een organisatie toe.");
    switchView("orgView");
    return;
  }

  if (type !== "zv" && (!Number.isFinite(hours) || hours <= 0)) {
    showToast("Vul een positief aantal uren in.");
    return;
  }

  if (!Object.hasOwn(ENTRY_LABELS, type)) return;
  if (type === "vov") {
    if (!isVovDate(selectedDate)) {
      showToast("VOV is enkel geldig van 21/09/2026 t.e.m. 30/06/2027.");
      return;
    }
    if (roundHours(hours) > getVovBalance().remaining) {
      showToast(`Onvoldoende VOV-saldo. Nog ${formatHours(getVovBalance().remaining)} over.`);
      return;
    }
  }

  if (type === "zv") {
    if (!isZvDate(selectedDate)) {
      showToast("ZV is enkel geldig van 01/01/2027 t.e.m. 31/12/2027.");
      return;
    }
    if (getZvBalance().remaining < 1) {
      showToast(`Onvoldoende ZV-saldo. Nog ${formatDays(getZvBalance().remaining)} over.`);
      return;
    }
    if (getZvDayRemaining(selectedDate) < 1) {
      showToast("Je kunt maximaal 1 dag ZV per kalenderdag inplannen.");
      return;
    }
  }

  setBusy(true, type === "zv" ? "ZV opslaan..." : "Uren opslaan...");
  const { data, error } = await supabaseClient
    .from("entries")
    .insert({
      user_id: currentUser.id,
      organization_id: organizationId,
      entry_date: selectedDate,
      entry_type: type,
      hours: type === "zv" ? 0 : roundHours(hours),
      days: type === "zv" ? 1 : null,
      note,
    })
    .select("id,organization_id,entry_date,entry_type,hours,days,note,created_at")
    .single();

  if (error) {
    showToast("Uren opslaan mislukt.");
    if (type === "vov" || type === "zv") {
      await loadRemoteData();
      const label = ENTRY_LABELS[type];
      showToast(error.message.includes(label) ? error.message : `${label} opslaan mislukt. Probeer opnieuw.`);
      return;
    }
    showAuthStatus(error.message, true);
    setBusy(false);
    return;
  }

  state.entries.push(mapEntryFromDb(data));
  elements.entryHours.value = "";
  elements.entryNote.value = "";
  showToast(type === "zv" ? "ZV-dag opgeslagen." : type === "vov" ? "VOV-uren opgeslagen." : type === "leave" ? "Verlofuren opgeslagen." : "Overuren opgeslagen.");
  render();
  setBusy(false);
}

async function deleteEntry(entryId) {
  if (!currentUser || isLoading) return;

  setBusy(true, "Registratie verwijderen...");
  const { error } = await supabaseClient
    .from("entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", currentUser.id);

  if (error) {
    showToast("Registratie verwijderen mislukt.");
    showAuthStatus(error.message, true);
    setBusy(false);
    return;
  }

  state.entries = state.entries.filter((entry) => entry.id !== entryId);
  showToast("Registratie verwijderd.");
  render();
  setBusy(false);
}

async function deleteOrganization(orgId) {
  if (!currentUser || isLoading) return;

  const hasEntries = state.entries.some((entry) => entry.organizationId === orgId);
  if (hasEntries) {
    showToast("Verwijder eerst de registraties van deze organisatie.");
    return;
  }

  setBusy(true, "Organisatie verwijderen...");
  const { error } = await supabaseClient
    .from("organizations")
    .delete()
    .eq("id", orgId)
    .eq("user_id", currentUser.id);

  if (error) {
    showToast("Organisatie verwijderen mislukt.");
    showAuthStatus(error.message, true);
    setBusy(false);
    return;
  }

  state.organizations = state.organizations.filter((org) => org.id !== orgId);
  showToast("Organisatie verwijderd.");
  render();
  setBusy(false);
}

function render() {
  renderBalances();
  renderOrgOptions();
  renderCalendar();
  renderSelectedDay();
  renderEntryList();
  renderOrganizations();
  renderAllowanceHints();
}

function switchView(viewId) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewId);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
}

function renderBalances() {
  const year = visibleMonth.getFullYear();
  elements.balanceLabel.textContent = `Saldo verlof + overuren · ${year}`;
  const totals = state.organizations.map((org) => {
    const entries = state.entries.filter((entry) => entry.organizationId === org.id);
    return { org, ...calculateBalance(org, entries, year) };
  });
  const totalBalance = totals.reduce((sum, item) => sum + item.balance, 0);

  elements.totalBalance.textContent = formatHours(totalBalance);
  elements.summaryGrid.innerHTML = totals.length
    ? totals.map(({ org, balance, leaveStart, leaveUsed, overtimeAdded }) => `
      <article class="summary-card">
        <header>
          <span class="summary-org-name">
            <i class="color-dot" style="background:${escapeHtml(org.color)}"></i>
            ${escapeHtml(org.name)}
          </span>
          <strong class="summary-balance">${formatHours(balance)}</strong>
        </header>
        <small>${year} · ${formatHours(leaveUsed)} van ${formatHours(leaveStart)} verlof ingepland / opgenomen &middot; ${formatHours(overtimeAdded)} overuren erbij</small>
      </article>
    `).join("")
    : `<div class="empty-state">Nog geen organisaties. Voeg er een toe om te starten.</div>`;

  if (currentUser) {
    const { used, remaining } = getVovBalance();
    const today = toDateInputValue(new Date());
    const expired = today > VOV.end;
    elements.summaryGrid.insertAdjacentHTML("beforeend", `
      <article class="summary-card vov-card">
        <header><span class="summary-org-name">VOV</span><strong class="summary-balance">${formatHours(expired ? 0 : remaining)}</strong></header>
        <small>Vlaams opleidingsverlof · ${formatHours(used)} van ${formatHours(VOV.hours)} ingepland / opgenomen</small>
        <small>21/09/2026 t.e.m. 30/06/2027</small>
        <small>${expired ? `Verlopen · ${formatHours(remaining)} niet gebruikt` : today < VOV.start ? "Beschikbaar vanaf 21/09/2026 · nu al inplanbaar" : "Resterend voor deze opleidingsperiode"}</small>
      </article>
    `);
    const zv = getZvBalance();
    const zvExpired = today > ZV.end;
    elements.summaryGrid.insertAdjacentHTML("beforeend", `
      <article class="summary-card zv-card">
        <header><span class="summary-org-name">ZV · 2027</span><strong class="summary-balance">${formatDays(zvExpired ? 0 : zv.remaining)}</strong></header>
        <small>${formatDays(zv.used)} van ${formatDays(ZV.days)} ingepland / opgenomen</small>
        <small>01/01/2027 t.e.m. 31/12/2027</small>
        <small>${zvExpired ? `Verlopen · ${formatDays(zv.remaining)} niet gebruikt` : today < ZV.start ? "Beschikbaar in 2027 · nu al inplanbaar" : "Resterend voor 2027"}</small>
        ${zvExpired ? "" : '<button class="ghost-button" type="button" data-plan-zv>Plan ZV in 2027</button>'}
      </article>
    `);
  }
}

function renderOrgOptions() {
  const orgOptions = state.organizations
    .map((org) => `<option value="${org.id}">${escapeHtml(org.name)}</option>`)
    .join("");
  const previousOrg = elements.entryOrg.value;
  elements.entryOrg.innerHTML = orgOptions;
  if (state.organizations.some((org) => org.id === previousOrg)) elements.entryOrg.value = previousOrg;

  const previousFilter = elements.filterOrg.value || "all";
  elements.filterOrg.innerHTML = `<option value="all">Alle organisaties</option>${orgOptions}`;
  elements.filterOrg.value = state.organizations.some((org) => org.id === previousFilter) ? previousFilter : "all";
}

function renderCalendar() {
  elements.monthLabel.textContent = capitalize(monthFormatter.format(visibleMonth));
  const days = getCalendarDays(visibleMonth);

  elements.calendarGrid.innerHTML = days.map((day) => {
    const dateKey = toDateInputValue(day);
    const entries = state.entries
      .filter((entry) => entry.date === dateKey)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const isOutside = day.getMonth() !== visibleMonth.getMonth();
    const isSelected = dateKey === selectedDate;
    const isToday = dateKey === toDateInputValue(new Date());
    const visibleEntries = entries.slice(0, 3);
    const hiddenCount = entries.length - visibleEntries.length;

    return `
      <button class="calendar-day ${isOutside ? "outside" : ""} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}" type="button" data-date="${dateKey}" aria-label="${dateFormatter.format(day)}">
        <span class="date-number">${day.getDate()}</span>
        <span class="day-totals">
          ${visibleEntries.map((entry) => {
            const fallbackLabel = ENTRY_LABELS[entry.type];
            const label = (entry.type === "vov" || entry.type === "zv") ? `${fallbackLabel}${entry.note ? ` · ${entry.note}` : ""}` : entry.note || fallbackLabel;
            const sign = entry.type === "overtime" ? "+" : "-";
            return `<span class="day-pill" style="background:var(--${entry.type})"><span class="pill-note">${escapeHtml(label)}</span><span class="pill-hours">${sign}${formatEntryQuantity(entry)}</span></span>`;
          }).join("")}
          ${hiddenCount > 0 ? `<span class="day-more">+${hiddenCount} meer</span>` : ""}
        </span>
      </button>
    `;
  }).join("");
}

function renderSelectedDay() {
  const date = parseLocalDate(selectedDate);
  const entries = getEntriesForDate(selectedDate);
  elements.selectedDateLabel.textContent = capitalize(dateFormatter.format(date));
  elements.selectedDayEntries.innerHTML = entries.length
    ? entries.map(renderEntryItem).join("")
    : `<div class="empty-state">Geen registraties op deze dag.</div>`;
}

function renderEntryList() {
  const orgFilter = elements.filterOrg.value || "all";
  const typeFilter = elements.filterType.value || "all";
  const filtered = state.entries
    .filter((entry) => orgFilter === "all" || entry.organizationId === orgFilter)
    .filter((entry) => typeFilter === "all" || entry.type === typeFilter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  elements.entryList.innerHTML = filtered.length
    ? filtered.map(renderEntryItem).join("")
    : `<div class="empty-state">Nog geen registraties voor deze selectie.</div>`;
}

function renderOrganizations() {
  const year = visibleMonth.getFullYear();
  elements.orgList.innerHTML = state.organizations.length
    ? state.organizations.map((org) => {
      const entries = state.entries.filter((entry) => entry.organizationId === org.id);
      const balance = calculateBalance(org, entries, year);
      const hasEntries = entries.length > 0;
      return `
        <article class="org-item">
          <header>
            <div class="org-name">
              <i class="color-dot" style="background:${escapeHtml(org.color)}"></i>
              <span>${escapeHtml(org.name)}</span>
            </div>
            <button class="danger-button" type="button" data-delete-org="${org.id}" ${hasEntries ? "disabled title='Verwijder eerst de registraties'" : ""}>Verwijderen</button>
          </header>
          <div class="org-stats">
            <span>Saldo ${year}<strong>${formatHours(balance.balance)}</strong></span>
            <span>Start verlof<strong>${formatHours(balance.leaveStart)}</strong></span>
            <span>Start overuren<strong>${formatHours(balance.overtimeStart)}</strong></span>
            <span>Registraties alle jaren<strong>${entries.length}</strong></span>
          </div>
        </article>
      `;
    }).join("")
    : `<div class="empty-state">Nog geen organisaties.</div>`;
}

function renderEntryItem(entry) {
  const org = state.organizations.find((item) => item.id === entry.organizationId);
  const date = parseLocalDate(entry.date);
  const sign = entry.type === "overtime" ? "+" : "-";
  const title = ENTRY_LABELS[entry.type];

  return `
    <article class="entry-item">
      <div>
        <p class="entry-title">${title} ${sign}${formatEntryQuantity(entry)}</p>
        <div class="entry-meta">
          <span class="type-badge ${entry.type}">${title}</span>
          <span>${shortDateFormatter.format(date)}</span>
          <span>${escapeHtml(org?.name || "Onbekende organisatie")}</span>
          ${entry.note ? `<span>${escapeHtml(entry.note)}</span>` : ""}
        </div>
      </div>
      <button class="ghost-button" type="button" data-delete-entry="${entry.id}">Verwijderen</button>
    </article>
  `;
}

function maybeOfferLocalImport() {
  const legacyState = readLegacyState();
  if (!legacyState || legacyState.organizations.length === 0 || state.organizations.length > 0) return;

  elements.summaryGrid.innerHTML = `
    <div class="empty-state">
      Lokale gegevens gevonden op dit toestel.
      <button class="ghost-button" type="button" id="importLocalButton">Importeer naar Supabase</button>
    </div>
  `;
  document.querySelector("#importLocalButton")?.addEventListener("click", importLegacyState);
}

async function importLegacyState() {
  const legacyState = readLegacyState();
  if (!legacyState || !currentUser) return;

  setBusy(true, "Lokale gegevens importeren...");
  const orgIdMap = new Map();

  for (const org of legacyState.organizations) {
    const { data, error } = await supabaseClient
      .from("organizations")
      .insert({
        user_id: currentUser.id,
        name: org.name,
        leave_start: org.leaveStart,
        overtime_start: org.overtimeStart,
        color: org.color || "#1d8f86",
      })
      .select("id")
      .single();

    if (error) {
      showToast("Importeren mislukt.");
      showAuthStatus(error.message, true);
      setBusy(false);
      return;
    }
    orgIdMap.set(org.id, data.id);
  }

  const entries = legacyState.entries
    .filter((entry) => orgIdMap.has(entry.organizationId))
    .map((entry) => ({
      user_id: currentUser.id,
      organization_id: orgIdMap.get(entry.organizationId),
      entry_date: entry.date,
      entry_type: entry.type,
      hours: entry.hours,
      note: entry.note || "",
      created_at: entry.createdAt || new Date().toISOString(),
    }));

  if (entries.length) {
    const { error } = await supabaseClient.from("entries").insert(entries);
    if (error) {
      showToast("Importeren van registraties mislukt.");
      showAuthStatus(error.message, true);
      setBusy(false);
      return;
    }
  }

  localStorage.removeItem(LEGACY_STORAGE_KEY);
  showToast("Lokale gegevens geimporteerd.");
  await loadRemoteData();
}

function readLegacyState() {
  try {
    const saved = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.organizations) || !Array.isArray(parsed.entries)) return null;
    parsed.organizations = parsed.organizations.filter((org) => {
      const isUnusedExample =
        org.name === "Mijn organisatie" &&
        Number(org.leaveStart) === 160 &&
        Number(org.overtimeStart) === 0 &&
        !parsed.entries.some((entry) => entry.organizationId === org.id);
      return !isUnusedExample;
    });
    return parsed;
  } catch {
    return null;
  }
}

function mapOrganizationFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    leaveStart: Number(row.leave_start),
    annualLeaveHours: row.annual_leave_hours == null ? null : Number(row.annual_leave_hours),
    overtimeStart: Number(row.overtime_start),
    color: row.color || "#1d8f86",
    createdAt: row.created_at,
  };
}

function mapEntryFromDb(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    date: row.entry_date,
    type: row.entry_type,
    hours: Number(row.hours),
    days: row.days == null ? null : Number(row.days),
    note: row.note || "",
    createdAt: row.created_at,
  };
}

function calculateBalance(org, entries, year) {
  const firstYear = Number(org.createdAt.slice(0, 4));
  const yearEntries = entries.filter((entry) => entry.date.startsWith(year + "-"));
  const leaveStart = year < firstYear ? 0
    : year === firstYear ? org.leaveStart : (org.annualLeaveHours ?? org.leaveStart);
  const overtimeStart = year === firstYear ? org.overtimeStart : 0;
  const leaveUsed = yearEntries
    .filter((entry) => entry.type === "leave")
    .reduce((sum, entry) => sum + entry.hours, 0);
  const overtimeAdded = yearEntries
    .filter((entry) => entry.type === "overtime")
    .reduce((sum, entry) => sum + entry.hours, 0);
  const balance = leaveStart + overtimeStart + overtimeAdded - leaveUsed;
  return {
    leaveStart,
    overtimeStart,
    leaveUsed: roundHours(leaveUsed),
    overtimeAdded: roundHours(overtimeAdded),
    balance: roundHours(balance),
  };
}

function isVovDate(date) {
  return date >= VOV.start && date <= VOV.end;
}

function getVovBalance() {
  const used = roundHours(state.entries
    .filter((entry) => entry.type === "vov" && isVovDate(entry.date))
    .reduce((sum, entry) => sum + entry.hours, 0));
  return { used, remaining: roundHours(VOV.hours - used) };
}

function renderAllowanceHints() {
  const type = new FormData(elements.entryForm).get("entryType");
  const isVov = type === "vov";
  const isZv = type === "zv";
  const previousUnit = elements.entryHours.dataset.unit;
  const unit = isZv ? "days" : "hours";
  if (previousUnit && previousUnit !== unit) elements.entryHours.value = "";
  elements.entryHours.dataset.unit = unit;
  elements.entryHours.readOnly = isZv;
  if (isZv) elements.entryHours.value = "1";
  elements.entryQuantityLabel.textContent = isZv ? "Dagen" : "Uren";
  elements.entryHours.placeholder = isZv ? "1" : "8";
  elements.entrySubmit.textContent = isZv ? "ZV opslaan" : "Uren opslaan";
  elements.zvHint.classList.toggle("hidden", !isZv);
  elements.zvHint.textContent = isZvDate(selectedDate)
    ? `ZV · nog ${formatDays(getZvBalance().remaining)} van 105 dagen. Elke gekozen datum telt als één volledige ZV-dag.`
    : "ZV is enkel geldig van 01/01/2027 t.e.m. 31/12/2027. Selecteer een dag in 2027; je kunt nu al inplannen.";
  elements.vovHint.classList.toggle("hidden", !isVov);
  elements.vovHint.textContent = isVovDate(selectedDate)
    ? `Vlaams opleidingsverlof · nog ${formatHours(getVovBalance().remaining)} van 120u. Geldig t.e.m. 30/06/2027.`
    : "VOV is enkel geldig van 21/09/2026 t.e.m. 30/06/2027. Selecteer een dag binnen deze periode.";
  if (isZv) elements.entryHours.max = 1;
  else if (isVov) elements.entryHours.max = Math.max(0, getVovBalance().remaining);
  else elements.entryHours.removeAttribute("max");
}

function isZvDate(date) {
  return date >= ZV.start && date <= ZV.end;
}

function getZvBalance() {
  const used = roundHours(state.entries
    .filter((entry) => entry.type === "zv" && isZvDate(entry.date))
    .reduce((sum, entry) => sum + entry.days, 0));
  return { used, remaining: roundHours(ZV.days - used) };
}

function getZvDayRemaining(date) {
  return roundHours(1 - state.entries
    .filter((entry) => entry.type === "zv" && entry.date === date)
    .reduce((sum, entry) => sum + entry.days, 0));
}

function formatDays(value) {
  return `${roundHours(value).toLocaleString("nl-NL", { maximumFractionDigits: 2 })} ${value === 1 ? "dag" : "dagen"}`;
}

function formatEntryQuantity(entry) {
  return entry.type === "zv" ? formatDays(entry.days) : formatHours(entry.hours);
}

function getCalendarDays(monthDate) {
  const first = startOfMonth(monthDate);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function getEntriesForDate(dateKey) {
  return state.entries
    .filter((entry) => entry.date === dateKey)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function roundHours(value) {
  return Math.round(value * 100) / 100;
}

function formatHours(value) {
  return `${roundHours(value).toLocaleString("nl-NL", { maximumFractionDigits: 2 })}u`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setBusy(busy, message = "") {
  isLoading = busy;
  document.body.classList.toggle("is-loading", busy);
  elements.authStatus.textContent = message;
  document.querySelectorAll("button, input, select").forEach((element) => {
    if (element.id === "signOutButton") return;
    element.disabled = busy;
  });
}

function showAuthStatus(message, isError = false) {
  elements.authStatus.textContent = message;
  elements.authStatus.classList.toggle("error", isError);
}

let toastTimeout;
function showToast(message) {
  clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2600);
}

