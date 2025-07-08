# Smart City Infrastructure Monitoring Using IoT and Cloud Services

This project is a simulation of a Smart City Traffic and Environmental Monitoring system. It visualizes real-time data like Air Quality Index (AQI), noise level, and humidity across six major junctions, dynamically changing traffic signals based on pollution data. Initially designed using AWS services, this version uses a **local dataset** to avoid cloud costs and runs entirely offline.

---

## Features

- Real-time simulation of six traffic junctions (J1–J6)
- Traffic signals (Green/Yellow/Red) adapt based on AQI values
- Visual indicators for AQI, noise, and humidity
- Animated vehicle movement across city roads
- Optimal route planning between junctions
- Interactive dashboard with live metric updates
- **Works offline using `sample_data.json`** (no AWS required)

---

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Visualization**: SVG for map and vehicle animations
- **Cloud Integration (Original version)**: AWS Lambda, S3, SNS (now replaced with local JSON)
- **Development Tools**: VS Code, Git

---

## Folder Structure
smart-city-iot-dashboard/
├── index.html
├── script.js
├── styles.css
├── sample_data.json
└── README.md

