const STORAGE_KEY = "verlofuren-planner-state-v1";
const monthFormatter = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });
const dateFormatter = new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDateFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

const defaultState = {
  organizations: [],
  entries: [],
};

let state = loadState();
let selectedDate = toDateInputValue(new Date());
let visibleMonth = startOfMonth(new Date());

const elements = {
  totalBalance: document.querySelector("#totalBalance"),
  summaryGrid: document.querySelector("#summaryGrid"),
  monthLabel: document.querySelector("#monthLabel"),
  calendarGrid: document.querySelector("#calendarGrid"),
  selectedDateLabel: document.querySelector("#selectedDateLabel"),
  entryForm: document.querySelector("#entryForm"),
  entryOrg: document.querySelector("#entryOrg"),
  entryHours: document.querySelector("#entryHours"),
  entryNote: document.querySelector("#entryNote"),
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
  render();
});

document.querySelector("#nextMonth").addEventListener("click", () => {
  visibleMonth = addMonths(visibleMonth, 1);
  render();
});

elements.entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const organizationId = elements.entryOrg.value;
  const hours = Number.parseFloat(elements.entryHours.value);
  const type = new FormData(elements.entryForm).get("entryType");
  const note = elements.entryNote.value.trim();

  if (!organizationId) {
    showToast("Voeg eerst een organisatie toe.");
    switchView("orgView");
    return;
  }

  if (!Number.isFinite(hours) || hours <= 0) {
    showToast("Vul een positief aantal uren in.");
    return;
  }

  state.entries.push({
    id: crypto.randomUUID(),
    organizationId,
    date: selectedDate,
    type,
    hours: roundHours(hours),
    note,
    createdAt: new Date().toISOString(),
  });

  saveState();
  elements.entryHours.value = "";
  elements.entryNote.value = "";
  showToast(type === "leave" ? "Verlofuren opgeslagen." : "Overuren opgeslagen.");
  render();
});

elements.orgForm.addEventListener("submit", (event) => {
  event.preventDefault();
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

  state.organizations.push({
    id: crypto.randomUUID(),
    name,
    leaveStart: roundHours(leaveStart),
    overtimeStart: roundHours(overtimeStart),
    color: elements.orgColor.value,
  });

  saveState();
  elements.orgForm.reset();
  elements.orgColor.value = "#1d8f86";
  showToast("Organisatie toegevoegd.");
  render();
});

elements.filterOrg.addEventListener("change", renderEntryList);
elements.filterType.addEventListener("change", renderEntryList);

elements.calendarGrid.addEventListener("click", (event) => {
  const dayButton = event.target.closest(".calendar-day");
  if (!dayButton) return;

  selectedDate = dayButton.dataset.date;
  visibleMonth = startOfMonth(parseLocalDate(selectedDate));
  render();
});

document.addEventListener("click", (event) => {
  const deleteEntryButton = event.target.closest("[data-delete-entry]");
  const deleteOrgButton = event.target.closest("[data-delete-org]");

  if (deleteEntryButton) {
    deleteEntry(deleteEntryButton.dataset.deleteEntry);
  }

  if (deleteOrgButton) {
    deleteOrganization(deleteOrgButton.dataset.deleteOrg);
  }
});

render();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultState);
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.organizations) || !Array.isArray(parsed.entries)) {
      return structuredClone(defaultState);
    }
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
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  renderBalances();
  renderOrgOptions();
  renderCalendar();
  renderSelectedDay();
  renderEntryList();
  renderOrganizations();
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
  const totals = state.organizations.map((org) => {
    const entries = state.entries.filter((entry) => entry.organizationId === org.id);
    return { org, ...calculateBalance(org, entries) };
  });
  const totalBalance = totals.reduce((sum, item) => sum + item.balance, 0);

  elements.totalBalance.textContent = formatHours(totalBalance);
  elements.summaryGrid.innerHTML = totals.length
    ? totals.map(({ org, balance, leaveUsed, overtimeAdded }) => `
      <article class="summary-card">
        <header>
          <span class="summary-org-name">
            <i class="color-dot" style="background:${escapeHtml(org.color)}"></i>
            ${escapeHtml(org.name)}
          </span>
          <strong class="summary-balance">${formatHours(balance)}</strong>
        </header>
        <small>${formatHours(leaveUsed)} verlof gebruikt · ${formatHours(overtimeAdded)} overuren erbij</small>
      </article>
    `).join("")
    : `<div class="empty-state">Nog geen organisaties. Voeg er een toe om te starten.</div>`;
}

function renderOrgOptions() {
  const orgOptions = state.organizations
    .map((org) => `<option value="${org.id}">${escapeHtml(org.name)}</option>`)
    .join("");
  elements.entryOrg.innerHTML = orgOptions;

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
            const isLeave = entry.type === "leave";
            const fallbackLabel = isLeave ? "Verlof" : "Overuren";
            const label = entry.note || fallbackLabel;
            const sign = isLeave ? "-" : "+";
            return `<span class="day-pill" style="background:var(--${entry.type === "leave" ? "leave" : "overtime"})"><span class="pill-note">${escapeHtml(label)}</span><span class="pill-hours">${sign}${formatHours(entry.hours)}</span></span>`;
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
    : `<div class="empty-state">Geen uren op deze dag.</div>`;
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
  elements.orgList.innerHTML = state.organizations.length
    ? state.organizations.map((org) => {
      const entries = state.entries.filter((entry) => entry.organizationId === org.id);
      const balance = calculateBalance(org, entries);
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
            <span>Saldo<strong>${formatHours(balance.balance)}</strong></span>
            <span>Start verlof<strong>${formatHours(org.leaveStart)}</strong></span>
            <span>Start overuren<strong>${formatHours(org.overtimeStart)}</strong></span>
            <span>Registraties<strong>${entries.length}</strong></span>
          </div>
        </article>
      `;
    }).join("")
    : `<div class="empty-state">Nog geen organisaties.</div>`;
}

function renderEntryItem(entry) {
  const org = state.organizations.find((item) => item.id === entry.organizationId);
  const date = parseLocalDate(entry.date);
  const isLeave = entry.type === "leave";
  const sign = isLeave ? "-" : "+";
  const title = isLeave ? "Verlof" : "Overuren";

  return `
    <article class="entry-item">
      <div>
        <p class="entry-title">${title} ${sign}${formatHours(entry.hours)}</p>
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

function deleteEntry(entryId) {
  state.entries = state.entries.filter((entry) => entry.id !== entryId);
  saveState();
  showToast("Registratie verwijderd.");
  render();
}

function deleteOrganization(orgId) {
  const hasEntries = state.entries.some((entry) => entry.organizationId === orgId);
  if (hasEntries) {
    showToast("Verwijder eerst de registraties van deze organisatie.");
    return;
  }
  state.organizations = state.organizations.filter((org) => org.id !== orgId);
  saveState();
  showToast("Organisatie verwijderd.");
  render();
}

function calculateBalance(org, entries) {
  const leaveUsed = entries
    .filter((entry) => entry.type === "leave")
    .reduce((sum, entry) => sum + entry.hours, 0);
  const overtimeAdded = entries
    .filter((entry) => entry.type === "overtime")
    .reduce((sum, entry) => sum + entry.hours, 0);
  const balance = org.leaveStart + org.overtimeStart + overtimeAdded - leaveUsed;
  return {
    leaveUsed: roundHours(leaveUsed),
    overtimeAdded: roundHours(overtimeAdded),
    balance: roundHours(balance),
  };
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

function summarizeDayEntries(entries) {
  return entries.reduce((totals, entry) => {
    totals[entry.type] += entry.hours;
    return totals;
  }, { leave: 0, overtime: 0 });
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

let toastTimeout;
function showToast(message) {
  clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2600);
}
