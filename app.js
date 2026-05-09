const STORAGE_KEY = "calendario-examenes-state";

const monthNames = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const weekdayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const creditLabels = { low: "3 créditos o menos", medium: "4 a 7 créditos", high: "8 créditos o más" };

const state = loadState();

const elements = {
  monthForm: document.querySelector("#monthForm"),
  monthInput: document.querySelector("#monthInput"),
  yearInput: document.querySelector("#yearInput"),
  selectedMonths: document.querySelector("#selectedMonths"),
  calendarList: document.querySelector("#calendarList"),
  nextExamText: document.querySelector("#nextExamText"),
  totalVisibleText: document.querySelector("#totalVisibleText"),
  highPriorityText: document.querySelector("#highPriorityText"),
  openExamButton: document.querySelector("#openExamButton"),
  examDialog: document.querySelector("#examDialog"),
  examForm: document.querySelector("#examForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  examId: document.querySelector("#examId"),
  examName: document.querySelector("#examName"),
  examDate: document.querySelector("#examDate"),
  examTime: document.querySelector("#examTime"),
  examCredits: document.querySelector("#examCredits"),
  examNotes: document.querySelector("#examNotes"),
  deleteExamButton: document.querySelector("#deleteExamButton"),
  cancelDialogButton: document.querySelector("#cancelDialogButton"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
};

function loadState() {
  const fallbackDate = new Date();
  const fallback = {
    months: [{ month: fallbackDate.getMonth(), year: fallbackDate.getFullYear() }],
    exams: [],
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.months) || !Array.isArray(saved.exams)) {
      return fallback;
    }
    saved.exams = saved.exams.map(normalizeExam);
    return saved;
  } catch {
    return fallback;
  }
}

function normalizeExam(exam) {
  const credits = Number(exam.credits ?? legacyCredits(exam.importance));
  return {
    ...exam,
    credits: Number.isFinite(credits) ? credits : 6,
    time: exam.time || "",
  };
}

function legacyCredits(importance) {
  if (importance === "low") return 3;
  if (importance === "high") return 8;
  return 6;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function todayKey() {
  return toDateKey(new Date());
}

function daysUntil(dateKey) {
  const start = parseDate(todayKey());
  const end = parseDate(dateKey);
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / 86400000);
}

function countdownText(dateKey) {
  const days = daysUntil(dateKey);
  if (days === 0) return "Hoy";
  if (days === 1) return "Queda 1 día";
  if (days > 1) return `Quedan ${days} días`;
  if (days === -1) return "Fue ayer";
  return `Hace ${Math.abs(days)} días`;
}

function formatDate(dateKey) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseDate(dateKey));
}

function monthId(month) {
  return `${month.year}-${String(month.month + 1).padStart(2, "0")}`;
}

function sortMonths() {
  state.months.sort((a, b) => a.year - b.year || a.month - b.month);
}

function visibleMonthIds() {
  return new Set(state.months.map(monthId));
}

function examsForDate(dateKey) {
  return state.exams
    .filter((exam) => exam.date === dateKey)
    .sort((a, b) => {
      if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time);
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      return creditRank(b.credits) - creditRank(a.credits) || a.name.localeCompare(b.name);
    });
}

function creditLevel(credits) {
  const value = Number(credits);
  if (!Number.isFinite(value)) return "medium";
  if (value <= 3) return "low";
  if (value <= 7) return "medium";
  return "high";
}

function creditRank(credits) {
  return { low: 1, medium: 2, high: 3 }[creditLevel(Number(credits))] || 0;
}

function visibleExams() {
  const months = visibleMonthIds();
  return state.exams.filter((exam) => months.has(exam.date.slice(0, 7)));
}

function renderSelectedMonths() {
  elements.selectedMonths.innerHTML = "";

  if (state.months.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Añade marzo, abril o los meses que quieras preparar.";
    elements.selectedMonths.append(empty);
    return;
  }

  state.months.forEach((month) => {
    const chip = document.createElement("span");
    chip.className = "month-chip";
    chip.textContent = `${monthNames[month.month]} ${month.year}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Quitar ${monthNames[month.month]} ${month.year}`);
    remove.addEventListener("click", () => removeMonth(month));

    chip.append(remove);
    elements.selectedMonths.append(chip);
  });
}

function renderCalendars() {
  elements.calendarList.innerHTML = "";

  if (state.months.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No hay meses seleccionados. Añade uno arriba para empezar.";
    elements.calendarList.append(empty);
    return;
  }

  state.months.forEach((month) => {
    elements.calendarList.append(createMonthBlock(month));
  });
}

function createMonthBlock(month) {
  const block = document.createElement("article");
  block.className = "month-block";

  const header = document.createElement("header");
  header.className = "month-header";

  const titleWrap = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = `${monthNames[month.month]} ${month.year}`;
  titleWrap.append(title);

  const monthExamCount = visibleExams().filter((exam) => exam.date.startsWith(monthId(month))).length;
  const count = document.createElement("span");
  count.textContent = `${monthExamCount} ${monthExamCount === 1 ? "examen" : "exámenes"}`;

  header.append(titleWrap, count);
  block.append(header, createWeekdayRow(), createMonthGrid(month));
  return block;
}

function createWeekdayRow() {
  const row = document.createElement("div");
  row.className = "weekday-row";
  weekdayNames.forEach((day) => {
    const cell = document.createElement("div");
    cell.textContent = day;
    row.append(cell);
  });
  return row;
}

function createMonthGrid(month) {
  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  const firstDate = new Date(month.year, month.month, 1);
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const leadingEmptyCells = (firstDate.getDay() + 6) % 7;
  const totalCells = Math.ceil((leadingEmptyCells + daysInMonth) / 7) * 7;

  for (let index = 0; index < totalCells; index += 1) {
    const dayNumber = index - leadingEmptyCells + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      const empty = document.createElement("div");
      empty.className = "day-cell is-empty";
      grid.append(empty);
      continue;
    }

    const dateKey = toDateKey(new Date(month.year, month.month, dayNumber));
    grid.append(createDayCell(dayNumber, dateKey));
  }

  return grid;
}

function createDayCell(dayNumber, dateKey) {
  const cell = document.createElement("div");
  cell.className = "day-cell";
  if (dateKey === todayKey()) cell.classList.add("is-today");
  cell.tabIndex = 0;
  cell.setAttribute("role", "button");
  cell.setAttribute("aria-label", `Añadir examen el ${formatDate(dateKey)}`);
  cell.addEventListener("click", () => openExamDialog({ date: dateKey }));
  cell.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openExamDialog({ date: dateKey });
    }
  });

  const head = document.createElement("div");
  head.className = "day-head";

  const number = document.createElement("span");
  number.className = "day-number";
  number.textContent = dayNumber;
  head.append(number);

  if (dateKey === todayKey()) {
    const today = document.createElement("span");
    today.className = "today-label";
    today.textContent = "Hoy";
    head.append(today);
  }

  const list = document.createElement("div");
  list.className = "exam-list";

  examsForDate(dateKey).forEach((exam) => {
    list.append(createExamPill(exam));
  });

  cell.append(head, list);
  return cell;
}

function createExamPill(exam) {
  const button = document.createElement("button");
  button.type = "button";
  const level = creditLevel(exam.credits);
  button.className = `exam-pill ${level}`;
  button.title = `${exam.credits} créditos - ${creditLabels[level]} - ${countdownText(exam.date)}`;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    openExamDialog({ exam });
  });

  const name = document.createElement("span");
  name.className = "exam-name";
  name.textContent = exam.name;

  const meta = document.createElement("span");
  meta.className = "exam-meta";
  meta.textContent = [formatTime(exam.time), `${exam.credits} cr.`].filter(Boolean).join(" · ");

  const countdown = document.createElement("span");
  countdown.className = "exam-countdown";
  countdown.textContent = countdownText(exam.date);

  button.append(name, meta, countdown);
  return button;
}

function formatTime(time) {
  return time || "";
}

function renderSummary() {
  const exams = visibleExams();
  const futureExams = exams
    .filter((exam) => daysUntil(exam.date) >= 0)
    .sort((a, b) => {
      const dateDiff = parseDate(a.date) - parseDate(b.date);
      if (dateDiff !== 0) return dateDiff;
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    });
  const nextExam = futureExams[0];

  elements.nextExamText.textContent = nextExam
    ? `${nextExam.name}: ${formatTime(nextExam.time)} ${countdownText(nextExam.date)}`.replace(":  ", ": ")
    : "Sin exámenes";
  elements.totalVisibleText.textContent = String(exams.length);
  elements.highPriorityText.textContent = String(exams.filter((exam) => creditLevel(exam.credits) === "high").length);
}

function render() {
  sortMonths();
  renderSelectedMonths();
  renderCalendars();
  renderSummary();
}

function addMonth(event) {
  event.preventDefault();
  const month = Number(elements.monthInput.value);
  const year = Number(elements.yearInput.value);
  const exists = state.months.some((item) => item.month === month && item.year === year);

  if (!exists) {
    state.months.push({ month, year });
    saveState();
    render();
  }
}

function removeMonth(monthToRemove) {
  state.months = state.months.filter(
    (month) => month.month !== monthToRemove.month || month.year !== monthToRemove.year,
  );
  saveState();
  render();
}

function openExamDialog({ date, exam } = {}) {
  const editing = Boolean(exam);
  elements.dialogTitle.textContent = editing ? "Editar examen" : "Añadir examen";
  elements.examId.value = editing ? exam.id : "";
  elements.examName.value = editing ? exam.name : "";
  elements.examDate.value = editing ? exam.date : date || todayKey();
  elements.examTime.value = editing ? exam.time || "" : "";
  elements.examCredits.value = editing ? exam.credits : "";
  elements.examNotes.value = editing ? exam.notes || "" : "";
  elements.deleteExamButton.hidden = !editing;
  elements.examDialog.showModal();
  elements.examName.focus();
}

function closeExamDialog() {
  elements.examDialog.close();
  elements.examForm.reset();
}

function saveExam(event) {
  event.preventDefault();

  const id = elements.examId.value || createId();
  const exam = {
    id,
    name: elements.examName.value.trim(),
    date: elements.examDate.value,
    time: elements.examTime.value,
    credits: Number(elements.examCredits.value),
    notes: elements.examNotes.value.trim(),
  };

  const existingIndex = state.exams.findIndex((item) => item.id === id);
  if (existingIndex >= 0) {
    state.exams[existingIndex] = exam;
  } else {
    state.exams.push(exam);
  }

  ensureMonthForExam(exam.date);
  saveState();
  closeExamDialog();
  render();
}

function ensureMonthForExam(dateKey) {
  const date = parseDate(dateKey);
  const month = date.getMonth();
  const year = date.getFullYear();
  const exists = state.months.some((item) => item.month === month && item.year === year);
  if (!exists) state.months.push({ month, year });
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `exam-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function deleteCurrentExam() {
  const id = elements.examId.value;
  if (!id) return;

  state.exams = state.exams.filter((exam) => exam.id !== id);
  saveState();
  closeExamDialog();
  render();
}

function init() {
  const now = new Date();
  elements.monthInput.value = String(now.getMonth());
  elements.yearInput.value = String(now.getFullYear());

  elements.monthForm.addEventListener("submit", addMonth);
  elements.openExamButton.addEventListener("click", () => openExamDialog());
  elements.examForm.addEventListener("submit", saveExam);
  elements.deleteExamButton.addEventListener("click", deleteCurrentExam);
  elements.cancelDialogButton.addEventListener("click", closeExamDialog);
  elements.closeDialogButton.addEventListener("click", closeExamDialog);
  elements.examDialog.addEventListener("click", (event) => {
    if (event.target === elements.examDialog) closeExamDialog();
  });

  render();
}

init();
