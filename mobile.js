const screens = {
  home: document.getElementById("screen-home"),
  waiting: document.getElementById("screen-waiting"),
  controls: document.getElementById("screen-controls"),
  result: document.getElementById("screen-result")
};

const joinBtn = document.getElementById("joinBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const leaveBtn = document.getElementById("leaveBtn");
const waitingCount = document.getElementById("waitingCount");
const mobileTime = document.getElementById("mobileTime");
const mobileScore = document.getElementById("mobileScore");
const playerCode = document.getElementById("playerCode");
const lastActionLabel = document.getElementById("lastActionLabel");
const resultScore = document.getElementById("resultScore");
const resultSupportCount = document.getElementById("resultSupportCount");
const resultSummary = document.getElementById("resultSummary");
const actionButtons = Array.from(document.querySelectorAll("[data-action]"));

const channelName = "sushi-catch-prototype";
const supportChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(channelName) : null;

const storageKey = "sushi-catch-mobile-player";
const player = JSON.parse(localStorage.getItem(storageKey) || "null") || createPlayer();
localStorage.setItem(storageKey, JSON.stringify(player));
playerCode.textContent = player.playerCode;

const state = {
  joined: false,
  waitingTimer: null,
  heartbeatTimer: null,
  supportCount: 0,
  cooldowns: {
    "spawn-normal": 2,
    "spawn-bonus": 6,
    "support-enlarge": 10,
    "support-slow": 10
  }
};

const actionCopyMap = {
  "spawn-normal": "已送出普通壽司",
  "spawn-bonus": "已送出加分壽司",
  "support-enlarge": "托盤放大支援已啟動",
  "support-slow": "掉落減速支援已啟動"
};

function createPlayer() {
  const id = Math.random().toString(36).slice(2, 10);
  const numeric = Math.floor(Math.random() * 900 + 100);
  return {
    playerId: `player-${id}`,
    playerCode: `SP-${numeric}`
  };
}

function activateScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
}

function broadcast(payload) {
  const wrapped = {
    ...payload,
    playerId: player.playerId,
    playerCode: player.playerCode,
    timestamp: Date.now()
  };

  if (supportChannel) {
    supportChannel.postMessage(wrapped);
  }

  localStorage.setItem("sushi-catch-prototype-event", JSON.stringify(wrapped));
}

function joinRound() {
  state.joined = true;
  state.supportCount = 0;
  activateScreen("waiting");
  broadcast({ type: "join" });
  startHeartbeat();

  let count = 3;
  waitingCount.textContent = String(count);
  clearInterval(state.waitingTimer);
  state.waitingTimer = setInterval(() => {
    count -= 1;
    waitingCount.textContent = String(Math.max(count, 0));
    if (count <= 0) {
      clearInterval(state.waitingTimer);
      activateScreen("controls");
      lastActionLabel.textContent = "尚未送出支援";
    }
  }, 1000);
}

function startHeartbeat() {
  clearInterval(state.heartbeatTimer);
  state.heartbeatTimer = setInterval(() => {
    if (state.joined) {
      broadcast({ type: "heartbeat" });
    }
  }, 5000);
}

function leaveRound() {
  state.joined = false;
  clearInterval(state.waitingTimer);
  clearInterval(state.heartbeatTimer);
  broadcast({ type: "leave" });
  activateScreen("home");
  lastActionLabel.textContent = "尚未送出支援";
}

function setCooldown(button, seconds) {
  let remaining = seconds;
  button.disabled = true;
  button.classList.add("cooldown");
  button.dataset.cooldown = `${remaining}s`;

  const timer = setInterval(() => {
    remaining -= 1;
    button.dataset.cooldown = `${remaining}s`;
    if (remaining <= 0) {
      clearInterval(timer);
      button.disabled = false;
      button.classList.remove("cooldown");
      button.dataset.cooldown = "";
    }
  }, 1000);
}

function sendAction(action) {
  if (!state.joined) {
    return;
  }

  state.supportCount += 1;
  broadcast({ type: action });
  lastActionLabel.textContent = actionCopyMap[action] || "已送出支援";

  const button = document.querySelector(`[data-action="${action}"]`);
  if (button) {
    setCooldown(button, state.cooldowns[action] || 3);
  }
}

function handleWallMessage(data) {
  if (!data || !data.type) {
    return;
  }

  if (data.type === "round-update") {
    mobileTime.textContent = String(data.timeLeft ?? 0);
    mobileScore.textContent = String(data.score ?? 0);
  }

  if (data.type === "round-start") {
    mobileTime.textContent = String(data.timeLeft ?? 40);
    mobileScore.textContent = String(data.score ?? 0);
    if (state.joined && !screens.controls.classList.contains("active")) {
      activateScreen("controls");
    }
  }

  if (data.type === "round-end") {
    resultScore.textContent = String(data.score ?? 0);
    resultSupportCount.textContent = String(state.supportCount);
    resultSummary.textContent = data.summary || "你已完成本局支援。";
    if (state.joined) {
      activateScreen("result");
    }
  }
}

if (supportChannel) {
  supportChannel.addEventListener("message", (event) => {
    handleWallMessage(event.data);
  });
}

window.addEventListener("storage", (event) => {
  if (event.key === "sushi-catch-prototype-event" && event.newValue) {
    const data = JSON.parse(event.newValue);
    handleWallMessage(data);
  }
});

joinBtn.addEventListener("click", joinRound);
playAgainBtn.addEventListener("click", joinRound);
leaveBtn.addEventListener("click", leaveRound);
actionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    sendAction(button.dataset.action);
  });
});

window.addEventListener("beforeunload", () => {
  if (state.joined) {
    broadcast({ type: "leave" });
  }
});
