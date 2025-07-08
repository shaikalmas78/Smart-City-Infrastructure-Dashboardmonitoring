const JUNCTION_RADIUS = 14;
const VEHICLE_SPEED = 0.5; // pixels per frame
const DATASET_SWITCH_INTERVAL = 5000;

// Static junction definitions (positions remain unchanged)
const junctions = [
  { id: "J1", x: 100, y: 100, aqi: 0 },
  { id: "J2", x: 300, y: 100, aqi: 0 },
  { id: "J3", x: 500, y: 100, aqi: 0 },
  { id: "J4", x: 100, y: 300, aqi: 0 },
  { id: "J5", x: 300, y: 300, aqi: 0 },
  { id: "J6", x: 500, y: 300, aqi: 0 }
];

const roads = [
  { from: "J1", to: "J2" }, { from: "J2", to: "J3" },
  { from: "J1", to: "J4" }, { from: "J2", to: "J5" }, { from: "J3", to: "J6" },
  { from: "J4", to: "J5" }, { from: "J5", to: "J6" }
];

let currentDatasetIndex = 0;
let datasetKeys = ["Live Dataset - Fetched from API"];
let currentAQIData = [];
let junctionSignals = {};
let activeVehicles = [];

const trafficMap = document.getElementById("trafficMap");
const apiEndpoint = "https://d3wui4o2xg.execute-api.ap-south-1.amazonaws.com/prod/process-data ";

// Function to fetch data from the API Gateway
async function fetchAQIData() {
  try {
    const response = await fetch(apiEndpoint);
    if (!response.ok) throw new Error("Failed to fetch data");

    const result = await response.json();
    
    // Assuming the API returns an array of objects similar to datasets
    currentAQIData = result || [];
    drawMap();
  } catch (error) {
    console.error("Error fetching data:", error);
    alert("Could not load live dataset from API.");
  }
}

function applyAQIData(aqiData) {
  aqiData.forEach(d => {
    const j = junctions.find(j => j.id === d.id);
    if (j) {
      j.aqi = d.aqi !== undefined ? Number(d.aqi) : null;
      j.noiseLevel = d.noiseLevel !== undefined ? Number(d.noiseLevel) : null;
      j.humidity = d.humidity !== undefined ? Number(d.humidity) : null;
    }
  });
}

function assignSignals() {
  junctions.forEach(j => {
    let hasNegative = false;
    if (
      j.aqi !== null && j.aqi < 0 ||
      j.noiseLevel !== null && j.noiseLevel < 0 ||
      j.humidity !== null && j.humidity < 0
    ) {
      hasNegative = true;
    }

    if (hasNegative) {
      junctionSignals[j.id] = "red";
    } else if (j.aqi === null || j.aqi === 0) {
      junctionSignals[j.id] = "green"; // Safe if 0 or unknown
    } else if (j.aqi <= 200) {
      junctionSignals[j.id] = "yellow";
    } else {
      junctionSignals[j.id] = "red";
    }
  });
}

function getSignalColor(signal) {
  return signal === "green" ? "#4caf50" :
         signal === "yellow" ? "#ffeb3b" : "#f44336";
}

function getAQIColor(aqi) {
  if (aqi === null) return "#fff";
  if (aqi <= 50) return "#4caf50";
  if (aqi <= 100) return "#ffeb3b";
  if (aqi <= 150) return "#ff9800";
  if (aqi <= 200) return "#f44336";
  if (aqi <= 300) return "#9c27b0";
  return "#d32f2f";
}

function getNoiseColor(noiseLevel) {
  if (noiseLevel === null) return "#fff";
  if (noiseLevel <= 50) return "#4caf50";
  if (noiseLevel <= 70) return "#ffeb3b";
  if (noiseLevel <= 80) return "#ff9800";
  if (noiseLevel <= 90) return "#f44336";
  return "#d32f2f";
}

function getHumidityColor(humidity) {
  if (humidity === null) return "#fff";
  if (humidity <= 30) return "#ff9800";
  if (humidity <= 60) return "#4caf50";
  if (humidity <= 80) return "#ffeb3b";
  return "#f44336";
}

function getAlertStatus(junction) {
  const alerts = [];
  if (junction.aqi !== null && junction.aqi < 0) {
    alerts.push({ type: "AQI", level: "Invalid", value: junction.aqi });
  }
  if (junction.noiseLevel !== null && junction.noiseLevel < 0) {
    alerts.push({ type: "Noise", level: "Invalid", value: junction.noiseLevel });
  }
  if (junction.humidity !== null && junction.humidity < 0) {
    alerts.push({ type: "Humidity", level: "Invalid", value: junction.humidity });
  }
  return alerts;
}

function updateMetrics() {
  const panel = document.getElementById("junctionStatus");
  panel.innerHTML = "";
  junctions.forEach(j => {
    const signal = junctionSignals[j.id];
    const badgeClass = signal === 'green'
      ? 'success'
      : signal === 'yellow' ? 'warning text-dark' : 'danger';
    const alerts = getAlertStatus(j);
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";
    let metricString = `<strong>${j.id}</strong>`;
    if (j.aqi !== null) metricString += ` - AQI: ${j.aqi}`;
    if (j.noiseLevel !== null) metricString += `, Noise: ${j.noiseLevel} dB`;
    if (j.humidity !== null) metricString += `, Humidity: ${j.humidity}%`;
    if (alerts.length > 0) {
      const alertText = alerts.map(a => `${a.type}: ${a.level}`).join(", ");
      metricString += `<br><span class="text-danger">⚠️ Alert: ${alertText}</span>`;
    }
    li.innerHTML = `
      <span>${metricString}</span>
      <span class="badge bg-${badgeClass}">
        ${signal.toUpperCase()}
      </span>
    `;
    panel.appendChild(li);
  });
  document.getElementById("totalVehicles").textContent = activeVehicles.length;
}

class Vehicle {
  constructor(fromId, toId) {
    this.from = junctions.find(j => j.id === fromId);
    this.to = junctions.find(j => j.id === toId);
    this.progress = 0;
    this.totalDistance = Math.hypot(this.to.x - this.from.x, this.to.y - this.from.y);
    this.speed = VEHICLE_SPEED * (junctionSignals[this.to.id] === "yellow" && this.to.aqi <= 200 ? 0.5 : 1);
    this.element = null;
    this.animationFrame = null;
  }

  start() {
    this.element = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    this.element.setAttribute("x", this.from.x);
    this.element.setAttribute("y", this.from.y);
    this.element.setAttribute("width", "10");
    this.element.setAttribute("height", "6");
    this.element.setAttribute("fill", "orange");
    trafficMap.appendChild(this.element);
    this.animate();
  }

  animate() {
    const dx = this.to.x - this.from.x;
    const dy = this.to.y - this.from.y;
    const stepX = this.speed * (dx / this.totalDistance);
    const stepY = this.speed * (dy / this.totalDistance);
    const moveStep = () => {
      if (this.progress >= this.totalDistance) {
        if (junctionSignals[this.to.id] === "red" || this.to.aqi > 200) {
          this.element.setAttribute("fill", "#555");
          const newPath = findSafePath(this.to.id, "J6"); // Try rerouting
          if (newPath && newPath.length > 1) {
            const nextJunction = newPath[1];
            const newVehicle = new Vehicle(this.to.id, nextJunction);
            newVehicle.start();
            activeVehicles.push(newVehicle);
          } else {
            setTimeout(() => {
              if (trafficMap.contains(this.element)) {
                trafficMap.removeChild(this.element);
              }
            }, 5000);
          }
        } else {
          trafficMap.removeChild(this.element);
        }
        return;
      }
      if (junctionSignals[this.to.id] === "red" || this.to.aqi > 200) {
        cancelAnimationFrame(this.animationFrame);
        this.element.setAttribute("fill", "#555");
        const newPath = findSafePath(this.to.id, "J6");
        if (newPath && newPath.length > 1) {
          const nextJunction = newPath[1];
          const newVehicle = new Vehicle(this.to.id, nextJunction);
          newVehicle.start();
          activeVehicles.push(newVehicle);
        } else {
          setTimeout(() => {
            if (trafficMap.contains(this.element)) {
              trafficMap.removeChild(this.element);
            }
          }, 5000);
        }
        return;
      }
      this.progress += this.speed;
      const newX = this.from.x + (dx * this.progress / this.totalDistance);
      const newY = this.from.y + (dy * this.progress / this.totalDistance);
      this.element.setAttribute("x", newX);
      this.element.setAttribute("y", newY);
      this.animationFrame = requestAnimationFrame(moveStep);
    };
    moveStep();
  }

  stop() {
    cancelAnimationFrame(this.animationFrame);
  }
}

function drawMap() {
  if (currentAQIData.length === 0) {
    console.warn("No AQI data loaded yet.");
    return;
  }

  applyAQIData(currentAQIData);
  assignSignals();

  // Redraw map and vehicles
  trafficMap.innerHTML = `
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="5" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#000"/>
      </marker>
    </defs>
  `;

  roads.forEach(r => {
    const from = junctions.find(j => j.id === r.from);
    const to = junctions.find(j => j.id === r.to);
    const roadLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    roadLine.setAttribute("x1", from.x);
    roadLine.setAttribute("y1", from.y);
    roadLine.setAttribute("x2", to.x);
    roadLine.setAttribute("y2", to.y);
    roadLine.setAttribute("stroke", getRoadColor(r.from, r.to));
    roadLine.setAttribute("stroke-width", "4");
    trafficMap.appendChild(roadLine);
  });

  activeVehicles.forEach(v => v.stop());
  activeVehicles = [];

  junctions.forEach(jFrom => {
    if (junctionSignals[jFrom.id] === "red") return;
    const outgoingRoads = roads.filter(r => r.from === jFrom.id);
    outgoingRoads.forEach(r => {
      const jTo = junctions.find(j => j.id === r.to);
      const targetSignal = junctionSignals[jTo.id];
      if (
        targetSignal !== "red" &&
        (jTo.aqi === null || jTo.aqi <= 200)
      ) {
        const vehicle = new Vehicle(jFrom.id, jTo.id);
        vehicle.start();
        activeVehicles.push(vehicle);
      }
    });
  });

  junctions.forEach(j => {
    const alerts = getAlertStatus(j);
    const signalColor = alerts.some(a => a.level === "Invalid")
      ? "#f44336"
      : getSignalColor(junctionSignals[j.id]);
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", j.x);
    circle.setAttribute("cy", j.y);
    circle.setAttribute("r", "14");
    circle.setAttribute("fill", signalColor);
    trafficMap.appendChild(circle);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.textContent = `${j.id} (${junctionSignals[j.id]})`;
    label.setAttribute("x", j.x - 10);
    label.setAttribute("y", j.y + 30);
    label.setAttribute("font-size", "12");
    label.setAttribute("fill", "#fff");
    trafficMap.appendChild(label);

    const aqiText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    aqiText.textContent = `AQI: ${j.aqi !== null ? j.aqi : "-"}`;
    aqiText.setAttribute("x", j.x + 15);
    aqiText.setAttribute("y", j.y + 25);
    aqiText.setAttribute("font-size", "12");
    aqiText.setAttribute("fill", getAQIColor(j.aqi));
    trafficMap.appendChild(aqiText);

    if (j.noiseLevel !== null) {
      const noiseText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      noiseText.textContent = `Noise: ${j.noiseLevel} dB`;
      noiseText.setAttribute("x", j.x + 15);
      noiseText.setAttribute("y", j.y + 40);
      noiseText.setAttribute("font-size", "12");
      noiseText.setAttribute("fill", getNoiseColor(j.noiseLevel));
      trafficMap.appendChild(noiseText);
    }

    if (j.humidity !== null) {
      const humidityText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      humidityText.textContent = `Humidity: ${j.humidity}%`;
      humidityText.setAttribute("x", j.x + 15);
      humidityText.setAttribute("y", j.y + 55);
      humidityText.setAttribute("font-size", "12");
      humidityText.setAttribute("fill", getHumidityColor(j.humidity));
      trafficMap.appendChild(humidityText);
    }

    if (getAlertStatus(j).length > 0) {
      const warning = document.createElementNS("http://www.w3.org/2000/svg", "text");
      warning.textContent = "⚠️";
      warning.setAttribute("x", j.x + 20);
      warning.setAttribute("y", j.y - 20);
      warning.setAttribute("font-size", "14");
      warning.setAttribute("fill", "#ff4d4d");
      trafficMap.appendChild(warning);
    }
  });

  updateMetrics();
}

function populateDatasets() {
  const select = document.getElementById("datasetSelect");
  datasetKeys.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  select.onchange = () => {
    fetchAQIData(); // Re-fetch data when dataset changes (if needed)
  };
}

function getRoadColor(fromId, toId) {
  const fromSignal = junctionSignals[fromId];
  const toSignal = junctionSignals[toId];
  const fromAQI = junctions.find(j => j.id === fromId)?.aqi;
  const toAQI = junctions.find(j => j.id === toId)?.aqi;

  if (
    fromSignal !== "red" &&
    toSignal !== "red" &&
    (fromAQI === null || fromAQI <= 200) &&
    (toAQI === null || toAQI <= 200)
  ) {
    return "#4caf50"; // Green
  } else {
    return "#f44336"; // Red
  }
}

function findSafePath(start, end) {
  const graph = {};
  roads.forEach(r => {
    if (!graph[r.from]) graph[r.from] = [];
    graph[r.from].push(r.to);
  });

  const queue = [{ node: start, path: [start] }];
  const visited = new Set([start]);

  while (queue.length > 0) {
    const { node, path } = queue.shift();
    if (node === end) return path;

    const neighbors = graph[node] || [];
    for (let neighbor of neighbors) {
      const neighborNode = junctions.find(j => j.id === neighbor);
      const neighborAQI = neighborNode?.aqi;
      const neighborSignal = junctionSignals[neighbor];

      if (
        neighborAQI > 200 ||
        neighborSignal === "red" ||
        visited.has(neighbor)
      ) continue;

      visited.add(neighbor);
      queue.push({ node: neighbor, path: [...path, neighbor] });
    }
  }

  return null;
}

function drawRoute(path) {
  trafficMap.querySelectorAll(".highlight-path").forEach(el => el.remove());
  for (let i = 0; i < path.length - 1; i++) {
    const from = junctions.find(j => j.id === path[i]);
    const to = junctions.find(j => j.id === path[i + 1]);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", from.x);
    line.setAttribute("y1", from.y);
    line.setAttribute("x2", to.x);
    line.setAttribute("y2", to.y);
    line.setAttribute("stroke", "blue");
    line.setAttribute("stroke-width", "4");
    line.setAttribute("class", "highlight-path");
    trafficMap.appendChild(line);
  }
}

function findAndDrawPath() {
  const start = document.getElementById("startJunction").value;
  const end = document.getElementById("endJunction").value;
  const resultDiv = document.getElementById("routeResult");

  if (!start || !end || start === end) {
    resultDiv.innerHTML = '<div class="alert alert-warning">Select valid start and end junctions.</div>';
    return;
  }

  const path = findSafePath(start, end);
  if (!path) {
    resultDiv.innerHTML = '<div class="alert alert-danger">🚫 No safe route due to red signals or hazardous AQI.</div>';
    return;
  }

  resultDiv.innerHTML = `<div class="alert alert-success">🚗 Optimal Safe Route: ${path.join(" → ")}</div>`;
  drawRoute(path);
}

function populateDropdowns() {
  const start = document.getElementById("startJunction");
  const end = document.getElementById("endJunction");
  junctions.forEach(j => {
    const opt = document.createElement("option");
    opt.value = j.id;
    opt.textContent = j.id;
    start.appendChild(opt.cloneNode(true));
    end.appendChild(opt);
  });
}

window.onload = () => {
  fetchAQIData(); // Fetch initial data on page load
  populateDropdowns();
  populateDatasets();
  setInterval(fetchAQIData, DATASET_SWITCH_INTERVAL); // Refresh dataset periodically
};