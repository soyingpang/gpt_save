const board = document.getElementById("gameBoard");
const tray = document.getElementById("tray");
const scoreLabel = document.getElementById("scoreLabel");
const comboLabel = document.getElementById("comboLabel");
const timeLeftLabel = document.getElementById("timeLeftLabel");
const roundState = document.getElementById("roundState");
const overlayMessage = document.getElementById("overlayMessage");
const supportToast = document.getElementById("supportToast");
const supportCountLabel = document.getElementById("supportCountLabel");
const queueCurrent = document.getElementById("queueCurrent");
const queueUpcoming = document.getElementById("queueUpcoming");
const queueWait = document.getElementById("queueWait");
const queueAlert = document.getElementById("queueAlert");

const channelName = "sushi-catch-prototype";
const supportChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(channelName) : null;

const state = {
  boardWidth: 0,
  boardHeight: 0,
  trayX: 0,
  trayWidth: 120,
  dragging: false,
  dragOffset: 0,
  fallers: [],
  score: 0,
  combo: 0,
  timeLeft: 40,
  roundDuration: 40,
  running: false,
  spawnTimer: 0,
  spawnInterval: 850,
  slowUntil: 0,
  enlargeUntil: 0,
  toastTimer: null,
  resultTimeout: null,
  onlineSupporters: new Map(),
  supportMessages: 0,
  supportActions: [
    "送出普通壽司",
    "送出加分壽司",
    "托盤放大支援",
    "掉落減速支援"
  ]
};

const queuePool = [
  { current: "A12", upcoming: "A13 - A15", wait: "約 8 分鐘", alert: "請留意叫號並準備入座" },
  { current: "A13", upcoming: "A14 - A16", wait: "約 7 分鐘", alert: "即將到號，請靠近櫃台" },
  { current: "A14", upcoming: "A15 - A17", wait: "約 6 分鐘", alert: "請依現場叫號安排入座" },
  { current: "A15", upcoming: "A16 - A18", wait: "約 5 分鐘", alert: "輪到你入座時可立即離場" }
];

let queueIndex = 0;
let lastFrame = performance.now();
let secondAccumulator = 0;
let roundPaused = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateBoardMetrics() {
  const rect = board.getBoundingClientRect();
  state.boardWidth = rect.width;
  state.boardHeight = rect.height;
  if (!state.trayX) {
    state.trayX = (rect.width - state.trayWidth) / 2;
  }
  applyTrayPosition();
}

function applyTrayPosition() {
  const activeWidth = Date.now() < state.enlargeUntil ? 170 : 120;
  state.trayWidth = activeWidth;
  tray.style.width = `${activeWidth}px`;
  state.trayX = clamp(state.trayX, 0, state.boardWidth - activeWidth);
  tray.style.left = `${state.trayX}px`;
  tray.style.marginLeft = "0";
}

function resetRound() {
  state.score = 0;
  state.combo = 0;
  state.timeLeft = state.roundDuration;
  state.running = true;
  state.spawnTimer = 0;
  state.slowUntil = 0;
  state.enlargeUntil = 0;
  state.supportMessages = 0;
  clearBoardItems();
  updateLabels();
  roundState.textContent = "回合進行中";
  showOverlay("新一局已開始", "牆前主玩家可直接觸碰牆面控制托盤。手機玩家可掃碼加入同一局。", 1800);
  broadcast({ type: "round-start", timeLeft: state.timeLeft, score: state.score });
}

function endRound() {
  state.running = false;
  roundState.textContent = "回合結束";
  const summary = `本局得分 ${state.score}，連續接住 ${Math.max(state.combo, 0)} 次。`;
  showOverlay("本局完成", `${summary} 下一局將在 6 秒後重新開始。`, 5200);
  broadcast({
    type: "round-end",
    score: state.score,
    supportCount: state.supportMessages,
    summary
  });
  clearTimeout(state.resultTimeout);
  state.resultTimeout = setTimeout(() => {
    resetRound();
  }, 6000);
}

function clearBoardItems() {
  state.fallers.forEach((item) => item.el.remove());
  state.fallers = [];
}

function updateLabels() {
  scoreLabel.textContent = String(state.score);
  comboLabel.textContent = String(state.combo);
  timeLeftLabel.textContent = String(state.timeLeft);
}

function spawnSushi(kind = "normal", source = "system") {
  if (!state.running) {
    return;
  }

  const el = document.createElement("div");
  el.className = `sushi-item sushi-${kind}`;
  const kindMap = {
    normal: { emoji: "🍣", score: 10, speed: 110 },
    bonus: { emoji: "🍱", score: 25, speed: 125 },
    support: { emoji: "✨", score: 0, speed: 95 }
  };
  const meta = kindMap[kind] || kindMap.normal;
  el.textContent = meta.emoji;
  const width = 52;
  const maxX = Math.max(20, state.boardWidth - width - 20);
  const x = Math.random() * maxX;
  el.style.left = `${x}px`;
  board.appendChild(el);

  state.fallers.push({
    el,
    x,
    y: -56,
    width,
    height: 52,
    speed: meta.speed,
    kind,
    score: meta.score,
    source
  });
}

function showToast(message) {
  supportToast.textContent = message;
  supportToast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    supportToast.classList.remove("show");
  }, 1600);
}

function showOverlay(title, copy, duration = 1800) {
  overlayMessage.innerHTML = `
    <div class="overlay-card">
      <p class="overlay-eyebrow">等待區互動系統</p>
      <h3>${title}</h3>
      <p>${copy}</p>
    </div>
  `;
  overlayMessage.classList.add("show");
  setTimeout(() => {
    overlayMessage.classList.remove("show");
  }, duration);
}

function grantSupportEffect(kind) {
  if (kind === "support-enlarge") {
    state.enlargeUntil = Date.now() + 6000;
    applyTrayPosition();
    showToast("手機玩家支援：托盤放大 6 秒");
    spawnSushi("support", "support");
  }

  if (kind === "support-slow") {
    state.slowUntil = Date.now() + 6000;
    showToast("手機玩家支援：掉落速度減慢 6 秒");
    spawnSushi("support", "support");
  }
}

function handleCatch(item) {
  item.el.remove();
  state.fallers = state.fallers.filter((entry) => entry !== item);

  if (item.kind === "support") {
    state.score += 5;
    state.combo += 1;
  } else {
    state.score += item.score;
    state.combo += 1;
  }

  updateLabels();
  broadcast({ type: "round-update", timeLeft: state.timeLeft, score: state.score });
}

function handleMiss(item) {
  item.el.remove();
  state.fallers = state.fallers.filter((entry) => entry !== item);
  state.combo = 0;
  updateLabels();
}

function broadcast(payload) {
  const wrapped = {
    ...payload,
    timestamp: Date.now()
  };

  if (supportChannel) {
    supportChannel.postMessage(wrapped);
  }

  localStorage.setItem("sushi-catch-prototype-event", JSON.stringify(wrapped));
}

function handleSupportMessage(data) {
  if (!data || !data.type) {
    return;
  }

  if (data.type === "join") {
    state.onlineSupporters.set(data.playerId, Date.now());
    updateSupporterCount();
    showToast(`支援玩家 ${data.playerCode || "已加入"}`);
    return;
  }

  if (data.type === "heartbeat") {
    state.onlineSupporters.set(data.playerId, Date.now());
    updateSupporterCount();
    return;
  }

  if (data.type === "leave") {
    state.onlineSupporters.delete(data.playerId);
    updateSupporterCount();
    return;
  }

  if (!state.running) {
    return;
  }

  state.onlineSupporters.set(data.playerId, Date.now());
  updateSupporterCount();

  if (data.type === "spawn-normal") {
    state.supportMessages += 1;
    spawnSushi("normal", "mobile");
    showToast("手機玩家送出普通壽司");
  }

  if (data.type === "spawn-bonus") {
    state.supportMessages += 1;
    spawnSushi("bonus", "mobile");
    showToast("手機玩家送出加分壽司");
  }

  if (data.type === "support-enlarge" || data.type === "support-slow") {
    state.supportMessages += 1;
    grantSupportEffect(data.type);
  }
}

function updateSupporterCount() {
  const now = Date.now();
  for (const [key, value] of state.onlineSupporters.entries()) {
    if (now - value > 30000) {
      state.onlineSupporters.delete(key);
    }
  }
  supportCountLabel.textContent = `${state.onlineSupporters.size} 位支援玩家`;
}

function cycleQueueMock() {
  queueIndex = (queueIndex + 1) % queuePool.length;
  const next = queuePool[queueIndex];
  queueCurrent.textContent = next.current;
  queueUpcoming.textContent = next.upcoming;
  queueWait.textContent = next.wait;
  queueAlert.textContent = next.alert;

  if (queueIndex === queuePool.length - 1) {
    roundPaused = true;
    roundState.textContent = "叫號提醒";
    showOverlay("輪到你入座，請前往櫃台", "被叫號時可立即離開，本局支援不影響排隊安排。", 2600);
    setTimeout(() => {
      roundPaused = false;
      if (state.running) {
        roundState.textContent = "回合進行中";
      }
    }, 2600);
  }
}

function animate(now) {
  const delta = (now - lastFrame) / 1000;
  lastFrame = now;

  if (state.running && !roundPaused) {
    secondAccumulator += delta;
    state.spawnTimer += delta;

    const spawnGap = Date.now() < state.slowUntil ? 1.12 : 0.82;
    if (state.spawnTimer >= spawnGap) {
      state.spawnTimer = 0;
      const roll = Math.random();
      if (roll > 0.8) {
        spawnSushi("bonus");
      } else {
        spawnSushi("normal");
      }
    }

    if (secondAccumulator >= 1) {
      secondAccumulator = 0;
      state.timeLeft -= 1;
      updateLabels();
      broadcast({ type: "round-update", timeLeft: state.timeLeft, score: state.score });
      if (state.timeLeft <= 0) {
        endRound();
      }
    }

    const speedMultiplier = Date.now() < state.slowUntil ? 0.62 : 1;

    state.fallers.slice().forEach((item) => {
      item.y += item.speed * speedMultiplier * delta;
      item.el.style.transform = `translateY(${item.y}px)`;

      const trayY = state.boardHeight - 28 - 28;
      const caughtHorizontally = item.x + item.width > state.trayX && item.x < state.trayX + state.trayWidth;
      const caughtVertically = item.y + item.height >= trayY && item.y <= trayY + 36;

      if (caughtHorizontally && caughtVertically) {
        handleCatch(item);
        return;
      }

      if (item.y > state.boardHeight + 10) {
        handleMiss(item);
      }
    });
  }

  if (Date.now() > state.enlargeUntil && state.trayWidth !== 120) {
    applyTrayPosition();
  }

  requestAnimationFrame(animate);
}

function pointerToBoardX(clientX) {
  const rect = board.getBoundingClientRect();
  return clientX - rect.left;
}

function onPointerDown(event) {
  state.dragging = true;
  tray.setPointerCapture?.(event.pointerId);
  const boardX = pointerToBoardX(event.clientX);
  state.dragOffset = boardX - state.trayX;
}

function onPointerMove(event) {
  if (!state.dragging) {
    return;
  }
  const boardX = pointerToBoardX(event.clientX);
  state.trayX = clamp(boardX - state.dragOffset, 0, state.boardWidth - state.trayWidth);
  applyTrayPosition();
}

function onPointerUp(event) {
  state.dragging = false;
  tray.releasePointerCapture?.(event.pointerId);
}

if (supportChannel) {
  supportChannel.addEventListener("message", (event) => {
    handleSupportMessage(event.data);
  });
}

window.addEventListener("storage", (event) => {
  if (event.key === "sushi-catch-prototype-event" && event.newValue) {
    const data = JSON.parse(event.newValue);
    handleSupportMessage(data);
  }
});

window.addEventListener("resize", updateBoardMetrics);
tray.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerUp);

updateBoardMetrics();
resetRound();
setInterval(cycleQueueMock, 9000);
setInterval(updateSupporterCount, 4000);
requestAnimationFrame(animate);
