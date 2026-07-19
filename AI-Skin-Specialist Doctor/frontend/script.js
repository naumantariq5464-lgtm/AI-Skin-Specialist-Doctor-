/**
 * script.js — AI Skin Specialist Doctor
 * Handles: image upload, chat, voice recording (STT), TTS playback.
 */

const API_BASE = window.location.origin;

// ─── State ─────────────────────────────────────────────────────────────────
const state = {
  imageFile: null,
  imageAnalysis: null,       // Cached analysis from /analyze
  conversationHistory: [],   // [{role, content}, ...]
  isLoading: false,
  isRecording: false,
  mediaRecorder: null,
  audioChunks: [],
  offTopicCount: 0,          // Track repeated off-topic attempts
  currentAudio: null,        // Reference to active playing Audio object
  currentAudioBtn: null,     // Reference to active playing button
};

// ─── DOM refs ───────────────────────────────────────────────────────────────
const uploadZone     = document.getElementById("upload-zone");
const imageInput     = document.getElementById("image-input");
const imagePreview   = document.getElementById("image-preview");
const previewImg     = document.getElementById("preview-img");
const btnRemoveImage = document.getElementById("btn-remove-image");
const btnAnalyze     = document.getElementById("btn-analyze");
const chatWindow     = document.getElementById("chat-window");
const emptyState     = document.getElementById("empty-state");
const typingIndicator = document.getElementById("typing-indicator");
const chatInput      = document.getElementById("chat-input");
const btnSend        = document.getElementById("btn-send");
const btnMic         = document.getElementById("btn-mic");
const toastContainer = document.getElementById("toast-container");

// ─────────────────────────────────────────────────────────────────────────────
// Image Upload
// ─────────────────────────────────────────────────────────────────────────────

function initUploadZone() {
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("drag-over");
  });

  uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("drag-over");
  });

  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  });

  uploadZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") imageInput.click();
  });

  imageInput.addEventListener("change", () => {
    if (imageInput.files[0]) handleImageFile(imageInput.files[0]);
  });

  btnRemoveImage.addEventListener("click", removeImage);
  btnAnalyze.addEventListener("click", analyzeImage);
}

function handleImageFile(file) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    showToast("Please upload a JPEG, PNG, or WebP image.", "error");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast("Image must be smaller than 10 MB.", "error");
    return;
  }

  state.imageFile = file;
  state.imageAnalysis = null; // Reset cached analysis on new image

  const url = URL.createObjectURL(file);
  previewImg.src = url;
  uploadZone.style.display = "none";
  imagePreview.classList.add("visible");
  btnAnalyze.disabled = false;
}

function removeImage() {
  state.imageFile = null;
  state.imageAnalysis = null;
  previewImg.src = "";
  imageInput.value = "";
  uploadZone.style.display = "";
  imagePreview.classList.remove("visible");
  btnAnalyze.disabled = true;
}

async function analyzeImage() {
  if (!state.imageFile || state.isLoading) return;

  setLoading(true);
  btnAnalyze.disabled = true;
  showTyping();

  const formData = new FormData();
  formData.append("image", state.imageFile);

  // Add image thumbnail to chat
  const imgUrl = URL.createObjectURL(state.imageFile);
  hideEmptyState();
  addImageMessage(imgUrl);

  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Analysis failed." }));
      throw new Error(err.detail || "Analysis failed.");
    }

    const data = await res.json();
    state.imageAnalysis = data.analysis;
    state.conversationHistory.push({ role: "assistant", content: data.analysis });
    addDoctorMessage(data.analysis, true);
  } catch (err) {
    showToast(err.message, "error");
    addDoctorMessage("I was unable to analyze the image. Please try again or describe your concern in text.");
  } finally {
    hideTyping();
    setLoading(false);
    btnAnalyze.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat
// ─────────────────────────────────────────────────────────────────────────────

function initChat() {
  btnSend.addEventListener("click", sendMessage);

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
  });
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || state.isLoading) return;

  hideEmptyState();
  addUserMessage(text);
  state.conversationHistory.push({ role: "user", content: text });
  chatInput.value = "";
  chatInput.style.height = "auto";

  setLoading(true);
  showTyping();

  try {
    const payload = {
      message: text,
      history: state.conversationHistory.slice(-10),  // Send last 10 turns max
      image_analysis: state.imageAnalysis || null,
    };

    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Something went wrong." }));
      throw new Error(err.detail || "Request failed.");
    }

    const data = await res.json();
    state.conversationHistory.push({ role: "assistant", content: data.reply });
    addDoctorMessage(data.reply, true);

    // Track off-topic decline for UX
    if (data.provider === "guardrails") {
      state.offTopicCount++;
    } else {
      state.offTopicCount = 0;
    }
  } catch (err) {
    showToast(err.message, "error");
    addDoctorMessage("I encountered an issue processing your request. Please try again.");
  } finally {
    hideTyping();
    setLoading(false);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice Recording (STT)
// ─────────────────────────────────────────────────────────────────────────────

function initMic() {
  btnMic.addEventListener("click", toggleRecording);
}

async function toggleRecording() {
  if (state.isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioChunks = [];
    state.mediaRecorder = new MediaRecorder(stream);

    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) state.audioChunks.push(e.data);
    };

    state.mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      await transcribeAudio();
    };

    state.mediaRecorder.start();
    state.isRecording = true;
    btnMic.classList.add("recording");
    btnMic.title = "Stop recording";
    showToast("Recording… Click mic again to stop.", "");
  } catch {
    showToast("Microphone access denied. Please allow microphone permissions.", "error");
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.isRecording) {
    state.mediaRecorder.stop();
    state.isRecording = false;
    btnMic.classList.remove("recording");
    btnMic.title = "Record voice message";
  }
}

async function transcribeAudio() {
  const mimeType = state.audioChunks[0]?.type || "audio/webm";
  const audioBlob = new Blob(state.audioChunks, { type: mimeType });

  if (audioBlob.size < 1000) {
    showToast("Audio too short. Please speak clearly and try again.", "error");
    return;
  }

  showToast("Transcribing…", "");
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");

  try {
    const res = await fetch(`${API_BASE}/transcribe`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Transcription failed." }));
      throw new Error(err.detail || "Transcription failed.");
    }

    const data = await res.json();
    chatInput.value = data.transcript;
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
    chatInput.focus();
    showToast("Voice captured! Review and send.", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TTS Playback
// ─────────────────────────────────────────────────────────────────────────────

const SPEAK_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>
`;

const STOP_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
  </svg>
`;

function stopCurrentAudio() {
  // Stop HTML5 Audio element
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio = null;
  }
  // Stop browser speechSynthesis fallback
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  if (state.currentAudioBtn) {
    state.currentAudioBtn.innerHTML = `${SPEAK_ICON} Listen`;
    state.currentAudioBtn = null;
  }
}

/**
 * Browser-native TTS fallback using Web Speech API.
 * Used when the Deepgram backend is unavailable.
 */
function speakWithBrowserTTS(text, btnEl) {
  if (!window.speechSynthesis) {
    showToast("Your browser does not support text-to-speech.", "error");
    btnEl.innerHTML = `${SPEAK_ICON} Listen`;
    return;
  }

  function doSpeak() {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;

    // Try to pick a good English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en"))
                   || voices.find(v => v.lang.startsWith("en"));
    if (preferred) utterance.voice = preferred;

    state.currentAudioBtn = btnEl;
    btnEl.innerHTML = `${STOP_ICON} Stop`;

    utterance.onend = () => {
      if (state.currentAudioBtn === btnEl) {
        stopCurrentAudio();
      }
    };
    utterance.onerror = (e) => {
      console.error("Browser TTS error:", e);
      showToast("Text-to-speech is not available in your browser. Try Chrome or Edge.", "error");
      btnEl.innerHTML = `${SPEAK_ICON} Listen`;
      state.currentAudioBtn = null;
    };

    window.speechSynthesis.speak(utterance);
  }

  // Voices may not be loaded yet on first call — wait for them
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    doSpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      doSpeak();
    };
    // Safety timeout: speak anyway after 500ms even if voices never load
    setTimeout(() => {
      if (state.currentAudioBtn !== btnEl) {
        doSpeak();
      }
    }, 500);
  }
}

async function speakText(text, btnEl) {
  if (!text) return;

  // Toggle stop if clicking the currently playing audio button
  if (state.currentAudioBtn === btnEl) {
    stopCurrentAudio();
    return;
  }

  // Stop any other audio that is already playing
  stopCurrentAudio();

  // Set this button to loading state
  btnEl.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="animation: spin 1s linear infinite; display:inline-block;">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
      <path d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
    Loading...
  `;

  // Define dynamic CSS spin keyframes inline if not present
  if (!document.getElementById("spin-style")) {
    const style = document.createElement("style");
    style.id = "spin-style";
    style.innerHTML = "@keyframes spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }

  const cleanText = text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/⚕️/g, "").trim();

  try {
    const res = await fetch(`${API_BASE}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanText }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Server ${res.status}: ${errText}`);
    }

    const blob = await res.blob();
    if (!blob || blob.size === 0) throw new Error("Empty audio response from server");

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.preload = "auto";

    // Save references before play
    state.currentAudio = audio;
    state.currentAudioBtn = btnEl;
    btnEl.innerHTML = `${STOP_ICON} Stop`;

    try {
      await audio.play();
    } catch (playErr) {
      // Autoplay blocked by browser — reset and show message
      console.warn("Audio autoplay blocked:", playErr.message);
      URL.revokeObjectURL(url);
      state.currentAudio = null;
      state.currentAudioBtn = null;
      btnEl.innerHTML = `${SPEAK_ICON} Listen`;
      showToast("Click allowed — tap Listen again to play audio.", "");
      return;
    }

    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (state.currentAudioBtn === btnEl) {
        stopCurrentAudio();
      }
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      console.warn("Audio playback error, falling back to browser TTS");
      speakWithBrowserTTS(cleanText, btnEl);
    };

  } catch (err) {
    console.warn("Deepgram TTS failed:", err.message);
    btnEl.innerHTML = `${SPEAK_ICON} Listen`;
    state.currentAudio = null;
    state.currentAudioBtn = null;
    showToast(`TTS error: ${err.message}`, "error");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function addDoctorMessage(text, withSpeaker = false) {
  const time = formatTime();
  const msgEl = document.createElement("div");
  msgEl.className = "message doctor";
  msgEl.innerHTML = `
    <div class="msg-avatar doctor" aria-hidden="true">AI</div>
    <div class="msg-body">
      <div class="msg-meta">AI Skin Specialist · ${time}</div>
      <div class="msg-bubble"></div>
      ${withSpeaker ? `
      <div class="msg-actions" style="display: none;">
        <button class="btn btn-secondary btn-speak" title="Listen to this response" aria-label="Play audio response">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
          Listen
        </button>
      </div>` : ""}
    </div>
  `;

  const bubble = msgEl.querySelector(".msg-bubble");
  const actions = msgEl.querySelector(".msg-actions");

  // Attach speak handler
  if (withSpeaker && actions) {
    const speakBtn = actions.querySelector(".btn-speak");
    speakBtn.addEventListener("click", () => speakText(text, speakBtn));
  }

  insertMessage(msgEl);

  let index = 0;
  const speed = 7; // Fast and smooth typewriter speed (ms per char)

  function type() {
    if (index < text.length) {
      index++;
      bubble.innerHTML = formatText(text.substring(0, index));
      scrollToBottom();
      setTimeout(type, speed);
    } else {
      if (actions) {
        actions.style.display = "flex";
        scrollToBottom();
      }
    }
  }

  type();
}

function addUserMessage(text) {
  const time = formatTime();
  const msgEl = document.createElement("div");
  msgEl.className = "message user";
  msgEl.innerHTML = `
    <div class="msg-avatar user-av" aria-hidden="true">You</div>
    <div class="msg-body">
      <div class="msg-meta">${time}</div>
      <div class="msg-bubble">${escapeHtml(text)}</div>
    </div>
  `;
  insertMessage(msgEl);
}

function addImageMessage(imgUrl) {
  const time = formatTime();
  const msgEl = document.createElement("div");
  msgEl.className = "message user";
  msgEl.innerHTML = `
    <div class="msg-avatar user-av" aria-hidden="true">You</div>
    <div class="msg-body">
      <div class="msg-meta">${time}</div>
      <div class="msg-bubble">
        <img src="${imgUrl}" alt="Uploaded skin image" class="msg-image" />
        <div style="font-size:0.78rem;margin-top:4px;opacity:0.85;">Analyzing uploaded image…</div>
      </div>
    </div>
  `;
  insertMessage(msgEl);
}

function insertMessage(el) {
  // Insert before typing indicator
  chatWindow.insertBefore(el, typingIndicator);
  scrollToBottom();
}

function showTyping() {
  typingIndicator.classList.add("visible");
  scrollToBottom();
}

function hideTyping() {
  typingIndicator.classList.remove("visible");
}

function hideEmptyState() {
  if (emptyState) emptyState.style.display = "none";
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  });
}

function setLoading(val) {
  state.isLoading = val;
  btnSend.disabled = val;
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast Notifications
// ─────────────────────────────────────────────────────────────────────────────

function showToast(message, type = "") {
  const toast = document.createElement("div");
  toast.className = `toast${type ? " " + type : ""}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatText(text) {
  // Basic markdown: bold **text**, italic *text*, line breaks
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check on load
// ─────────────────────────────────────────────────────────────────────────────

async function checkBackendHealth() {
  const dot  = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      dot.style.background = "#16A34A";
      text.textContent = "Online";
    } else {
      throw new Error();
    }
  } catch {
    dot.style.background = "#DC2626";
    text.textContent = "Offline";
    showToast("Backend server is not reachable. Make sure it's running on port 8000.", "error");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Switching
// ─────────────────────────────────────────────────────────────────────────────

function initTabs() {
  const tabSkin    = document.getElementById("tab-skin");
  const tabSymptom = document.getElementById("tab-symptom");
  const chatPanel  = document.getElementById("chat-panel");
  const symptomPanel = document.getElementById("symptom-panel");
  const btnClear   = document.getElementById("btn-clear");

  if (!tabSkin || !tabSymptom) return;

  tabSkin.addEventListener("click", () => {
    tabSkin.classList.add("active");
    tabSkin.setAttribute("aria-selected", "true");
    tabSymptom.classList.remove("active");
    tabSymptom.setAttribute("aria-selected", "false");
    chatPanel.style.display = "flex";
    symptomPanel.style.display = "none";
  });

  tabSymptom.addEventListener("click", () => {
    tabSymptom.classList.add("active");
    tabSymptom.setAttribute("aria-selected", "true");
    tabSkin.classList.remove("active");
    tabSkin.setAttribute("aria-selected", "false");
    symptomPanel.style.display = "flex";
    chatPanel.style.display = "none";
  });

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      const isSkinActive = tabSkin.classList.contains("active");
      if (isSkinActive) {
        // Clear chat messages
        const messages = chatWindow.querySelectorAll(".message");
        messages.forEach(msg => msg.remove());

        // Reset state values
        state.conversationHistory = [];
        state.imageAnalysis = null;
        state.imageFile = null;
        if (typeof removeImage === "function") {
          removeImage();
        }

        // Show empty state illustration again
        if (emptyState) emptyState.style.display = "flex";

        stopCurrentAudio();
        showToast("Conversation cleared.", "success");
      } else {
        // Clear symptom results
        const symptomResults = document.getElementById("symptom-results");
        if (symptomResults) {
          symptomResults.innerHTML = "";
        }
        stopCurrentAudio();
        showToast("Symptom results cleared.", "success");
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Symptom Checker Module (Phase 5)
// ─────────────────────────────────────────────────────────────────────────────

function initSymptomChecker() {
  const btnCheck     = document.getElementById("btn-check-symptom");
  const symptomInput = document.getElementById("symptom-input");
  const loading      = document.getElementById("symptom-loading");
  const resultsDiv   = document.getElementById("symptom-results");
  const btnMicSymptom = document.getElementById("btn-mic-symptom");

  if (!btnCheck || !symptomInput) return;

  // ─── Check Symptom Button ───
  btnCheck.addEventListener("click", async () => {
    const text = symptomInput.value.trim();
    if (!text) {
      showToast("Please describe your symptoms first.", "error");
      return;
    }
    await runSymptomCheck(text, symptomInput, loading, resultsDiv, btnCheck);
  });

  // ─── Voice input for symptom tab ───
  if (btnMicSymptom) {
    let symRecording = false;
    let symRecorder = null;
    let symChunks = [];

    btnMicSymptom.addEventListener("click", async () => {
      if (!symRecording) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          symRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
          symChunks = [];
          symRecorder.ondataavailable = (e) => { if (e.data.size > 0) symChunks.push(e.data); };
          symRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(symChunks, { type: "audio/webm" });
            btnMicSymptom.classList.remove("recording");
            btnMicSymptom.title = "Record symptom by voice";

            // Transcribe
            const fd = new FormData();
            fd.append("audio", blob, "symptom-recording.webm");
            try {
              const res = await fetch(`${API_BASE}/transcribe`, { method: "POST", body: fd });
              if (!res.ok) throw new Error("Transcription failed");
              const data = await res.json();
              if (data.transcript) {
                symptomInput.value = data.transcript;
                showToast("Voice transcribed — click 'Check Symptoms' to proceed.", "success");
              }
            } catch {
              showToast("Voice transcription failed. Please type your symptoms.", "error");
            }
          };
          symRecorder.start();
          symRecording = true;
          btnMicSymptom.classList.add("recording");
          btnMicSymptom.title = "Stop recording";
        } catch {
          showToast("Microphone access denied.", "error");
        }
      } else {
        symRecorder.stop();
        symRecording = false;
      }
    });
  }
}

async function runSymptomCheck(text, inputEl, loadingEl, resultsEl, btnEl) {
  // Disable button, show loading
  btnEl.disabled = true;
  btnEl.textContent = "Checking…";
  loadingEl.classList.add("visible");

  try {
    const res = await fetch(`${API_BASE}/symptom-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptom: text }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Symptom check failed");
    }

    const data = await res.json();
    renderSymptomResult(data, text, resultsEl);
    inputEl.value = "";
  } catch (err) {
    showToast(err.message || "Symptom check failed. Try again.", "error");
  } finally {
    loadingEl.classList.remove("visible");
    btnEl.disabled = false;
    btnEl.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
      Check Symptoms`;
  }
}

function renderSymptomResult(data, query, container) {
  const urgencyClass = `urgency-${data.urgency.toLowerCase()}`;
  const urgencyIcon = data.urgency === "EMERGENCY" ? "🚨" : data.urgency === "MEDIUM" ? "⚠️" : "✅";

  const card = document.createElement("div");
  card.className = "result-card";
  card.innerHTML = `
    <div class="result-header">
      <span class="urgency-badge ${urgencyClass}">${urgencyIcon} ${data.urgency}</span>
      <span style="font-size:0.75rem; color:var(--text-muted); margin-left:auto;">${formatTime()}</span>
    </div>
    <div class="result-section">
      <div class="result-label">Your Symptom</div>
      <div class="result-text" style="font-style:italic; color:var(--text-muted);">"${escapeHtml(query)}"</div>
    </div>
    <div class="result-section">
      <div class="result-label">Assessment Summary</div>
      <div class="result-text">${formatText(data.summary)}</div>
    </div>
    <div class="result-section">
      <div class="result-label">Recommended Action</div>
      <div class="result-text action-text">${formatText(data.action)}</div>
    </div>
    ${data.sources_used ? `<div class="sources-note">✓ Information verified from trusted medical sources (MedlinePlus, NHS, Mayo Clinic)</div>` : ""}
    <div class="result-actions">
      <button class="btn btn-ghost btn-sm symptom-listen-btn" title="Listen to this assessment">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
        Listen
      </button>
    </div>
    <div class="disclaimer-note">⚕️ This is general health guidance, not a medical diagnosis. Please consult a qualified healthcare professional for proper evaluation.</div>
  `;

  container.prepend(card);

  // Listen button
  const listenBtn = card.querySelector(".symptom-listen-btn");
  if (listenBtn) {
    listenBtn.addEventListener("click", () => {
      const fullText = `Urgency: ${data.urgency}. ${data.summary}. Recommended action: ${data.action}`;
      toggleTTSPlayback(fullText, listenBtn);
    });
  }

  // Smooth scroll
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

function toggleTTSPlayback(text, btn) {
  // If already playing from this button, stop it
  if (state.currentAudioBtn === btn && (state.currentAudio || (window.speechSynthesis && window.speechSynthesis.speaking))) {
    stopCurrentAudio();
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>
      Listen`;
    return;
  }

  // Stop any currently playing audio
  stopCurrentAudio();

  // Play new
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>
    Playing…`;

  const cleanText = text.replace(/\*([^*]+)\*/g, "$1").replace(/⚕️/g, "");

  fetch(`${API_BASE}/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: cleanText }),
  })
    .then(res => {
      if (!res.ok) throw new Error(`Server ${res.status}`);
      return res.blob();
    })
    .then(blob => {
      if (!blob || blob.size === 0) throw new Error("Empty audio");
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      state.currentAudio = audio;
      state.currentAudioBtn = btn;

      audio.play().catch(() => {
        URL.revokeObjectURL(url);
        console.warn("HTML5 Audio play failed, falling back to browser TTS");
        speakWithBrowserTTS(cleanText, btn);
      });

      audio.onended = () => {
        URL.revokeObjectURL(url);
        state.currentAudio = null;
        state.currentAudioBtn = null;
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
          Listen`;
      };
    })
    .catch((err) => {
      // ── Fallback: browser TTS ──
      console.warn("Deepgram TTS failed for symptom, using browser fallback:", err.message);
      speakWithBrowserTTS(cleanText, btn);
    });
}

// ─── Init ──────────────────────────────────────────────────────────────────
initUploadZone();
initChat();
initMic();
initTabs();
initSymptomChecker();
checkBackendHealth();

