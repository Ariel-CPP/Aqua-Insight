// Epidemiology GIS Mapping Module

let map;
let markersLayerGroup;
let radiusLayerGroup;
let heatLayer;

const demoData = [
  { id: 1, lat: -7.456, lng: 112.715, status: "WSSV", radius: 500, pcr: "CT 22", remarks: "Kematian massal 50%", name: "Tambak Sidoarjo A" },
  { id: 2, lat: -7.460, lng: 112.720, status: "Aman", radius: 0, pcr: "Negatif", remarks: "Normal", name: "Tambak Sidoarjo B" },
  { id: 3, lat: -7.472, lng: 112.711, status: "AHPND", radius: 300, pcr: "CT 28", remarks: "Hepatopankreas pucat", name: "Tambak Sidoarjo C" },
  { id: 4, lat: -7.450, lng: 112.705, status: "WSSV", radius: 500, pcr: "CT 20", remarks: "Kematian mendadak", name: "Tambak Sidoarjo D" },
  { id: 5, lat: -7.480, lng: 112.730, status: "Aman", radius: 0, pcr: "-", remarks: "Panen parsial", name: "Tambak Sidoarjo E" }
];

let globalGeoData = [];

document.addEventListener("DOMContentLoaded", () => {
  initMap();
});

function initMap() {
  // Initialize map centered at Sidoarjo (Indonesia) roughly
  map = L.map('map').setView([-7.45, 112.71], 12);
  
  // Dark mode tile layer (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);
  
  markersLayerGroup = L.layerGroup().addTo(map);
  radiusLayerGroup = L.layerGroup().addTo(map);
  // Heatlayer will be created when data is loaded
}

window.loadDemoMapData = function() {
  globalGeoData = [...demoData];
  renderMapAndTable();
}

window.loadCSVData = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const lines = text.split('\n');
    const parsedData = [];
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const parts = lines[i].split(',');
      if (parts.length >= 3) {
        parsedData.push({
          lat: parseFloat(parts[0]),
          lng: parseFloat(parts[1]),
          status: parts[2].trim(),
          radius: parts[3] ? parseInt(parts[3]) : 0,
          pcr: parts[4] || "-",
          remarks: parts[5] || "-",
          name: "Imported Point " + i,
          id: Date.now() + i
        });
      }
    }
    globalGeoData = globalGeoData.concat(parsedData);
    renderMapAndTable();
  };
  reader.readAsText(file);
}

window.addManualEntry = function() {
  const lat = parseFloat(document.getElementById('inp-lat').value);
  const lng = parseFloat(document.getElementById('inp-lng').value);
  const status = document.getElementById('inp-status').value;
  const pcr = document.getElementById('inp-pcr').value || "-";
  const remarks = document.getElementById('inp-remarks').value || "-";

  if (isNaN(lat) || isNaN(lng)) {
    alert("Koordinat Latitude dan Longitude harus diisi dengan angka.");
    return;
  }

  let radius = 0;
  if (status === "WSSV" || status === "AHPND" || status === "EHP" || status === "IMNV") {
    radius = status === "WSSV" ? 500 : 300; // default radius for specific diseases
  }

  const newEntry = {
    id: Date.now(),
    lat: lat,
    lng: lng,
    status: status,
    radius: radius,
    pcr: pcr,
    remarks: remarks,
    name: "Manual Point"
  };

  globalGeoData.push(newEntry);
  
  // Clear inputs
  document.getElementById('inp-lat').value = '';
  document.getElementById('inp-lng').value = '';
  document.getElementById('inp-pcr').value = '';
  document.getElementById('inp-remarks').value = '';

  renderMapAndTable();
}

window.deleteEntry = function(id) {
  globalGeoData = globalGeoData.filter(pt => pt.id !== id);
  renderMapAndTable();
}

function renderMapAndTable() {
  renderDataOnMap(globalGeoData);
  renderTable(globalGeoData);
}

function renderTable(data) {
  const tbody = document.getElementById('epi-table-body');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--text-secondary);">Belum ada data</td></tr>';
    return;
  }

  let html = '';
  data.forEach(pt => {
    let badgeClass = 'safe';
    if (pt.status !== 'Aman') {
      badgeClass = pt.status === 'WSSV' ? 'alert' : 'warning';
    }
    
    html += `
      <tr>
        <td style="font-family: monospace;">${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}</td>
        <td><span class="status-badge ${badgeClass}">${pt.status}</span></td>
        <td>${pt.pcr}</td>
        <td>${pt.remarks}</td>
        <td><button class="header-btn compact-btn" onclick="deleteEntry(${pt.id})"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function renderDataOnMap(data) {
  markersLayerGroup.clearLayers();
  radiusLayerGroup.clearLayers();
  if (heatLayer) {
    map.removeLayer(heatLayer);
  }
  
  let safeCount = 0, wssvCount = 0, ahpndCount = 0;
  const heatPoints = [];
  
  data.forEach(pt => {
    // Marker Color based on Status
    let color = "#10B981"; // Safe
    if (pt.status === "WSSV") { color = "#EF4444"; wssvCount++; heatPoints.push([pt.lat, pt.lng, 1.0]); }
    else if (pt.status === "AHPND") { color = "#F59E0B"; ahpndCount++; heatPoints.push([pt.lat, pt.lng, 0.7]); }
    else { safeCount++; }
    
    // Create Circle Marker
    const marker = L.circleMarker([pt.lat, pt.lng], {
      color: color,
      fillColor: color,
      fillOpacity: 0.8,
      radius: 8
    }).bindPopup(`<b>${pt.name}</b><br>Status: ${pt.status}<br>PCR: ${pt.pcr}<br>Info: ${pt.remarks}`);
    
    markersLayerGroup.addLayer(marker);
    
    // Create Radius Buffer if infected
    if (pt.radius > 0) {
      const buffer = L.circle([pt.lat, pt.lng], {
        color: color,
        fillColor: color,
        fillOpacity: 0.1,
        radius: pt.radius,
        weight: 1,
        dashArray: "5, 5"
      });
      radiusLayerGroup.addLayer(buffer);
    }
  });
  
  // Heatmap layer
  if (typeof L.heatLayer !== 'undefined') {
    heatLayer = L.heatLayer(heatPoints, {radius: 40, blur: 25, maxZoom: 14});
    // Don't add to map immediately unless toggle is on
    if (document.getElementById('layer-heatmap').checked) {
      heatLayer.addTo(map);
    }
  }
  
  // Update Stats
  document.getElementById('stat-total').innerText = data.length;
  document.getElementById('stat-safe').innerText = safeCount;
  document.getElementById('stat-wssv').innerText = wssvCount;
  document.getElementById('stat-ahpnd').innerText = ahpndCount;
  
  // Recenter map to data bounds
  if (data.length > 0) {
    const bounds = L.latLngBounds(data.map(pt => [pt.lat, pt.lng]));
    map.fitBounds(bounds, {padding: [50, 50]});
  }
}

window.toggleLayer = function(layerType) {
  const isChecked = document.getElementById(`layer-${layerType}`).checked;
  
  if (layerType === 'markers') {
    if (isChecked) map.addLayer(markersLayerGroup);
    else map.removeLayer(markersLayerGroup);
  } else if (layerType === 'radius') {
    if (isChecked) map.addLayer(radiusLayerGroup);
    else map.removeLayer(radiusLayerGroup);
  } else if (layerType === 'heatmap') {
    if (heatLayer) {
      if (isChecked) map.addLayer(heatLayer);
      else map.removeLayer(heatLayer);
    }
  }
}
