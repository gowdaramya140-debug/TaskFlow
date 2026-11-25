"use strict";

const STORAGE_KEY = "taskflow-tasks";
const THEME_KEY = "taskflow-theme";

const taskForm = document.querySelector("#task-form");
const titleInput = document.querySelector("#task-title");
const descriptionInput = document.querySelector("#task-description");
const dueDateInput = document.querySelector("#task-due-date");
const priorityInput = document.querySelector("#task-priority");
const submitButton = document.querySelector("#submit-task");
const cancelEditButton = document.querySelector("#cancel-edit");
const taskList = document.querySelector("#task-list");
const currentDate = document.querySelector("#current-date");
const searchInput = document.querySelector("#task-search");
const priorityFilter = document.querySelector("#priority-filter");
const sortSelect = document.querySelector("#sort-tasks");
const themeToggle = document.querySelector("#theme-toggle");
const categoryTabs = document.querySelectorAll(".category-tab");

let tasks = loadTasks();
let activeCategory = "all";
let editingTaskId = null;

// Keep date-only values in YYYY-MM-DD format for reliable comparisons and sorting.
// Use local calendar components instead of UTC so dates stay correct across time zones.
function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Read saved data defensively so malformed storage never prevents the app from opening.
function loadTasks() {
  try {
    const storedTasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(storedTasks)) {
      return [];
    }

    return storedTasks.filter((task) =>
      task &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      typeof task.description === "string" &&
      ["high", "medium", "low"].includes(task.priority) &&
      typeof task.completed === "boolean" &&
      (task.dueDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate))
    );
  } catch (error) {
    console.error("TaskFlow could not read saved tasks:", error);
    return [];
  }
}

// Keep task changes in this browser without needing a server or account.
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("TaskFlow could not save tasks:", error);
    window.alert("Your changes could not be saved in this browser. Check your storage settings and try again.");
  }
}

function formatDueDate(dateKey) {
  if (!dateKey) {
    return "";
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: year !== new Date().getFullYear() ? "numeric" : undefined
  });
}

function getTaskDateClass(task) {
  if (!task.dueDate || task.completed) {
    return "";
  }
  const today = getLocalDateKey();
  if (task.dueDate < today) {
    return " overdue";
  }
  if (task.dueDate === today) {
    return " due-today";
  }
  return "";
}

function updateDateHeading() {
  currentDate.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function updateSummary() {
  const today = getLocalDateKey();
  const completed = tasks.filter((task) => task.completed).length;
  const pending = tasks.length - completed;
  const dueToday = tasks.filter((task) => task.dueDate === today).length;
  const upcoming = tasks.filter((task) => !task.completed && task.dueDate > today).length;
  const completionPercent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  document.querySelector("#total-count").textContent = tasks.length;
  document.querySelector("#completed-count").textContent = completed;
  document.querySelector("#pending-count").textContent = pending;
  document.querySelector("#today-count").textContent = dueToday;
  document.querySelector("#all-tab-count").textContent = tasks.length;
  document.querySelector("#today-tab-count").textContent = dueToday;
  document.querySelector("#upcoming-tab-count").textContent = upcoming;
  document.querySelector("#completed-tab-count").textContent = completed;
  document.querySelector("#progress-value").textContent = `${completionPercent}%`;
  document.querySelector("#progress-fill").style.width = `${completionPercent}%`;
  document.querySelector("#progress-track").setAttribute("aria-valuenow", completionPercent);

  const caption = document.querySelector("#progress-caption");
  if (!tasks.length) {
    caption.textContent = "A fresh start. You’ve got this!";
  } else if (completionPercent === 100) {
    caption.textContent = "Everything done. Amazing work!";
  } else if (completionPercent === 0) {
    caption.textContent = "Ready when you are. Start with one task.";
  } else {
    caption.textContent = `${completed} of ${tasks.length} tasks complete. Keep it up!`;
  }
}

// Apply every active filter first, then sort the resulting list by due date.
function getVisibleTasks() {
  const today = getLocalDateKey();
  const searchTerm = searchInput.value.trim().toLocaleLowerCase();
  const selectedPriority = priorityFilter.value;

  return tasks
    .filter((task) => {
      if (activeCategory === "today" && task.dueDate !== today) return false;
      if (activeCategory === "upcoming" && (task.completed || !task.dueDate || task.dueDate <= today)) return false;
      if (activeCategory === "completed" && !task.completed) return false;
      if (selectedPriority !== "all" && task.priority !== selectedPriority) return false;
      return !searchTerm || task.title.toLocaleLowerCase().includes(searchTerm);
    })
    .sort((first, second) => {
      const direction = sortSelect.value === "date-desc" ? -1 : 1;
      if (!first.dueDate && !second.dueDate) return 0;
      if (!first.dueDate) return 1;
      if (!second.dueDate) return -1;
      return first.dueDate.localeCompare(second.dueDate) * direction;
    });
}

function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = `task-card${task.completed ? " is-completed" : ""}`;

  const checkbox = document.createElement("input");
  checkbox.className = "task-checkbox";
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `Mark ${task.title} as ${task.completed ? "incomplete" : "completed"}`);
  checkbox.addEventListener("change", () => toggleTask(task.id));

  const content = document.createElement("div");
  content.className = "task-content";
  const titleRow = document.createElement("div");
  titleRow.className = "task-title-row";
  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;
  const priorityBadge = document.createElement("span");
  priorityBadge.className = `priority-badge priority-${task.priority}`;
  priorityBadge.textContent = `${task.priority[0].toUpperCase()}${task.priority.slice(1)}`;
  titleRow.append(title, priorityBadge);
  content.append(titleRow);

  if (task.description) {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    content.append(description);
  }

  if (task.dueDate) {
    const meta = document.createElement("div");
    meta.className = "task-meta";
    const dueDate = document.createElement("span");
    dueDate.className = `due-date${getTaskDateClass(task)}`;
    dueDate.textContent = `Due ${formatDueDate(task.dueDate)}`;
    meta.append(dueDate);
    content.append(meta);
  }

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const editButton = createIconButton("Edit task", "edit", task.id);
  editButton.addEventListener("click", () => startEditing(task));
  const deleteButton = createIconButton("Delete task", "delete", task.id);
  deleteButton.classList.add("delete");
  deleteButton.addEventListener("click", () => deleteTask(task.id));
  actions.append(editButton, deleteButton);

  card.append(checkbox, content, actions);
  return card;
}

function createIconButton(label, action, id) {
  const button = document.createElement("button");
  button.className = `task-action ${action}`;
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.dataset.taskId = id;
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");

  if (action === "edit") {
    path.setAttribute("d", "m15 5 4 4M4 20l4.2-.9L19 8.3 15.7 5 4.9 15.8 4 20Z");
  } else {
    path.setAttribute("d", "M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3");
  }

  icon.append(path);
  button.append(icon);
  return button;
}

// Build task markup with DOM methods so user-entered text is always treated as text.
function renderTasks() {
  const visibleTasks = getVisibleTasks();
  taskList.replaceChildren();
  document.querySelector("#visible-count").textContent = `${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"}`;

  if (!visibleTasks.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    const illustration = document.createElement("span");
    illustration.className = "empty-illustration";
    illustration.setAttribute("aria-hidden", "true");
    illustration.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="m6 12 4 4L19 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/></svg>';
    const message = document.createElement("h3");
    const detail = document.createElement("p");

    if (searchInput.value.trim() || priorityFilter.value !== "all") {
      message.textContent = "No matching tasks";
      detail.textContent = "Try another search or adjust your filters.";
    } else if (activeCategory === "completed") {
      message.textContent = "Nothing completed just yet";
      detail.textContent = "Finished tasks will find a home here. You're off to a good start!";
    } else if (activeCategory === "today") {
      message.textContent = "Your day is wide open";
      detail.textContent = "No tasks due today. Enjoy the breathing room or add something above.";
    } else if (activeCategory === "upcoming") {
      message.textContent = "Nothing on the horizon";
      detail.textContent = "Tasks with a future due date will show up here.";
    } else {
      message.textContent = "A clear desk, a clear mind";
      detail.textContent = "Add your first task above and take the first step toward a great day.";
    }

    emptyState.append(illustration, message, detail);
    taskList.append(emptyState);
  } else {
    const fragment = document.createDocumentFragment();
    visibleTasks.forEach((task) => fragment.append(createTaskCard(task)));
    taskList.append(fragment);
  }

  updateSummary();
}

// Reuse the task form for editing, and restore its default state when finished.
function resetForm() {
  taskForm.reset();
  priorityInput.value = "medium";
  editingTaskId = null;
  submitButton.querySelector("span").textContent = "Add task";
  cancelEditButton.hidden = true;
  document.querySelector("#form-title").textContent = "Add a task";
}

function startEditing(task) {
  editingTaskId = task.id;
  titleInput.value = task.title;
  descriptionInput.value = task.description;
  dueDateInput.value = task.dueDate;
  priorityInput.value = task.priority;
  submitButton.querySelector("span").textContent = "Save changes";
  cancelEditButton.hidden = false;
  document.querySelector("#form-title").textContent = "Edit task";
  taskForm.scrollIntoView({ behavior: "smooth", block: "center" });
  titleInput.focus({ preventScroll: true });
}

function toggleTask(id) {
  tasks = tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task);
  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task || !window.confirm(`Delete "${task.title}"? This can't be undone.`)) {
    return;
  }
  tasks = tasks.filter((item) => item.id !== id);
  if (editingTaskId === id) {
    resetForm();
  }
  saveTasks();
  renderTasks();
}

function handleTaskSubmit(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.setCustomValidity("Please enter a task title.");
    titleInput.reportValidity();
    titleInput.setCustomValidity("");
    return;
  }

  if (editingTaskId) {
    tasks = tasks.map((task) => task.id === editingTaskId
      ? {
          ...task,
          title,
          description: descriptionInput.value.trim(),
          dueDate: dueDateInput.value,
          priority: priorityInput.value
        }
      : task);
  } else {
    tasks.unshift({
      id: window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      description: descriptionInput.value.trim(),
      dueDate: dueDateInput.value,
      priority: priorityInput.value,
      completed: false,
      createdAt: new Date().toISOString()
    });
  }

  saveTasks();
  resetForm();
  renderTasks();
}

// Theme preference is stored separately so changing appearance never alters tasks.
function applySavedTheme() {
  let savedTheme = "light";
  try {
    savedTheme = localStorage.getItem(THEME_KEY) || "light";
  } catch (error) {
    console.error("TaskFlow could not read the saved theme:", error);
  }
  setTheme(savedTheme === "dark", false);
}

function setTheme(isDark, shouldSave = true) {
  document.body.classList.toggle("dark-mode", isDark);
  themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  themeToggle.title = `Switch to ${isDark ? "light" : "dark"} mode`;
  if (shouldSave) {
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch (error) {
      console.error("TaskFlow could not save the selected theme:", error);
    }
  }
}

taskForm.addEventListener("submit", handleTaskSubmit);
cancelEditButton.addEventListener("click", resetForm);
searchInput.addEventListener("input", renderTasks);
priorityFilter.addEventListener("change", renderTasks);
sortSelect.addEventListener("change", renderTasks);
categoryTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeCategory = tab.dataset.category;
    categoryTabs.forEach((categoryTab) => {
      const isActive = categoryTab === tab;
      categoryTab.classList.toggle("active", isActive);
      categoryTab.setAttribute("aria-pressed", String(isActive));
    });
    renderTasks();
  });
});
themeToggle.addEventListener("click", () => setTheme(!document.body.classList.contains("dark-mode")));

updateDateHeading();
applySavedTheme();
renderTasks();
