// Replace this URL with your deployed Render backend URL.
const API_URL = "https://YOUR-SERVICE-NAME.onrender.com";

const bufferElement = document.getElementById("buffer");
const statusElement = document.getElementById("status");
const messageElement = document.getElementById("message");
const logElement = document.getElementById("log");

const produceBtn = document.getElementById("produceBtn");
const consumeBtn = document.getElementById("consumeBtn");
const resetBtn = document.getElementById("resetBtn");
const capacitySelect = document.getElementById("capacity");

let busy = false;

function addLog(message) {
  const item = document.createElement("li");
  item.textContent = message;
  logElement.prepend(item);

  while (logElement.children.length > 8) {
    logElement.lastElementChild.remove();
  }
}

function setBusy(value) {
  busy = value;
  produceBtn.disabled = value;
  consumeBtn.disabled = value;
  resetBtn.disabled = value;
  capacitySelect.disabled = value;
}

async function apiRequest(path, method = "GET", body = null) {
  const options = {
    method,
    headers: {}
  };

  if (body !== null) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function renderBuffer(state) {
  bufferElement.innerHTML = "";

  state.buffer.forEach((value, index) => {
    const slot = document.createElement("div");
    slot.className = "slot" + (value !== null ? " filled" : "");

    const indexLabel = document.createElement("span");
    indexLabel.className = "index";
    indexLabel.textContent = `Index ${index}`;
    slot.appendChild(indexLabel);

    const packet = document.createElement("span");
    packet.className = value !== null ? "packet" : "empty";
    packet.textContent = value !== null ? value : "Empty";
    slot.appendChild(packet);

    if (value !== null && index === state.front) {
      const front = document.createElement("span");
      front.className = "pointer front";
      front.textContent = "FRONT";
      slot.appendChild(front);
    }

    if (value !== null && index === state.rear) {
      const rear = document.createElement("span");
      rear.className = "pointer rear";
      rear.textContent = "REAR";
      slot.appendChild(rear);
    }

    bufferElement.appendChild(slot);
  });

  document.getElementById("occupancy").textContent =
    `${state.size} / ${state.capacity} slots`;

  document.getElementById("produced").textContent =
    state.total_produced;

  document.getElementById("consumed").textContent =
    state.total_consumed;

  document.getElementById("free").textContent =
    state.capacity - state.size;

  const percentage = Math.round(
    (state.size / state.capacity) * 100
  );

  document.getElementById("usage").textContent = `${percentage}%`;
  document.getElementById("progressBar").style.width =
    `${percentage}%`;

  capacitySelect.value = String(state.capacity);
  statusElement.textContent = "Connected";
  statusElement.classList.remove("offline");
}

async function refreshState() {
  try {
    const state = await apiRequest("/api/state");
    renderBuffer(state);
  } catch (error) {
    statusElement.textContent = "Backend Offline";
    statusElement.classList.add("offline");
    messageElement.textContent =
      `${error.message}. Check your Render API URL.`;
  }
}

async function performOperation(path, body = {}) {
  if (busy) return;

  setBusy(true);

  try {
    const result = await apiRequest(path, "POST", body);
    renderBuffer(result.state);
    messageElement.textContent = result.message;
    addLog(result.message);
  } catch (error) {
    messageElement.textContent = error.message;
    addLog(`Error: ${error.message}`);
    await refreshState();
  } finally {
    setBusy(false);
  }
}

produceBtn.addEventListener("click", () => {
  performOperation("/api/produce");
});

consumeBtn.addEventListener("click", () => {
  performOperation("/api/consume");
});

resetBtn.addEventListener("click", () => {
  performOperation("/api/reset", {
    capacity: Number(capacitySelect.value)
  });
});

capacitySelect.addEventListener("change", () => {
  performOperation("/api/reset", {
    capacity: Number(capacitySelect.value)
  });
});

refreshState();