const STORAGE_KEYS = {
  START_TIME: "semoga_berhenti_start_time_v1",
  BEST_RECORD: "semoga_berhenti_best_record_v1",
  NOTES: "semoga_berhenti_notes_v1"
};

const DEFAULT_START_ISO = "2026-11-19T15:30:00+07:00";
const BASE_RECORD_DAYS = 7;
const TARGET_HOURS = 192;
const TARGET_MS = TARGET_HOURS * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const MILESTONE_DAYS = [1, 3, 7, 8, 14, 30];

const PHYSICAL_SUGGESTIONS = [
  "Push-up 15 kali sekarang",
  "Cuci muka pakai air dingin",
  "Minum segelas air putih dan jalan keluar kamar",
  "Tarik napas dalam selama 2 menit",
  "Stretching ringan atau squat 20 kali",
  "Jalan kaki cepat selama 3 menit"
];

let startTimeMs = loadStartTime();
let bestRecordDays = loadBestRecord();
let notes = loadNotes();

let emergencyInterval = null;
let remainingEmergencySec = 300;
let lastSuggestionIndex = -1;

function loadStartTime() {
  const saved = localStorage.getItem(STORAGE_KEYS.START_TIME);
  if (saved) {
    const parsed = Number(saved);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  const initial = new Date(DEFAULT_START_ISO).getTime();
  localStorage.setItem(STORAGE_KEYS.START_TIME, String(initial));
  return initial;
}

function loadBestRecord() {
  const saved = localStorage.getItem(STORAGE_KEYS.BEST_RECORD);
  if (saved) {
    const parsed = Number(saved);
    if (!Number.isNaN(parsed) && parsed >= BASE_RECORD_DAYS) return parsed;
  }
  localStorage.setItem(STORAGE_KEYS.BEST_RECORD, String(BASE_RECORD_DAYS));
  return BASE_RECORD_DAYS;
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTES);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
}

function formatTwoDigits(num) {
  return String(Math.max(0, Math.floor(num))).padStart(2, "0");
}

function formatIndonesianDateTime(ms) {
  const formatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return `${formatter.format(new Date(ms)).replace(".", ":")} WIB`;
}

function getStatusMessage(days) {
  if (days <= 0) {
    return "Fokus lewati 24 jam pertama sampai besok pukul 15:30.";
  }
  if (days >= 1 && days <= 6) {
    return `Sudah ${days} hari bertahan. Jaga fokus dan hindari pemicu!`;
  }
  if (days === 7) {
    return "Hari ke-7! Waspada titik rawan, sedikit lagi tembus rekor baru.";
  }
  return "Rekor baru terpecahkan! Terus pertahankan konsistensimu.";
}

function renderMilestones(elapsedMs) {
  const grid = document.getElementById("milestonesGrid");
  const countLabel = document.getElementById("milestoneCountLabel");
  let activeCount = 0;

  grid.innerHTML = MILESTONE_DAYS.map((day) => {
    const isActive = elapsedMs >= day * DAY_MS;
    if (isActive) activeCount++;
    return `
      <div class="milestone ${isActive ? "active" : ""}">
        <div class="milestone-day">${day} Hari</div>
        <div class="milestone-state">${isActive ? "Tercapai" : "Terkunci"}</div>
      </div>
    `;
  }).join("");

  countLabel.textContent = `${activeCount} / ${MILESTONE_DAYS.length} Aktif`;
}

function renderNotes() {
  const list = document.getElementById("notesList");
  const countLabel = document.getElementById("notesCountLabel");
  countLabel.textContent = `${notes.length} Catatan`;

  if (notes.length === 0) {
    list.innerHTML = `<div class="empty-notes">Belum ada catatan harian. Tulis evaluasi singkatmu di atas.</div>`;
    return;
  }

  list.innerHTML = notes
    .map(
      (note) => `
      <div class="note-item">
        <div>
          <div class="note-content">${escapeHtml(note.text)}</div>
          <div class="note-date">${escapeHtml(note.dateLabel)}</div>
        </div>
        <button type="button" class="btn-delete" data-id="${note.id}">Hapus</button>
      </div>
    `
    )
    .join("");
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updateTracker() {
  const now = Date.now();
  const elapsedMs = Math.max(0, now - startTimeMs);

  const totalSeconds = Math.floor(elapsedMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const totalHoursExact = (elapsedMs / (1000 * 60 * 60)).toFixed(1);

  document.getElementById("daysVal").textContent = formatTwoDigits(days);
  document.getElementById("hoursVal").textContent = formatTwoDigits(hours);
  document.getElementById("minutesVal").textContent = formatTwoDigits(minutes);
  document.getElementById("secondsVal").textContent = formatTwoDigits(seconds);
  document.getElementById("totalHoursLabel").textContent = `${totalHoursExact} jam berjalan`;

  document.getElementById("statusMessage").textContent = getStatusMessage(days);

  if (days > bestRecordDays) {
    bestRecordDays = days;
    localStorage.setItem(STORAGE_KEYS.BEST_RECORD, String(bestRecordDays));
  }

  const recordLabel = document.getElementById("recordLabel");
  if (bestRecordDays > BASE_RECORD_DAYS) {
    recordLabel.textContent = `Rekor Sebelumnya: 7 Hari (Rekor Baru: ${bestRecordDays} Hari)`;
  } else {
    recordLabel.textContent = "Rekor Sebelumnya: 7 Hari";
  }

  const rawPercent = (elapsedMs / TARGET_MS) * 100;
  const clampedBarPercent = Math.min(100, Math.max(0, rawPercent));
  const displayPercent = rawPercent >= 100 ? rawPercent.toFixed(0) : rawPercent.toFixed(1);

  document.getElementById("progressBar").style.width = `${clampedBarPercent}%`;
  document.getElementById("progressPercent").textContent = `${displayPercent}%`;

  document.getElementById("startTimeLabel").textContent =
    `Mulai: ${formatIndonesianDateTime(startTimeMs)}`;

  renderMilestones(elapsedMs);
}

function pickRandomSuggestion() {
  if (PHYSICAL_SUGGESTIONS.length <= 1) return PHYSICAL_SUGGESTIONS[0];
  let idx = Math.floor(Math.random() * PHYSICAL_SUGGESTIONS.length);
  if (idx === lastSuggestionIndex) {
    idx = (idx + 1) % PHYSICAL_SUGGESTIONS.length;
  }
  lastSuggestionIndex = idx;
  return PHYSICAL_SUGGESTIONS[idx];
}

function renderEmergencyCountdown() {
  const mins = Math.floor(remainingEmergencySec / 60);
  const secs = remainingEmergencySec % 60;
  document.getElementById("emergencyCountdown").textContent =
    `${formatTwoDigits(mins)}:${formatTwoDigits(secs)}`;
}

function startEmergencyTimer() {
  clearInterval(emergencyInterval);
  remainingEmergencySec = 5 * 60;
  renderEmergencyCountdown();

  emergencyInterval = setInterval(() => {
    if (remainingEmergencySec > 0) {
      remainingEmergencySec--;
      renderEmergencyCountdown();
    } else {
      clearInterval(emergencyInterval);
    }
  }, 1000);
}

function openEmergencyModal() {
  document.getElementById("suggestionText").textContent = pickRandomSuggestion();
  startEmergencyTimer();
  document.getElementById("emergencyModal").classList.add("open");
}

function closeEmergencyModal() {
  clearInterval(emergencyInterval);
  document.getElementById("emergencyModal").classList.remove("open");
}

document.getElementById("openEmergencyBtn").addEventListener("click", openEmergencyModal);
document.getElementById("nextSuggestionBtn").addEventListener("click", () => {
  document.getElementById("suggestionText").textContent = pickRandomSuggestion();
});
document.getElementById("closeEmergencyBtn").addEventListener("click", closeEmergencyModal);

document.getElementById("noteForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("noteInput");
  const text = input.value.trim();
  if (!text) return;

  notes.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    dateLabel: formatIndonesianDateTime(Date.now())
  });
  saveNotes();
  renderNotes();
  input.value = "";
  input.focus();
});

document.getElementById("notesList").addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-delete");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  notes = notes.filter((item) => item.id !== id);
  saveNotes();
  renderNotes();
});

document.getElementById("openResetBtn").addEventListener("click", () => {
  document.getElementById("resetModal").classList.add("open");
});

document.getElementById("cancelResetBtn").addEventListener("click", () => {
  document.getElementById("resetModal").classList.remove("open");
});

document.getElementById("confirmResetBtn").addEventListener("click", () => {
  const now = Date.now();
  const currentDays = Math.floor(Math.max(0, now - startTimeMs) / DAY_MS);
  if (currentDays > bestRecordDays) {
    bestRecordDays = currentDays;
    localStorage.setItem(STORAGE_KEYS.BEST_RECORD, String(bestRecordDays));
  }

  startTimeMs = now;
  localStorage.setItem(STORAGE_KEYS.START_TIME, String(startTimeMs));
  document.getElementById("resetModal").classList.remove("open");
  updateTracker();
});

document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      if (backdrop.id === "emergencyModal") {
        closeEmergencyModal();
      } else {
        backdrop.classList.remove("open");
      }
    }
  });
});

renderNotes();
updateTracker();
setInterval(updateTracker, 1000);
