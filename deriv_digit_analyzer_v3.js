let ws = null;
let connected = false;
let digits = [];
let allDigits = [];
let trades = [];
let botActive = false;
let botPaused = false;
let sessionPL = 0;
let sessionWins = 0;
let sessionLosses = 0;
let currentStake = 1;
let lossStreak = 0;
let activeOverThr = 4;
let activeUnderThr = 5;
let liveBalance = null;
let liveCurrency = "USD";
let demoMode = false;
let liveTradingEnabled = false;
let tradeInFlight = false;
let pendingBuys = {};
let pendingProposals = {};
let openContracts = {};
let tradeRows = {};
let nextLocalTradeId = 1;
let reqIdCounter = 1000;
let accountIsVirtual = null;
let accountLoginId = "--";
const demoBalanceBase = 1000;
let autoMode = false;
const sysLogLimit = 200;
let richHistory = [];
const richMaxHistory = 12;
let richAudio = null;
let richAudioUrl = "";
let richMicActive = false;
let richMediaRecorder = null;
let richMicStream = null;
let richMicTimeout = null;
let richSpeechAvailable = false;
let richSpeechBackend = "";
let richRecognition = null;

const LOCK_CODE = "2007";

const DC = [
  { bg: "#E6F1FB", tc: "#0C447C" },
  { bg: "#FAEEDA", tc: "#633806" },
  { bg: "#EAF3DE", tc: "#27500A" },
  { bg: "#FCEBEB", tc: "#791F1F" },
  { bg: "#EEEDFE", tc: "#3C3489" },
  { bg: "#E1F5EE", tc: "#085041" },
  { bg: "#FAECE7", tc: "#712B13" },
  { bg: "#F1EFE8", tc: "#444441" },
  { bg: "#FBEAF0", tc: "#72243E" },
  { bg: "#E6F1FB", tc: "#185FA5" }
];

function initLockscreen() {
  const screen = document.getElementById("lockscreen");
  const appRoot = document.getElementById("appRoot");
  if (!screen || !appRoot) return;

  document.body.classList.add("locked");
  appRoot.setAttribute("aria-hidden", "true");

  const input = document.getElementById("lockPass");
  const btn = document.getElementById("unlockBtn");
  const err = document.getElementById("lockError");

  const attempt = () => {
    const val = (input && input.value ? input.value : "").trim();
    if (val === LOCK_CODE) {
      document.body.classList.remove("locked");
      screen.classList.add("hidden");
      screen.setAttribute("aria-hidden", "true");
      appRoot.removeAttribute("aria-hidden");
      if (err) err.textContent = "";
      if (input) input.value = "";
      return;
    }
    if (err) err.textContent = "Incorrect code. Try again.";
    if (input) {
      input.focus();
      input.select();
    }
    screen.classList.remove("shake");
    void screen.offsetWidth;
    screen.classList.add("shake");
  };

  if (btn) btn.addEventListener("click", attempt);
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") attempt();
    });
    input.focus();
  }
}

function switchTab(t) {
  document.querySelectorAll(".section").forEach((el) => el.classList.remove("active"));
  const activeSection = document.getElementById("tab-" + t);
  if (activeSection) activeSection.classList.add("active");

  document.querySelectorAll(".tab").forEach((btn) => {
    const isActive = btn.dataset.tab === t;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    btn.tabIndex = isActive ? 0 : -1;
  });
}

function toggleApiVis() {
  const inp = document.getElementById("apiKeyInput");
  const eye = document.getElementById("apiEye");
  if (!inp) return;
  const show = inp.type === "password";
  inp.type = show ? "text" : "password";
  if (eye) {
    eye.textContent = show ? "Hide" : "Show";
    eye.setAttribute("aria-pressed", show ? "true" : "false");
  }
}

function formatMoney(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "--";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setBalance(amount, currency) {
  liveBalance = amount === null || amount === undefined ? Number.NaN : Number(amount);
  if (currency) liveCurrency = currency;
  const valEl = document.getElementById("balanceValue");
  const curEl = document.getElementById("balanceCurrency");
  if (valEl) valEl.textContent = Number.isNaN(liveBalance) ? "--" : formatMoney(liveBalance);
  if (curEl) curEl.textContent = liveCurrency || "USD";
}

function logSys(message, level) {
  const el = document.getElementById("sysLog");
  if (!el) return;
  const time = new Date().toLocaleTimeString();
  const tag = (level || "info").toUpperCase();
  const line = `[${time}] [${tag}] ${message}`;
  const lines = (el.textContent || "").split("\n").filter(Boolean);
  lines.push(line);
  const trimmed = lines.slice(-sysLogLimit);
  el.textContent = trimmed.join("\n") + "\n";
  el.scrollTop = el.scrollHeight;
}

function initSystemLog() {
  const clearBtn = document.getElementById("clearSysLog");
  const el = document.getElementById("sysLog");
  if (el) el.textContent = "";
  logSys("System ready.");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (el) el.textContent = "";
      logSys("System log cleared.");
    });
  }
}

function setRichStatus(message, isError) {
  const el = document.getElementById("richStatus");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function appendRichMessage(role, content) {
  const log = document.getElementById("richChatLog");
  if (!log) return;
  const wrap = document.createElement("div");
  wrap.className = "rich-msg " + (role === "user" ? "user" : "assistant");
  const roleEl = document.createElement("div");
  roleEl.className = "rich-role";
  roleEl.textContent = role === "user" ? "You" : "RICH";
  const contentEl = document.createElement("div");
  contentEl.className = "rich-content";
  contentEl.textContent = content;
  wrap.appendChild(roleEl);
  wrap.appendChild(contentEl);
  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
}

function buildRichContext() {
  const sym = document.getElementById("symSel")?.value || "R_75";
  const lastDigit = digits.length ? digits[digits.length - 1] : "--";
  const streak = document.getElementById("mStreak")?.textContent || "--";
  const overRate = document.getElementById("mRate")?.textContent || "--";
  const evenRate = document.getElementById("mEven")?.textContent || "--";
  const oddRate = document.getElementById("mOdd")?.textContent || "--";
  const pl = Number.isFinite(sessionPL) ? sessionPL.toFixed(2) : "--";
  const acctType = accountIsVirtual === null ? "unknown" : accountIsVirtual ? "demo" : "real";
  const liveState = botActive ? (botPaused ? "paused" : "running") : "stopped";
  const contextLines = [
    `Symbol: ${sym}`,
    `Over threshold: ${activeOverThr} | Under threshold: ${activeUnderThr}`,
    `Total ticks: ${allDigits.length}`,
    `Last digit: ${lastDigit}`,
    `Current streak: ${streak}`,
    `Over ${activeOverThr} rate: ${overRate}`,
    `Even: ${evenRate} | Odd: ${oddRate}`,
    `Session P/L: ${pl} ${liveCurrency}`,
    `Wins/Losses: ${sessionWins}/${sessionLosses}`,
    `Bot state: ${liveState}`,
    `Auto mode: ${autoMode ? "on" : "off"}`,
    `Account: ${acctType} (${accountLoginId})`
  ];
  return contextLines.join("\n");
}

function getRichModel() {
  const input = document.getElementById("richModelInput");
  const raw = input ? input.value.trim() : "";
  return raw;
}

function _normalizeApiBase(host) {
  const cleaned = (host || "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) return cleaned;
  return "http://" + cleaned;
}

function getRichApiBase() {
  const hostInput = document.getElementById("richApiHostInput");
  const saved = localStorage.getItem("richApiHost") || "";
  const fromInput = hostInput ? hostInput.value.trim() : "";
  const host = fromInput || saved || (window.location.hostname ? `${window.location.hostname}:8000` : "127.0.0.1:8000");
  return _normalizeApiBase(host);
}

function getRichApiHeaders() {
  const keyInput = document.getElementById("richApiKeyInput");
  const saved = localStorage.getItem("richApiKey") || "";
  const key = (keyInput && keyInput.value.trim()) || saved;
  const headers = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  return headers;
}

function getRichAuthHeaders() {
  const keyInput = document.getElementById("richApiKeyInput");
  const saved = localStorage.getItem("richApiKey") || "";
  const key = (keyInput && keyInput.value.trim()) || saved;
  const headers = {};
  if (key) headers["Authorization"] = `Bearer ${key}`;
  return headers;
}

function getRichTtsBackend() {
  const input = document.getElementById("richTtsBackendInput");
  const saved = localStorage.getItem("richTtsBackend") || "";
  const value = (input && input.value.trim()) || saved;
  return value || "kokoro";
}

function getRichVoiceId() {
  const input = document.getElementById("richVoiceInput");
  const saved = localStorage.getItem("richVoiceId") || "";
  const value = (input && input.value.trim()) || saved;
  return value || "af_heart";
}

function isRichSpeakEnabled() {
  const input = document.getElementById("richSpeakToggle");
  return !!(input && input.checked);
}

function stopRichAudio() {
  if (richAudio) {
    richAudio.pause();
    richAudio.currentTime = 0;
  }
  if (richAudioUrl) {
    URL.revokeObjectURL(richAudioUrl);
    richAudioUrl = "";
  }
}

async function speakRichReply(text) {
  if (!isRichSpeakEnabled()) return;
  const payload = {
    text,
    backend: getRichTtsBackend(),
    voice_id: getRichVoiceId()
  };
  try {
    setRichStatus("Synthesizing voice...", false);
    const base = getRichApiBase();
    const resp = await fetch(`${base}/v1/speech/synthesize`, {
      method: "POST",
      headers: getRichApiHeaders(),
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || "Voice synthesis failed");
    }
    const blob = await resp.blob();
    stopRichAudio();
    richAudioUrl = URL.createObjectURL(blob);
    richAudio = new Audio(richAudioUrl);
    richAudio.onended = () => {
      if (richAudioUrl) {
        URL.revokeObjectURL(richAudioUrl);
        richAudioUrl = "";
      }
    };
    await richAudio.play();
    setRichStatus("Server: ready", false);
  } catch (err) {
    setRichStatus(`Voice error: ${err.message}`, true);
  }
}

function setRichMicStatus(message, isError) {
  const el = document.getElementById("richMicStatus");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function setRichMicButton(active) {
  const btn = document.getElementById("richMicBtn");
  if (!btn) return;
  btn.textContent = active ? "Stop" : "Mic";
}

function hasBrowserSpeech() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

async function refreshRichSpeechHealth() {
  const base = getRichApiBase();
  if (!base) {
    richSpeechAvailable = false;
    richSpeechBackend = "";
    if (hasBrowserSpeech()) {
      setRichMicStatus("Mic: browser ready", false);
    } else {
      setRichMicStatus("Mic: set API host", true);
    }
    return;
  }

  try {
    const resp = await fetch(`${base}/v1/speech/health`, {
      method: "GET",
      headers: getRichAuthHeaders()
    });
    if (resp.status === 401) {
      richSpeechAvailable = false;
      richSpeechBackend = "";
      setRichMicStatus("Mic: set API key", true);
      return;
    }
    if (!resp.ok) {
      throw new Error("Speech health check failed");
    }
    const data = await resp.json();
    richSpeechAvailable = !!data?.available;
    richSpeechBackend = data?.backend || "";
    if (richSpeechAvailable) {
      setRichMicStatus(`Mic: server (${richSpeechBackend || "ready"})`, false);
    } else if (hasBrowserSpeech()) {
      setRichMicStatus("Mic: browser ready", false);
    } else {
      setRichMicStatus("Mic: server unavailable", true);
    }
  } catch (err) {
    richSpeechAvailable = false;
    richSpeechBackend = "";
    if (hasBrowserSpeech()) {
      setRichMicStatus("Mic: browser ready", false);
    } else {
      setRichMicStatus("Mic: offline", true);
    }
  }
}

async function transcribeRichAudio(blob, mimeType) {
  const base = getRichApiBase();
  const headers = getRichAuthHeaders();
  const form = new FormData();
  let ext = "webm";
  const type = (mimeType || blob.type || "").toLowerCase();
  if (type.includes("ogg")) ext = "ogg";
  if (type.includes("wav")) ext = "wav";
  if (type.includes("mp3") || type.includes("mpeg")) ext = "mp3";
  form.append("file", blob, `speech.${ext}`);
  const resp = await fetch(`${base}/v1/speech/transcribe`, {
    method: "POST",
    headers,
    body: form
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(txt || "Transcription failed");
  }
  const data = await resp.json();
  const text = (data?.text || "").trim();
  if (!text) throw new Error("No speech detected");
  return text;
}

async function startRichServerMic() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Microphone not supported");
  }
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder not supported");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (evt) => {
    if (evt.data && evt.data.size > 0) chunks.push(evt.data);
  };
  recorder.onstop = async () => {
    try {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      setRichMicStatus("Transcribing...", false);
      const text = await transcribeRichAudio(blob, recorder.mimeType || blob.type);
      const input = document.getElementById("richInput");
      if (input) input.value = text;
      await sendRichMessage(text);
    } catch (err) {
      setRichMicStatus(`Mic error: ${err.message}`, true);
    }
  };
  recorder.start();
  richMediaRecorder = recorder;
  richMicStream = stream;
  richMicActive = true;
  setRichMicButton(true);
  setRichMicStatus("Listening (server)... tap Mic to stop", false);
  if (richMicTimeout) clearTimeout(richMicTimeout);
  richMicTimeout = setTimeout(() => {
    if (richMicActive) stopRichMic();
  }, 15000);
}

function stopRichServerMic() {
  if (richMediaRecorder && richMediaRecorder.state !== "inactive") {
    richMediaRecorder.stop();
  }
  if (richMicStream) {
    richMicStream.getTracks().forEach((t) => t.stop());
  }
  richMediaRecorder = null;
  richMicStream = null;
}

function startRichBrowserMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    throw new Error("Browser speech not supported");
  }
  const recognition = new SpeechRecognition();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = async (event) => {
    try {
      const text = (event?.results?.[0]?.[0]?.transcript || "").trim();
      if (!text) throw new Error("No speech detected");
      const input = document.getElementById("richInput");
      if (input) input.value = text;
      await sendRichMessage(text);
    } catch (err) {
      setRichMicStatus(`Mic error: ${err.message}`, true);
    }
  };
  recognition.onerror = (event) => {
    const msg = event?.error || "Browser speech error";
    setRichMicStatus(`Mic error: ${msg}`, true);
  };
  recognition.onend = () => {
    richMicActive = false;
    setRichMicButton(false);
    setRichMicStatus("Mic: idle", false);
  };
  recognition.start();
  richRecognition = recognition;
  richMicActive = true;
  setRichMicButton(true);
  setRichMicStatus("Listening (browser)... tap Mic to stop", false);
}

function stopRichBrowserMic() {
  if (richRecognition) {
    richRecognition.stop();
  }
  richRecognition = null;
}

function stopRichMic() {
  if (!richMicActive) return;
  richMicActive = false;
  if (richMicTimeout) clearTimeout(richMicTimeout);
  richMicTimeout = null;
  stopRichServerMic();
  stopRichBrowserMic();
  setRichMicButton(false);
  setRichMicStatus("Mic: idle", false);
}

async function toggleRichMic() {
  if (richMicActive) {
    stopRichMic();
    return;
  }
  stopRichAudio();
  try {
    if (richSpeechAvailable) {
      await startRichServerMic();
      return;
    }
    if (hasBrowserSpeech()) {
      startRichBrowserMic();
      return;
    }
    setRichMicStatus("Mic: no speech backend", true);
  } catch (err) {
    setRichMicStatus(`Mic error: ${err.message}`, true);
    stopRichMic();
  }
}

async function sendRichMessage(forcedText) {
  const input = document.getElementById("richInput");
  const btn = document.getElementById("richSendBtn");
  const raw = typeof forcedText === "string" ? forcedText : (input ? input.value : "");
  const text = raw.trim();
  if (!text) return;

  const model = getRichModel();
  if (!model) {
    setRichStatus("Set a model name before sending.", true);
    return;
  }

  const useContext = document.getElementById("richContextToggle")?.checked;
  const systemRules =
    "You are RICH, a female AI assistant. Never refer to yourself as Jarvis. " +
    "Always begin every response with: \"Master Kut Milz \" (exact capitalization and trailing space). " +
    "Be concise, helpful, and focus on improving the trading logic when asked.";
  const systemContent = useContext
    ? `${systemRules}\n\nDashboard context (for reference only):\n${buildRichContext()}`
    : systemRules;

  appendRichMessage("user", text);
  richHistory.push({ role: "user", content: text });
  richHistory = richHistory.slice(-richMaxHistory);
  if (input) input.value = "";

  if (btn) btn.disabled = true;
  setRichStatus("Contacting RICH...", false);

  const messages = [
    { role: "system", content: systemContent },
    ...richHistory.map((m) => ({ role: m.role, content: m.content })),
  ];

  const payload = {
    model,
    messages,
    temperature: 0.4,
    max_tokens: 700,
    stream: false
  };

  try {
    const base = getRichApiBase();
    const resp = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: getRichApiHeaders(),
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || "Request failed");
    }
    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content || "Master Kut Milz (no response)";
    appendRichMessage("assistant", reply);
    richHistory.push({ role: "assistant", content: reply });
    richHistory = richHistory.slice(-richMaxHistory);
    if (isRichSpeakEnabled()) {
      await speakRichReply(reply);
    } else {
      setRichStatus("Server: ready", false);
    }
  } catch (err) {
    setRichStatus(`Error: ${err.message}`, true);
    appendRichMessage("assistant", "Master Kut Milz I could not reach the local server.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function saveRichMemory() {
  const note = document.getElementById("richMemoryNote")?.value.trim() || "";
  const contentParts = [
    "Digit Analyzer memory snapshot:",
    buildRichContext()
  ];
  if (note) {
    contentParts.push("", "User note:", note);
  }
  const payload = {
    content: contentParts.join("\n"),
    metadata: {
      source: "digit-analyzer-ui",
      saved_at: new Date().toISOString()
    }
  };

  setRichStatus("Saving to memory...", false);
  try {
    const base = getRichApiBase();
    const resp = await fetch(`${base}/v1/memory/store`, {
      method: "POST",
      headers: getRichApiHeaders(),
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || "Memory store failed");
    }
    setRichStatus("Memory saved.", false);
  } catch (err) {
    setRichStatus(`Memory error: ${err.message}`, true);
  }
}

function initRichChat() {
  const sendBtn = document.getElementById("richSendBtn");
  const input = document.getElementById("richInput");
  const memoryBtn = document.getElementById("richMemoryBtn");
  const micBtn = document.getElementById("richMicBtn");
  const modelInput = document.getElementById("richModelInput");
  const apiHostInput = document.getElementById("richApiHostInput");
  const apiKeyInput = document.getElementById("richApiKeyInput");
  const ttsBackendInput = document.getElementById("richTtsBackendInput");
  const voiceInput = document.getElementById("richVoiceInput");
  const speakToggle = document.getElementById("richSpeakToggle");
  if (modelInput) {
    const savedModel = localStorage.getItem("richModel") || "";
    if (!modelInput.value) modelInput.value = savedModel;
    modelInput.addEventListener("change", () => {
      localStorage.setItem("richModel", modelInput.value.trim());
    });
  }
  if (apiHostInput) {
    const savedHost = localStorage.getItem("richApiHost") || "";
    if (!apiHostInput.value) {
      apiHostInput.value = savedHost || (window.location.hostname ? `${window.location.hostname}:8000` : "127.0.0.1:8000");
    }
    apiHostInput.addEventListener("change", () => {
      localStorage.setItem("richApiHost", apiHostInput.value.trim());
      refreshRichSpeechHealth();
    });
  }
  if (apiKeyInput) {
    const savedKey = localStorage.getItem("richApiKey") || "";
    if (!apiKeyInput.value) apiKeyInput.value = savedKey;
    apiKeyInput.addEventListener("change", () => {
      localStorage.setItem("richApiKey", apiKeyInput.value.trim());
      refreshRichSpeechHealth();
    });
  }
  if (ttsBackendInput) {
    const savedBackend = localStorage.getItem("richTtsBackend") || "";
    if (!ttsBackendInput.value) ttsBackendInput.value = savedBackend || "kokoro";
    ttsBackendInput.addEventListener("change", () => {
      localStorage.setItem("richTtsBackend", ttsBackendInput.value.trim());
    });
  }
  if (voiceInput) {
    const savedVoice = localStorage.getItem("richVoiceId") || "";
    if (!voiceInput.value) voiceInput.value = savedVoice || "af_heart";
    voiceInput.addEventListener("change", () => {
      localStorage.setItem("richVoiceId", voiceInput.value.trim());
    });
  }
  if (speakToggle) {
    const savedSpeak = localStorage.getItem("richSpeak") || "";
    if (savedSpeak) {
      speakToggle.checked = savedSpeak === "true";
    } else {
      speakToggle.checked = true;
    }
    speakToggle.addEventListener("change", () => {
      localStorage.setItem("richSpeak", speakToggle.checked ? "true" : "false");
      if (!speakToggle.checked) stopRichAudio();
    });
  }
  if (sendBtn) sendBtn.addEventListener("click", sendRichMessage);
  if (micBtn) micBtn.addEventListener("click", toggleRichMic);
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendRichMessage();
      }
    });
  }
  if (memoryBtn) memoryBtn.addEventListener("click", saveRichMemory);
  setRichStatus("Server: idle", false);
  setRichMicStatus("Mic: checking...", false);
  refreshRichSpeechHealth();
  appendRichMessage("assistant", "Master Kut Milz I'm ready. Set a model and ask away.");
}

function setAccountType(isVirtual, loginid) {
  accountIsVirtual = isVirtual;
  accountLoginId = loginid || "--";
  const badge = document.getElementById("accountBadge");
  const idEl = document.getElementById("accountId");
  if (badge) {
    badge.textContent = isVirtual === null ? "unknown" : isVirtual ? "demo" : "real";
    badge.className = "badge " + (isVirtual === null ? "bX" : isVirtual ? "bA" : "bG");
  }
  if (idEl) idEl.textContent = accountLoginId;
  const confirmInfo = document.getElementById("liveConfirmInfo");
  if (confirmInfo) {
    confirmInfo.textContent = isVirtual
      ? "This will place trades on your DEMO account."
      : "This will place real trades using your Deriv account.";
  }
  if (isVirtual === null) return;
  logSys(`Account detected: ${isVirtual ? "DEMO" : "REAL"} (${accountLoginId})`, "info");
}

function nextReqId() {
  reqIdCounter += 1;
  return reqIdCounter;
}

function setLiveTradingEnabled(enabled) {
  liveTradingEnabled = enabled;
  const badge = document.getElementById("liveBadge");
  if (badge) {
    badge.textContent = enabled ? "LIVE" : "SIM";
    badge.className = "badge " + (enabled ? "bR" : "bX");
  }
  logSys(`Live trading ${enabled ? "armed" : "disarmed"}.`, enabled ? "warn" : "info");
}

function initLiveTradingControls() {
  const toggle = document.getElementById("liveToggle");
  const confirmWrap = document.getElementById("liveConfirmWrap");
  const confirmInput = document.getElementById("liveConfirmInput");
  const confirmBtn = document.getElementById("liveConfirmBtn");
  const confirmErr = document.getElementById("liveConfirmError");
  const botOn = document.getElementById("botOn");
  const botModeBadge = document.getElementById("botModeBadge");

  if (!toggle) return;

  const showConfirm = () => {
    if (confirmWrap) confirmWrap.style.display = "block";
    if (confirmErr) confirmErr.textContent = "";
    if (confirmInput) {
      confirmInput.value = "";
      confirmInput.focus();
    }
  };

  const hideConfirm = () => {
    if (confirmWrap) confirmWrap.style.display = "none";
    if (confirmErr) confirmErr.textContent = "";
  };

  const arm = () => {
    const code = (confirmInput && confirmInput.value ? confirmInput.value : "").trim().toUpperCase();
    if (demoMode) {
      if (confirmErr) confirmErr.textContent = "Disable demo mode before arming live trading.";
      logSys("Cannot arm live trading while in simulated demo mode.", "warn");
      return;
    }
    if (!connected) {
      if (confirmErr) confirmErr.textContent = "Connect your API key first.";
      logSys("Cannot arm live trading without a connection.", "warn");
      return;
    }
    if (code !== "TRADE") {
      if (confirmErr) confirmErr.textContent = "Type TRADE to arm live trading.";
      logSys("Live trading arm failed: confirmation text mismatch.", "warn");
      return;
    }
    setLiveTradingEnabled(true);
    hideConfirm();
    logSys("Live trading armed. Bot can place real trades.", "warn");
  };

  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      setLiveTradingEnabled(false);
      showConfirm();
    } else {
      setLiveTradingEnabled(false);
      hideConfirm();
    }
  });

  if (confirmBtn) confirmBtn.addEventListener("click", arm);
  if (confirmInput) {
    confirmInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") arm();
    });
  }

  if (botOn && botModeBadge) {
    botOn.addEventListener("change", () => {
      autoMode = botOn.checked;
      botModeBadge.textContent = autoMode ? "auto" : "manual";
      botModeBadge.className = "badge " + (autoMode ? "bG" : "bX");
      logSys(`Bot mode set to ${autoMode ? "AUTO" : "MANUAL"}.`, "info");
    });
  }
}

function initAlertModal() {
  const closeBtn = document.getElementById("alertCloseBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      const modal = document.getElementById("riskAlert");
      if (modal) modal.classList.add("hidden");
    });
  }
}

function maybeNotify(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch (e) { /* ignore */ }
  }
}

function showRiskAlert(type, message) {
  const modal = document.getElementById("riskAlert");
  if (!modal) return;
  const badge = document.getElementById("alertBadge");
  const title = document.getElementById("alertTitle");
  const msg = document.getElementById("alertMessage");
  const label = type === "tp" ? "Take profit" : "Stop loss";
  if (badge) {
    badge.textContent = label;
    badge.className = "alert-badge " + (type === "tp" ? "bG" : "bR");
  }
  if (title) title.textContent = type === "tp" ? "Take profit hit" : "Stop loss hit";
  if (msg) msg.textContent = message;
  modal.classList.remove("hidden");
  maybeNotify(title ? title.textContent : "Risk alert", message);
}

function getLastDigitFromQuote(spot) {
  const num = Number(spot);
  if (Number.isNaN(num)) return "--";
  const digit = String(Math.round(num * 100)).slice(-1);
  return digit;
}

function setConn(v, label) {
  connected = v;
  const dot = document.getElementById("connDot");
  const badge = document.getElementById("connBadge");
  const aDot = document.getElementById("apiDot");
  const aLbl = document.getElementById("apiStatusLbl");
  if (v) {
    dot.className = "sdot dLive";
    badge.textContent = "live";
    badge.className = "badge bG";
    aDot.className = "sdot dLive";
    aLbl.textContent = label || "Connected";
    aLbl.style.color = "#71e48a";
    logSys(label || "Connected.", "info");
  } else {
    dot.className = "sdot dOff";
    badge.textContent = "offline";
    badge.className = "badge bX";
    aDot.className = "sdot dOff";
    aLbl.textContent = "Not connected";
    aLbl.style.color = "var(--muted)";
    setLiveTradingEnabled(false);
    setAccountType(null, "--");
    const liveToggle = document.getElementById("liveToggle");
    if (liveToggle) liveToggle.checked = false;
    tradeInFlight = false;
    logSys("Disconnected from Deriv.", "warn");
  }
  const botOn = document.getElementById("botOn");
  if (botOn && !connected) {
    botOn.checked = false;
    autoMode = false;
    const botModeBadge = document.getElementById("botModeBadge");
    if (botModeBadge) {
      botModeBadge.textContent = "manual";
      botModeBadge.className = "badge bX";
    }
  }
}

function setConnErr(msg) {
  document.getElementById("apiDot").className = "sdot dErr";
  const lbl = document.getElementById("apiStatusLbl");
  lbl.textContent = msg;
  lbl.style.color = "#ff5c5c";
  logSys(msg, "error");
}

function connectWithKey() {
  demoMode = false;
  logSys("Connecting to Deriv...", "info");
  const key = document.getElementById("apiKeyInput").value.trim();
  if (!key) {
    setConnErr("Enter an API token first");
    return;
  }
  document.getElementById("apiStatusLbl").textContent = "Authorizing...";
  document.getElementById("apiDot").className = "sdot dWarn";
  const sym = document.getElementById("symSel").value;
  try {
    ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");
    ws.onopen = () => {
      ws.send(JSON.stringify({ authorize: key }));
    };
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.msg_type === "authorize") {
        if (d.error) {
          setConnErr("Auth failed: " + d.error.message);
          ws.close();
          return;
        }
        const auth = d.authorize || {};
        const isVirtual = auth.is_virtual === 1 || (auth.loginid || "").toUpperCase().startsWith("VRT");
        setAccountType(isVirtual, auth.loginid || "--");
        setConn(true, "Authorized - " + sym);
        if (auth.balance !== undefined) setBalance(auth.balance, auth.currency);
        ws.send(JSON.stringify({ ticks: sym, subscribe: 1 }));
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
      }
      if (d.msg_type === "balance" && d.balance) {
        setBalance(d.balance.balance, d.balance.currency);
      }
      if (d.msg_type === "proposal") {
        handleProposalResponse(d);
      }
      if (d.msg_type === "buy") {
        handleBuyResponse(d);
      }
      if (d.msg_type === "proposal_open_contract") {
        handleOpenContract(d);
      }
      if (d.tick) {
        const q = parseFloat(d.tick.quote);
        const digit = parseInt(String(Math.round(q * 100)).slice(-1), 10);
        pushDigit(digit, d.tick.epoch);
      }
    };
    ws.onerror = () => { setConnErr("Connection error"); };
    ws.onclose = () => { if (connected) { setConn(false); } };
  } catch (e) {
    setConnErr("WebSocket error");
  }
}

function connectDemo() {
  demoMode = true;
  if (ws) { ws.close(); }
  setConn(true, "Demo mode (simulated)");
  document.getElementById("apiStatusLbl").textContent = "Demo mode - simulated digits";
  setBalance(demoBalanceBase + sessionPL, "USD");
  setAccountType(true, "SIM");
  setLiveTradingEnabled(false);
  logSys("Simulated demo mode started (not connected to Deriv).", "info");
  const liveToggle = document.getElementById("liveToggle");
  if (liveToggle) liveToggle.checked = false;
  let iv = setInterval(() => {
    if (!connected) { clearInterval(iv); return; }
    pushDigit(Math.floor(Math.random() * 10), Math.floor(Date.now() / 1000));
  }, 900);
}

function buildLiveContractParams() {
  const type = document.getElementById("ctType").value;
  const pred = document.getElementById("ctPred").value;
  const stakeVal = parseFloat(document.getElementById("stakeVal").value);
  const durationTicks = parseInt(document.getElementById("durTicks").value, 10);
  const sym = document.getElementById("symSel").value;

  if (!stakeVal || stakeVal <= 0) {
    setBotSt("paused");
    return null;
  }
  if (!durationTicks || durationTicks < 1) {
    setBotSt("paused");
    return null;
  }

  let contractType = "";
  let barrier = null;
  let paramsLabel;

  if (type === "Over/Under") {
    let resolvedPred = pred;
    if (pred === "Best") {
      resolvedPred = resolveBestOverUnderPrediction();
    }
    if (resolvedPred.startsWith("Over ")) { contractType = "DIGITOVER"; barrier = resolvedPred.split(" ")[1]; }
    if (resolvedPred.startsWith("Under ")) { contractType = "DIGITUNDER"; barrier = resolvedPred.split(" ")[1]; }
    if (pred === "Best") {
      paramsLabel = resolvedPred;
    }
  } else if (type === "Even/Odd") {
    contractType = pred === "Even" ? "DIGITEVEN" : "DIGITODD";
  } else {
    if (pred.startsWith("Matches ")) { contractType = "DIGITMATCH"; barrier = pred.split(" ")[1]; }
    if (pred.startsWith("Differs ")) { contractType = "DIGITDIFF"; barrier = pred.split(" ")[1]; }
  }

  if (!contractType) return null;

  const label = typeof paramsLabel === "string" ? paramsLabel : pred;
  return {
    predLabel: label,
    amount: stakeVal,
    contract_type: contractType,
    barrier,
    duration: durationTicks,
    duration_unit: "t",
    currency: liveCurrency || "USD",
    underlying_symbol: sym
  };
}

function resolveBestOverUnderPrediction() {
  const ref = digits.slice(-200);
  const n = ref.length || 1;
  const overHitsCount = overHits(activeOverThr, ref);
  const underHitsCount = underHits(activeUnderThr, ref);
  const overPct = overHitsCount / n * 100;
  const underPct = underHitsCount / n * 100;
  return overPct >= underPct ? `Over ${activeOverThr}` : `Under ${activeUnderThr}`;
}

function addTradeRow(trade) {
  const tb = document.getElementById("tradeBody");
  if (tb.rows[0] && tb.rows[0].cells.length === 1) tb.innerHTML = "";
  const tr = document.createElement("tr");
  tr.dataset.localId = String(trade.id);
  const resultBadge = trade.status === "ERROR" ? "bR" : trade.status === "OPEN" ? "bA" : trade.win ? "bG" : "bR";
  const resultLabel = trade.status === "ERROR" ? "ERR" : trade.status === "OPEN" ? "OPEN" : trade.win ? "W" : "L";
  const plText = trade.pl === null || trade.pl === undefined ? "--" : (trade.pl >= 0 ? "+" : "") + "$" + Number(trade.pl).toFixed(2);
  const digitText = trade.digit === null || trade.digit === undefined ? "--" : trade.digit;
  tr.innerHTML = `<td>${trade.id}</td><td style="font-size:11px">${trade.pred}</td><td>${digitText}</td><td><span class="badge ${resultBadge}">${resultLabel}</span></td><td>$${trade.stake.toFixed(2)}</td><td style="color:${trade.pl >= 0 ? "#71e48a" : trade.pl < 0 ? "#ff5c5c" : "var(--muted)"}">${plText}</td><td style="font-size:11px">${trade.t}</td>`;
  tb.insertBefore(tr, tb.firstChild);
  return tr;
}

function updateTradeRow(trade) {
  const tr = tradeRows[trade.id];
  if (!tr) return;
  const cells = tr.querySelectorAll("td");
  if (cells.length < 7) return;
  const resultBadge = trade.status === "ERROR" ? "bR" : trade.status === "OPEN" ? "bA" : trade.win ? "bG" : "bR";
  const resultLabel = trade.status === "ERROR" ? "ERR" : trade.status === "OPEN" ? "OPEN" : trade.win ? "W" : "L";
  const plText = trade.pl === null || trade.pl === undefined ? "--" : (trade.pl >= 0 ? "+" : "") + "$" + Number(trade.pl).toFixed(2);
  const digitText = trade.digit === null || trade.digit === undefined ? "--" : trade.digit;
  cells[2].textContent = digitText;
  cells[3].innerHTML = `<span class="badge ${resultBadge}">${resultLabel}</span>`;
  cells[5].textContent = plText;
  cells[5].style.color = trade.pl > 0 ? "#71e48a" : trade.pl < 0 ? "#ff5c5c" : "var(--muted)";
}

function placeRealTrade() {
  if (!liveTradingEnabled || demoMode) return;
  if (tradeInFlight) return;
  if (!connected || !ws || ws.readyState !== 1) return;
  if (checkLimits()) return;

  const params = buildLiveContractParams();
  if (!params) return;

  tradeInFlight = true;

  const localId = nextLocalTradeId;
  nextLocalTradeId += 1;
  const trade = {
    id: localId,
    n: localId,
    pred: params.predLabel,
    digit: "--",
    win: null,
    stake: params.amount,
    pl: null,
    t: new Date().toLocaleTimeString(),
    status: "OPEN",
    contractId: null
  };
  trades.push(trade);
  tradeRows[localId] = addTradeRow(trade);
  const proposalReqId = nextReqId();
  pendingProposals[proposalReqId] = trade;

  const proposalReq = {
    proposal: 1,
    amount: params.amount,
    basis: "stake",
    contract_type: params.contract_type,
    currency: params.currency,
    duration: params.duration,
    duration_unit: params.duration_unit,
    underlying_symbol: params.underlying_symbol,
    passthrough: { local_trade_id: localId },
    req_id: proposalReqId
  };

  if (params.barrier !== null && params.barrier !== undefined) {
    proposalReq.barrier = String(params.barrier);
  }

  ws.send(JSON.stringify(proposalReq));
  logSys(`Proposal sent: ${params.contract_type} ${params.barrier !== null ? params.barrier : ""} ${params.duration}t ${params.underlying_symbol} stake ${params.amount} ${params.currency}`, "info");
}

function handleBuyResponse(d) {
  if (d.error) {
    const localId = d.echo_req && d.echo_req.passthrough ? d.echo_req.passthrough.local_trade_id : null;
    if (localId && pendingBuys[localId]) {
      const trade = pendingBuys[localId];
      trade.status = "ERROR";
      trade.pl = 0;
      trade.win = false;
      updateTradeRow(trade);
      delete pendingBuys[localId];
    }
    tradeInFlight = false;
    setBotSt("paused");
    logSys(`Buy error: ${d.error.message || "unknown error"}`, "error");
    return;
  }
  const localId = d.echo_req && d.echo_req.passthrough ? d.echo_req.passthrough.local_trade_id : null;
  if (!localId) {
    tradeInFlight = false;
    return;
  }
  const trade = pendingBuys[localId];
  if (!trade || !d.buy) {
    tradeInFlight = false;
    return;
  }
  trade.contractId = d.buy.contract_id;
  openContracts[trade.contractId] = trade;
  delete pendingBuys[localId];
  ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: trade.contractId, subscribe: 1, req_id: nextReqId() }));
  logSys(`Contract opened: ${trade.contractId}`, "info");
}

function handleProposalResponse(d) {
  if (d.error) {
    const reqIdErr = d.req_id || (d.echo_req && d.echo_req.req_id);
    const tradeErr = pendingProposals[reqIdErr];
    if (tradeErr) {
      tradeErr.status = "ERROR";
      tradeErr.pl = 0;
      tradeErr.win = false;
      updateTradeRow(tradeErr);
      delete pendingProposals[reqIdErr];
    }
    tradeInFlight = false;
    setBotSt("paused");
    logSys(`Proposal error: ${d.error.message || "unknown error"}`, "error");
    return;
  }
  if (!d.proposal) return;
  const reqId = d.req_id || (d.echo_req && d.echo_req.req_id);
  const trade = pendingProposals[reqId];
  if (!trade) {
    tradeInFlight = false;
    return;
  }

  const proposalId = d.proposal.id;
  const askPrice = Number(d.proposal.ask_price || trade.stake);
  pendingBuys[trade.id] = trade;
  delete pendingProposals[reqId];

  const buyReq = {
    buy: proposalId,
    price: askPrice,
    passthrough: { local_trade_id: trade.id },
    req_id: nextReqId()
  };

  ws.send(JSON.stringify(buyReq));
  logSys(`Buy sent: proposal ${proposalId} price ${askPrice}`, "info");
}

function handleOpenContract(d) {
  if (!d.proposal_open_contract) return;
  const poc = d.proposal_open_contract;
  const contractId = poc.contract_id;
  const trade = openContracts[contractId];
  if (!trade) return;
  const isSold = poc.is_sold || poc.status === "sold";
  if (!isSold) return;

  const profit = Number(poc.profit || 0);
  trade.pl = profit;
  trade.win = profit > 0;
  trade.status = trade.win ? "WON" : "LOST";
  trade.digit = getLastDigitFromQuote(poc.exit_spot || poc.sell_spot || poc.entry_spot);
  updateTradeRow(trade);

  sessionPL += profit;
  if (trade.win) { sessionWins += 1; lossStreak = 0; }
  else { sessionLosses += 1; lossStreak += 1; }
  updatePL();
  checkLimits();

  tradeInFlight = false;
  delete openContracts[contractId];
  logSys(`Contract closed: ${contractId} P/L ${profit >= 0 ? "+" : ""}${profit}`, "info");
}

function pushDigit(d, epoch) {
  digits.push(d);
  allDigits.push({ d, t: epoch });
  if (digits.length > 500) digits.shift();
  renderTape();
  renderLiveMetrics();
  renderOUGrids();
  renderSplitBar();
  renderFreq();
  renderWindow();
  renderFlowDots();
  renderOUDots();
  checkSignals(d);
  appendLog(d, epoch);
  if (botActive && !botPaused) {
    if (autoMode) {
      if (liveTradingEnabled && !demoMode) placeRealTrade();
      else evalBot(d);
    }
  }
}

function renderTape() {
  const el = document.getElementById("tape");
  const last = digits.slice(-50);
  el.innerHTML = last.map((d) => {
    const c = DC[d];
    const over = d > activeOverThr;
    const under = d < activeUnderThr;
    const extra = over ? " d-over" : under ? " d-under" : "";
    return `<span class="dc${extra}" style="background:${c.bg};color:${c.tc}" title="${d}">${d}</span>`;
  }).join("");
}

function renderLiveMetrics() {
  const n = digits.length;
  if (!n) return;
  const evens = digits.filter((x) => x % 2 === 0).length;
  let rpt = 0;
  for (let i = 1; i < digits.length; i += 1) if (digits[i] === digits[i - 1]) rpt += 1;
  document.getElementById("mTotal").textContent = n;
  document.getElementById("mLast").textContent = digits[n - 1];
  document.getElementById("mEven").textContent = ((evens / n) * 100).toFixed(1) + "%";
  document.getElementById("mOdd").textContent = (((n - evens) / n) * 100).toFixed(1) + "%";
  document.getElementById("mRepeat").textContent = rpt;
  const sk = calcOUStreak();
  document.getElementById("mStreak").textContent = sk.count + (sk.type ? " " + sk.type : "");
  document.getElementById("mRateThr").textContent = activeOverThr;
  const l50 = digits.slice(-50);
  const rate = (l50.filter((x) => x > activeOverThr).length / (l50.length || 1)) * 100;
  document.getElementById("mRate").textContent = rate.toFixed(1) + "%";
  document.getElementById("mRate").style.color = rate > 55 ? "#71e48a" : rate < 45 ? "#ff5c5c" : "#5aa9ff";
}

function overHits(t, arr) { return arr.filter((x) => x > t).length; }
function underHits(t, arr) { return arr.filter((x) => x < t).length; }

function renderOUGrids() {
  const ref = digits.slice(-200);
  const n = ref.length || 1;
  document.getElementById("overRow1").innerHTML = [0, 1, 2, 3, 4].map((t) => buildOUCell(t, "over", ref, n)).join("");
  document.getElementById("overRow2").innerHTML = [5, 6, 7, 8, 9].map((t) => buildOUCell(t, "over", ref, n)).join("");
  document.getElementById("underRow1").innerHTML = [0, 1, 2, 3, 4].map((t) => buildOUCell(t, "under", ref, n)).join("");
  document.getElementById("underRow2").innerHTML = [5, 6, 7, 8, 9].map((t) => buildOUCell(t, "under", ref, n)).join("");
  const oH = overHits(activeOverThr, ref);
  const uH = underHits(activeUnderThr, ref);
  const op = (oH / n * 100).toFixed(1);
  const up = (uH / n * 100).toFixed(1);
  document.getElementById("activeOverBadge").textContent = "Over " + activeOverThr;
  document.getElementById("overHitBadge").textContent = op + "%";
  document.getElementById("overHitCount").textContent = oH + " of " + ref.length;
  document.getElementById("activeUnderBadge").textContent = "Under " + activeUnderThr;
  document.getElementById("underHitBadge").textContent = up + "%";
  document.getElementById("underHitCount").textContent = uH + " of " + ref.length;
  document.getElementById("splitOLbl").textContent = activeOverThr;
  document.getElementById("splitULbl").textContent = activeUnderThr;
  document.getElementById("mRateThr").textContent = activeOverThr;
  if (document.getElementById("sigOverThr")) document.getElementById("sigOverThr").textContent = activeOverThr;
  if (document.getElementById("sigUnderThr")) document.getElementById("sigUnderThr").textContent = activeUnderThr;
}

function buildOUCell(thr, type, ref, n) {
  const hits = type === "over" ? overHits(thr, ref) : underHits(thr, ref);
  const pct = hits / n * 100;
  const sel = type === "over" ? activeOverThr === thr : activeUnderThr === thr;
  const selCls = sel ? (type === "over" ? "sel-over" : "sel-under") : "";
  const fill = type === "over" ? "#8bff5c" : "#5aa9ff";
  const lbl = type === "over" ? `> ${thr}` : `< ${thr}`;
  const pctColor = pct > 55 ? (type === "over" ? "#71e48a" : "#5aa9ff") : pct < 45 ? "#ff5c5c" : "var(--muted)";
  return `<div class="ou-cell ${selCls}" onclick="setThr('${type}',${thr})">
    <div class="ou-num">${thr}</div>
    <div class="ou-label">${lbl}</div>
    <div class="ou-pct" style="color:${pctColor}">${pct.toFixed(1)}%</div>
    <div class="ou-bar"><div class="ou-fill" style="width:${Math.min(pct, 100).toFixed(1)}%;background:${fill}"></div></div>
  </div>`;
}

function setThr(type, thr) {
  if (type === "over") activeOverThr = thr;
  else activeUnderThr = thr;
  renderOUGrids();
  renderSplitBar();
  renderOUDots();
  renderFlowDots();
  renderTape();
  renderLiveMetrics();
}

function renderSplitBar() {
  const ref = digits.slice(-200);
  const n = ref.length || 1;
  const o = overHits(activeOverThr, ref);
  const u = underHits(activeUnderThr, ref);
  const op = o / n * 100;
  const up = u / n * 100;
  document.getElementById("sbO").style.width = op.toFixed(1) + "%";
  document.getElementById("sbO").textContent = op.toFixed(1) + "%";
  document.getElementById("sbU").style.width = up.toFixed(1) + "%";
  document.getElementById("sbU").textContent = up.toFixed(1) + "%";
  document.getElementById("soHits").textContent = o;
  document.getElementById("suHits").textContent = u;
  document.getElementById("soStreak").textContent = calcRunStreak((x) => x > activeOverThr);
  document.getElementById("suStreak").textContent = calcRunStreak((x) => x < activeUnderThr);
}

function calcRunStreak(fn) {
  let c = 0;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    if (fn(digits[i])) c += 1;
    else break;
  }
  return c;
}

function calcOUStreak() {
  if (!digits.length) return { count: 0, type: "" };
  const last = digits[digits.length - 1];
  const type = last > activeOverThr ? "over" : last < activeUnderThr ? "under" : "mid";
  if (type === "mid") return { count: 1, type: "mid" };
  const fn = type === "over" ? (x) => x > activeOverThr : (x) => x < activeUnderThr;
  let c = 0;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    if (fn(digits[i])) c += 1;
    else break;
  }
  return { count: c, type };
}

function renderFreq() {
  const el = document.getElementById("freqChart");
  const n = digits.length || 1;
  const counts = Array.from({ length: 10 }, (_, i) => digits.filter((x) => x === i).length);
  const maxC = Math.max(...counts, 1);
  el.innerHTML = counts.map((cnt, i) => {
    const pct = cnt / n * 100;
    const barW = cnt / maxC * 100;
    const c = DC[i];
    return `<div class="bar-row">
      <span class="bar-lbl">${i}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${barW.toFixed(1)}%;background:${c.bg};border:0.5px solid ${c.tc}30"></div></div>
      <span class="bar-pct">${pct.toFixed(1)}%</span>
      <span class="bar-cnt">${cnt}</span>
    </div>`;
  }).join("");
  const sorted = [...counts.map((c, i) => ({ d: i, c }))].sort((a, b) => b.c - a.c);
  document.getElementById("hotD").textContent = sorted[0].c > 0 ? sorted[0].d : "--";
  document.getElementById("coldD").textContent = sorted[9].d;
  const heat = document.getElementById("heatGrid");
  const maxH = Math.max(...counts, 1);
  heat.innerHTML = counts.map((cnt, i) => {
    const intensity = cnt / maxH;
    const r = Math.round(234 - (intensity * 80));
    const g = Math.round(243 - (intensity * 40));
    const b = Math.round(222 - (intensity * 100));
    return `<div class="hc" style="background:rgb(${r},${g},${b});color:#0f2415">${i}<div style="font-size:9px;color:#2e8c48;margin-top:1px">${cnt}</div></div>`;
  }).join("");
  let maxS = 0, curS = 0, lastD = -1;
  for (const d of digits) {
    if (d === lastD) { curS += 1; if (curS > maxS) maxS = curS; }
    else { curS = 1; lastD = d; }
  }
  document.getElementById("maxRepD").textContent = maxS > 1 ? `${maxS}x` : "--";
}

function renderWindow() {
  const w = parseInt(document.getElementById("winRange").value, 10) || 100;
  const ref = digits.slice(-w);
  const n = ref.length || 1;
  const el = document.getElementById("winStats");
  if (!ref.length) {
    el.innerHTML = '<span class="muted">No data yet</span>';
    return;
  }
  const o = (overHits(activeOverThr, ref) / n * 100).toFixed(1);
  const u = (underHits(activeUnderThr, ref) / n * 100).toFixed(1);
  const ev = (ref.filter((x) => x % 2 === 0).length / n * 100).toFixed(1);
  const od = (ref.filter((x) => x % 2 !== 0).length / n * 100).toFixed(1);
  el.innerHTML = `<div class="g4">
    <div class="metric"><div class="mv" style="color:#71e48a">${o}%</div><div class="ml">Over ${activeOverThr}</div></div>
    <div class="metric"><div class="mv" style="color:#5aa9ff">${u}%</div><div class="ml">Under ${activeUnderThr}</div></div>
    <div class="metric"><div class="mv">${ev}%</div><div class="ml">Even</div></div>
    <div class="metric"><div class="mv">${od}%</div><div class="ml">Odd</div></div>
  </div>`;
}

function renderFlowDots() {
  const el = document.getElementById("flowDots");
  el.innerHTML = digits.slice(-40).map((d) => {
    const cls = d > activeOverThr ? "s-over" : d < activeUnderThr ? "s-under" : d % 2 === 0 ? "s-even" : "s-odd";
    return `<div class="sd ${cls}" title="${d}"></div>`;
  }).join("");
}

function renderOUDots() {
  const el = document.getElementById("ouDots");
  el.innerHTML = digits.slice(-40).map((d) => {
    const cls = d > activeOverThr ? "s-over" : d < activeUnderThr ? "s-under" : "s-even";
    return `<div class="sd ${cls}" title="${d}"></div>`;
  }).join("");
}

function checkSignals(d) {
  const el = document.getElementById("sigFeed");
  const l50 = digits.slice(-50);
  const n50 = l50.length || 1;
  const oRate = overHits(activeOverThr, l50) / n50 * 100;
  const uRate = underHits(activeUnderThr, l50) / n50 * 100;
  const oStreak = calcRunStreak((x) => x > activeOverThr);
  const uStreak = calcRunStreak((x) => x < activeUnderThr);
  const sigs = [];
  const upd = (id, fire, cls) => {
    const e = document.getElementById(id);
    if (!e) return;
    e.textContent = fire ? "FIRE" : "watching";
    e.className = "badge " + (fire ? cls : "bX");
  };
  if (document.getElementById("r1").checked) {
    const f = oRate > 60;
    upd("r1s", f, "bG");
    if (f) sigs.push({ msg: `Over ${activeOverThr} rate ${oRate.toFixed(1)}% in last 50`, cls: "sig-G", badge: "bG" });
  }
  if (document.getElementById("r2").checked) {
    const f = uRate > 60;
    upd("r2s", f, "bB");
    if (f) sigs.push({ msg: `Under ${activeUnderThr} rate ${uRate.toFixed(1)}% in last 50`, cls: "sig-B", badge: "bB" });
  }
  if (document.getElementById("r3").checked) {
    const f = oStreak >= 4;
    upd("r3s", f, "bG");
    if (f) sigs.push({ msg: `Over ${activeOverThr} streak: ${oStreak} in a row`, cls: "sig-G", badge: "bG" });
  }
  if (document.getElementById("r4").checked) {
    const f = uStreak >= 4;
    upd("r4s", f, "bB");
    if (f) sigs.push({ msg: `Under ${activeUnderThr} streak: ${uStreak} in a row`, cls: "sig-B", badge: "bB" });
  }
  if (document.getElementById("r5").checked && lossStreak >= 5) {
    upd("r5s", true, "bR");
    sigs.push({ msg: `Loss streak ${lossStreak} - bot paused`, cls: "sig-R", badge: "bR" });
    if (botActive && !botPaused) botPause();
  } else if (document.getElementById("r5").checked) upd("r5s", false, "bR");
  if (document.getElementById("r6").checked) {
    const l10 = digits.slice(-10);
    const freq = Array.from({ length: 10 }, (_, i) => l10.filter((x) => x === i).length);
    const hot = Math.max(...freq);
    const hotD = freq.indexOf(hot);
    const f = hot >= 3;
    upd("r6s", f, "bA");
    if (f) sigs.push({ msg: `Digit ${hotD} hit ${hot}x in last 10 ticks`, cls: "sig-A", badge: "bA" });
  }
  el.innerHTML = sigs.length
    ? sigs.map((s) => `<div class="signal-card ${s.cls}"><span style="font-size:12px;color:var(--text)">${s.msg}</span><span class="badge ${s.badge}">signal</span></div>`).join("")
    : `<div class="muted">No active signals - Over ${activeOverThr}: ${oRate.toFixed(1)}% | Under ${activeUnderThr}: ${uRate.toFixed(1)}%</div>`;
}

function updatePredOpts() {
  const type = document.getElementById("ctType").value;
  const sel = document.getElementById("ctPred");
  let opts = [];
  if (type === "Over/Under") {
    opts.push("Best");
    for (let i = 0; i <= 9; i += 1) opts.push(`Over ${i}`, `Under ${i}`);
  } else if (type === "Even/Odd") {
    opts = ["Even", "Odd"];
  } else {
    for (let i = 0; i <= 9; i += 1) opts.push(`Matches ${i}`, `Differs ${i}`);
  }
  sel.innerHTML = opts.map((o) => `<option>${o}</option>`).join("");
  if (type === "Over/Under") {
    const idx = opts.indexOf(`Over ${activeOverThr}`);
    if (idx >= 0) sel.selectedIndex = idx;
  }
}

updatePredOpts();

function botStart() {
  if (!connected) return;
  botActive = true;
  botPaused = false;
  currentStake = parseFloat(document.getElementById("stakeVal").value) || 1;
  setBotSt("running");
  logSys(`Bot started (${autoMode ? "AUTO" : "MANUAL"}).`, "info");
  if (!autoMode) logSys("Auto mode is OFF - no trades will be placed until you enable it.", "warn");
}

function botPause() {
  botPaused = !botPaused;
  setBotSt(botPaused ? "paused" : "running");
  logSys(botPaused ? "Bot paused." : "Bot resumed.", "info");
}
function botStop() {
  botActive = false;
  botPaused = false;
  lossStreak = 0;
  setBotSt("stopped");
  logSys("Bot stopped.", "info");
}

function setBotSt(s) {
  const dot = document.getElementById("botDot");
  const lbl = document.getElementById("botLbl");
  const badge = document.getElementById("botBadge");
  if (s === "running") {
    dot.className = "sdot dLive";
    lbl.textContent = "Bot running";
    badge.textContent = "running";
    badge.className = "badge bG";
  } else if (s === "paused") {
    dot.className = "sdot dWarn";
    lbl.textContent = "Bot paused";
    badge.textContent = "paused";
    badge.className = "badge bA";
  } else {
    dot.className = "sdot dOff";
    lbl.textContent = "Bot inactive - connect first";
    badge.textContent = "stopped";
    badge.className = "badge bX";
  }
}

function evalBot(d) {
  let pred = document.getElementById("ctPred").value;
  if (pred === "Best") {
    pred = resolveBestOverUnderPrediction();
  }
  const stake = currentStake;
  let win = false;
  if (pred.startsWith("Over ")) win = d > parseInt(pred.split(" ")[1], 10);
  else if (pred.startsWith("Under ")) win = d < parseInt(pred.split(" ")[1], 10);
  else if (pred === "Even") win = d % 2 === 0;
  else if (pred === "Odd") win = d % 2 !== 0;
  else if (pred.startsWith("Matches ")) win = d === parseInt(pred.split(" ")[1], 10);
  else if (pred.startsWith("Differs ")) win = d !== parseInt(pred.split(" ")[1], 10);
  const pl = win ? parseFloat((stake * 0.95).toFixed(2)) : -parseFloat(stake.toFixed(2));
  sessionPL += pl;
  if (win) { sessionWins += 1; lossStreak = 0; } else { sessionLosses += 1; lossStreak += 1; }
  if (document.getElementById("martOn").checked && !win) {
    currentStake = parseFloat((currentStake * parseFloat(document.getElementById("martX").value)).toFixed(2));
  } else currentStake = parseFloat(document.getElementById("stakeVal").value) || 1;
  updatePL();
  addTrade(pred, d, win, stake, pl);
  checkLimits();
}

function updatePL() {
  const el = document.getElementById("plTotal");
  el.textContent = (sessionPL >= 0 ? "+" : "") + "$" + sessionPL.toFixed(2);
  el.style.color = sessionPL >= 0 ? "#71e48a" : "#ff5c5c";
  document.getElementById("plWins").textContent = sessionWins;
  document.getElementById("plLosses").textContent = sessionLosses;
  const tot = sessionWins + sessionLosses;
  document.getElementById("plWR").textContent = tot ? (sessionWins / tot * 100).toFixed(1) + "%" : "0%";
  const sl = parseFloat(document.getElementById("slVal").value) || 10;
  const tp = parseFloat(document.getElementById("tpVal").value) || 5;
  const range = sl + tp;
  const pos = sl + sessionPL;
  const pct = Math.max(0, Math.min(100, pos / range * 100));
  const bar = document.getElementById("plBar");
  bar.style.width = pct.toFixed(1) + "%";
  bar.style.background = sessionPL >= 0 ? "#8bff5c" : "#ff8f8f";
  if (demoMode) setBalance(demoBalanceBase + sessionPL, liveCurrency || "USD");
}

function addTrade(pred, digit, win, stake, pl) {
  const n = trades.length + 1;
  const t = new Date().toLocaleTimeString();
  trades.push({ n, pred, digit, win, stake, pl, t });
  const tb = document.getElementById("tradeBody");
  if (tb.rows[0] && tb.rows[0].cells.length === 1) tb.innerHTML = "";
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${n}</td><td style="font-size:11px">${pred}</td><td>${digit}</td><td><span class="badge ${win ? "bG" : "bR"}">${win ? "W" : "L"}</span></td><td>$${stake.toFixed(2)}</td><td style="color:${pl >= 0 ? "#71e48a" : "#ff5c5c"}">${pl >= 0 ? "+" : ""}$${pl.toFixed(2)}</td><td style="font-size:11px">${t}</td>`;
  tb.insertBefore(tr, tb.firstChild);
}

function checkLimits() {
  if (!botActive) return false;
  if (document.getElementById("tpOn").checked && sessionPL >= parseFloat(document.getElementById("tpVal").value)) {
    botStop();
    showRiskAlert("tp", `Take profit reached at ${formatMoney(sessionPL)} ${liveCurrency}. Bot stopped.`);
    logSys("Take profit hit. Bot stopped.", "warn");
    return true;
  }
  if (document.getElementById("slOn").checked && sessionPL <= -parseFloat(document.getElementById("slVal").value)) {
    botStop();
    showRiskAlert("sl", `Stop loss hit at ${formatMoney(sessionPL)} ${liveCurrency}. Bot stopped.`);
    logSys("Stop loss hit. Bot stopped.", "warn");
    return true;
  }
  if (document.getElementById("maxOn").checked && trades.length >= parseInt(document.getElementById("maxTrades").value, 10)) {
    botStop();
    return true;
  }
  return false;
}

function appendLog(d, epoch) {
  const el = document.getElementById("digitLog");
  if (el.textContent === "Waiting for digits...") el.textContent = "";
  const t = new Date(epoch * 1000).toLocaleTimeString();
  const tag = d > activeOverThr ? "OV" : d < activeUnderThr ? "UN" : "MD";
  el.textContent += `[${t}] ${d}(${tag}) `;
  if (allDigits.length % 20 === 0) el.textContent += "\n";
  el.scrollTop = el.scrollHeight;
}

function exportCSV() {
  if (!trades.length) return;
  const h = "#,Prediction,Digit,Result,Stake,PL,Time\n";
  const rows = trades.map((t) => {
    const result = t.status === "OPEN" ? "OPEN" : t.status === "ERROR" ? "ERROR" : t.win ? "WIN" : "LOSS";
    const digit = t.digit === undefined || t.digit === null ? "" : t.digit;
    const pl = t.pl === undefined || t.pl === null ? "" : Number(t.pl).toFixed(2);
    return `${t.n},"${t.pred}",${digit},${result},${t.stake.toFixed(2)},${pl},"${t.t}"`;
  }).join("\n");
  dl("trades.csv", "data:text/csv;charset=utf-8," + encodeURIComponent(h + rows));
}

function exportJSON() {
  dl("deriv_session.json", "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ overThreshold: activeOverThr, underThreshold: activeUnderThr, digits: allDigits, trades, sessionPL, wins: sessionWins, losses: sessionLosses }, null, 2)));
}

function dl(name, href) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

function clearAll() {
  digits = [];
  allDigits = [];
  trades = [];
  pendingBuys = {};
  pendingProposals = {};
  openContracts = {};
  tradeRows = {};
  tradeInFlight = false;
  sessionPL = 0;
  sessionWins = 0;
  sessionLosses = 0;
  lossStreak = 0;
  currentStake = 1;
  document.getElementById("tradeBody").innerHTML = '<tr><td colspan="7" style="color:var(--muted);font-size:11px">No trades yet</td></tr>';
  document.getElementById("digitLog").textContent = "Waiting for digits...";
  renderTape();
  renderLiveMetrics();
  renderFreq();
  renderWindow();
  updatePL();
  if (demoMode) setBalance(demoBalanceBase, liveCurrency || "USD");
  logSys("Session cleared.", "info");
}

initLockscreen();
initLiveTradingControls();
initAlertModal();
initSystemLog();
setBalance(liveBalance, liveCurrency);
setAccountType(null, "--");
renderOUGrids();
renderFreq();
renderWindow();
initRichChat();
