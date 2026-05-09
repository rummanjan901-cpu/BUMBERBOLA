// ════════════════════════════════════════════
//  app.js  –  Main dashboard logic
// ════════════════════════════════════════════
import { requireAuth, logout }             from "./firebase.js";
import { summarizeText, generateQuiz, getAIResponse } from "./ai.js";

// ── Auth guard ─────────────────────────────
requireAuth((user) => {
  // Show user email in header
  const emailEl = document.getElementById("user-email");
  if (emailEl) emailEl.textContent = user.email;
});

// ── Logout ─────────────────────────────────
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) logoutBtn.addEventListener("click", logout);


// ════════════════════════════════════════════
//  TOAST helper
// ════════════════════════════════════════════
function showToast(msg, duration = 2800) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), duration);
}

// ════════════════════════════════════════════
//  TAB NAVIGATION
// ════════════════════════════════════════════
const navBtns   = document.querySelectorAll(".nav-btn");
const sections  = document.querySelectorAll(".section");

function switchSection(id) {
  navBtns.forEach(b  => b.classList.toggle("active", b.dataset.section === id));
  sections.forEach(s => s.classList.toggle("active", s.id === id));
}

navBtns.forEach(b => b.addEventListener("click", () => switchSection(b.dataset.section)));
switchSection("summarizer"); // default tab

// ════════════════════════════════════════════
//  IMAGE → TEXT  (shared helper using Canvas OCR via Tesseract.js)
// ════════════════════════════════════════════
function setupImageUpload(inputId, textareaId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    const textarea = document.getElementById(textareaId);
    textarea.value = "⏳ Extracting text from image…";

    try {
      if (typeof Tesseract === "undefined") {
        // Tesseract.js loaded via CDN in index.html
        throw new Error("OCR library not loaded yet. Please wait and try again.");
      }
      const { data: { text } } = await Tesseract.recognize(file, "eng", { logger: () => {} });
      textarea.value = text.trim() || "No text could be extracted from this image.";
      showToast("✅ Text extracted from image!");
    } catch (e) {
      textarea.value = "";
      showToast("⚠️ " + e.message);
    }
    input.value = ""; // reset so same file can be re-uploaded
  });
}

setupImageUpload("sum-img-input",  "sum-textarea");
setupImageUpload("quiz-img-input", "quiz-textarea");


// ════════════════════════════════════════════
//  SUMMARIZER
// ════════════════════════════════════════════
const sumBtn    = document.getElementById("sum-btn");
const sumText   = document.getElementById("sum-textarea");
const sumResult = document.getElementById("sum-result");

if (sumBtn) {
  sumBtn.addEventListener("click", async () => {
    const text = sumText.value.trim();
    if (!text) { showToast("✏️ Please enter some text first."); return; }

    sumResult.textContent = "Summarizing…";
    sumResult.classList.add("loading");
    sumBtn.disabled = true;
    sumBtn.innerHTML = '<span class="spinner"></span> Summarizing…';

    try {
      const summary = await summarizeText(text);
      sumResult.textContent = summary;
      sumResult.classList.remove("loading");
      showToast("✅ Summary ready!");
    } catch (e) {
      sumResult.textContent = "Error: " + e.message;
      sumResult.classList.remove("loading");
      showToast("❌ " + e.message);
    } finally {
      sumBtn.disabled = false;
      sumBtn.innerHTML = '✨ Summarize';
    }
  });
}


// ════════════════════════════════════════════
//  QUIZ GENERATOR
// ════════════════════════════════════════════
let quizData       = [];
let currentQ       = 0;
let answered       = false;

const quizBtn       = document.getElementById("quiz-gen-btn");
const quizTextarea  = document.getElementById("quiz-textarea");
const quizArea      = document.getElementById("quiz-area");
const questionEl    = document.getElementById("quiz-question");
const optionsEl     = document.getElementById("quiz-options");
const quizFeedback  = document.getElementById("quiz-feedback");
const quizNext      = document.getElementById("quiz-next");
const quizCounter   = document.getElementById("quiz-counter");
const quizScore     = document.getElementById("quiz-score");

let score = 0;

if (quizBtn) {
  quizBtn.addEventListener("click", async () => {
    const text = quizTextarea.value.trim();
    if (!text) { showToast("✏️ Please enter some text first."); return; }

    quizBtn.disabled = true;
    quizBtn.innerHTML = '<span class="spinner"></span> Generating…';
    quizArea.classList.add("hidden");

    try {
      quizData   = await generateQuiz(text);
      currentQ   = 0;
      score      = 0;
      renderQuestion();
      quizArea.classList.remove("hidden");
      quizArea.scrollIntoView({ behavior: "smooth", block: "start" });
      showToast("🎉 Quiz ready! Good luck!");
    } catch (e) {
      showToast("❌ " + e.message);
    } finally {
      quizBtn.disabled = false;
      quizBtn.innerHTML = '🎯 Generate Quiz';
    }
  });
}

function renderQuestion() {
  if (!quizData.length) return;
  const q = quizData[currentQ];
  answered = false;

  // Counter
  quizCounter.textContent = `Question ${currentQ + 1} / ${quizData.length}`;
  quizScore.textContent   = `Score: ${score}`;

  // Question
  questionEl.textContent = q.question;
  quizFeedback.textContent = "";
  quizFeedback.className   = "quiz-feedback";
  quizNext.classList.add("hidden");

  // Options
  optionsEl.innerHTML = "";
  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className   = "quiz-option";
    btn.textContent = opt;
    btn.addEventListener("click", () => handleAnswer(opt, q.answer));
    optionsEl.appendChild(btn);
  });
}

function handleAnswer(chosen, correct) {
  if (answered) return;
  answered = true;

  const allOpts = optionsEl.querySelectorAll(".quiz-option");
  allOpts.forEach(b => {
    b.disabled = true;
    if (b.textContent === correct)  b.classList.add("correct");
    if (b.textContent === chosen && chosen !== correct) b.classList.add("wrong");
  });

  if (chosen === correct) {
    score++;
    quizScore.textContent   = `Score: ${score}`;
    quizFeedback.textContent = "✅ Correct!";
    quizFeedback.classList.add("correct");
    // Auto-advance after 1.4 s
    setTimeout(() => advanceQuiz(), 1400);
  } else {
    quizFeedback.textContent = `❌ Wrong! Correct: ${correct}`;
    quizFeedback.classList.add("wrong");
    quizNext.classList.remove("hidden");
  }
}

function advanceQuiz() {
  currentQ++;
  if (currentQ >= quizData.length) {
    showQuizResult();
  } else {
    renderQuestion();
  }
}

function showQuizResult() {
  const pct = Math.round((score / quizData.length) * 100);
  const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "📚";
  questionEl.textContent = `${emoji} Quiz Complete!`;
  optionsEl.innerHTML    = `<div class="quiz-result-card">
    <div class="big-score">${score} / ${quizData.length}</div>
    <div class="pct-score">${pct}% correct</div>
    <p>${pct >= 80 ? "Excellent work!" : pct >= 60 ? "Good effort — review the tricky ones!" : "Keep studying — you'll get it!"}</p>
  </div>`;
  quizFeedback.textContent = "";
  quizNext.classList.add("hidden");
  quizCounter.textContent = `Finished!`;
}

if (quizNext) quizNext.addEventListener("click", advanceQuiz);


// ════════════════════════════════════════════
//  TO-DO LIST
// ════════════════════════════════════════════
const TODO_KEY   = "studyai_todos";
const todoInput  = document.getElementById("todo-input");
const todoAddBtn = document.getElementById("todo-add-btn");
const todoList   = document.getElementById("todo-list");
const todoClear  = document.getElementById("todo-clear");

function loadTodos() { return JSON.parse(localStorage.getItem(TODO_KEY) || "[]"); }
function saveTodos(arr) { localStorage.setItem(TODO_KEY, JSON.stringify(arr)); }

function renderTodos() {
  const todos = loadTodos();
  todoList.innerHTML = "";
  if (!todos.length) {
    todoList.innerHTML = '<p class="todo-empty">No tasks yet. Add one above! 🎯</p>';
    return;
  }
  todos.forEach((t, i) => {
    const li = document.createElement("li");
    li.className = "todo-item" + (t.done ? " done" : "");
    li.innerHTML = `
      <label class="todo-check">
        <input type="checkbox" ${t.done ? "checked" : ""} data-idx="${i}" />
        <span class="checkmark"></span>
      </label>
      <span class="todo-text">${escapeHtml(t.text)}</span>
      <button class="todo-del btn btn-icon btn-danger" data-idx="${i}" title="Delete">🗑️</button>
    `;
    li.querySelector("input[type=checkbox]").addEventListener("change", () => toggleTodo(i));
    li.querySelector(".todo-del").addEventListener("click", () => deleteTodo(i));
    todoList.appendChild(li);
  });
}

function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;
  const todos = loadTodos();
  todos.unshift({ text, done: false, ts: Date.now() });
  saveTodos(todos);
  renderTodos();
  todoInput.value = "";
  showToast("✅ Task added!");
}

function toggleTodo(idx) {
  const todos = loadTodos();
  todos[idx].done = !todos[idx].done;
  saveTodos(todos);
  renderTodos();
}

function deleteTodo(idx) {
  const todos = loadTodos();
  todos.splice(idx, 1);
  saveTodos(todos);
  renderTodos();
  showToast("🗑️ Task removed.");
}

if (todoAddBtn) todoAddBtn.addEventListener("click", addTodo);
if (todoInput)  todoInput.addEventListener("keydown", e => { if (e.key === "Enter") addTodo(); });
if (todoClear)  todoClear.addEventListener("click", () => {
  if (confirm("Clear all tasks?")) { localStorage.removeItem(TODO_KEY); renderTodos(); showToast("🧹 All tasks cleared."); }
});

renderTodos();


// ════════════════════════════════════════════
//  AI CHAT ASSISTANT
// ════════════════════════════════════════════
const chatToggle  = document.getElementById("chat-toggle");
const chatWindow  = document.getElementById("chat-window");
const chatClose   = document.getElementById("chat-close");
const chatInput   = document.getElementById("chat-input");
const chatSend    = document.getElementById("chat-send");
const chatBody    = document.getElementById("chat-body");

let chatHistory = [];   // [{role, content}]

if (chatToggle) {
  chatToggle.addEventListener("click", () => {
    chatWindow.classList.toggle("open");
    if (chatWindow.classList.contains("open")) chatInput.focus();
  });
}
if (chatClose) chatClose.addEventListener("click", () => chatWindow.classList.remove("open"));

async function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg) return;

  appendMessage("user", msg);
  chatInput.value = "";
  chatInput.disabled = true;
  chatSend.disabled  = true;

  const thinking = appendMessage("assistant", "…", true);

  try {
    const reply = await getAIResponse(msg, chatHistory);
    thinking.remove();
    appendMessage("assistant", reply);
    // Save to history (last 10 turns)
    chatHistory.push({ role: "user", content: msg });
    chatHistory.push({ role: "assistant", content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
  } catch (e) {
    thinking.remove();
    appendMessage("assistant", "⚠️ " + e.message);
  } finally {
    chatInput.disabled = false;
    chatSend.disabled  = false;
    chatInput.focus();
  }
}

function appendMessage(role, text, isThinking = false) {
  const div = document.createElement("div");
  div.className = `chat-msg ${role}` + (isThinking ? " thinking" : "");
  div.innerHTML = `<div class="chat-bubble">${isThinking ? '<span class="dot"></span><span class="dot"></span><span class="dot"></span>' : escapeHtml(text).replace(/\n/g, "<br>")}</div>`;
  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight;
  return div;
}

if (chatSend)  chatSend.addEventListener("click", sendChat);
if (chatInput) chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
});


// ════════════════════════════════════════════
//  UTILITY
// ════════════════════════════════════════════
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
