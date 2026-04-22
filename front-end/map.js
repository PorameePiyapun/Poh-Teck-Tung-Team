const map = L.map('map').setView([13.7563, 100.5018], 12);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png')
  .addTo(map);

const cluster = L.markerClusterGroup();
map.addLayer(cluster);

let markers = {};
let myLocation = null;

// 📍 location
navigator.geolocation.getCurrentPosition(pos => {
  myLocation = [pos.coords.latitude, pos.coords.longitude];
  L.marker(myLocation).addTo(map).bindPopup("📍 คุณอยู่ตรงนี้");
});

// 🎯 icon
function createIcon(type) {
  let cls = "ambulance";
  let emoji = "🚑";

  if (type === "fire") {
    cls = "fire";
    emoji = "🔥";
  } else if (type === "rescue") {
    cls = "rescue";
    emoji = "🛠";
  }

  return L.divIcon({
    html: `<div class="marker ${cls}">${emoji}</div>`,
    className: ""
  });
}

// 🔥 smooth movement
function moveMarkerSmooth(marker, newLat, newLng) {
  const start = marker.getLatLng();
  const duration = 1000;
  const startTime = performance.now();

  function animate(time) {
    const t = Math.min((time - startTime) / duration, 1);

    const lat = start.lat + (newLat - start.lat) * t;
    const lng = start.lng + (newLng - start.lng) * t;

    marker.setLatLng([lat, lng]);

    if (t < 1) requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

// 🔁 fake movement
function randomMove(v) {
  v.lat += (Math.random() - 0.5) * 0.001;
  v.lng += (Math.random() - 0.5) * 0.001;
}

// โหลดข้อมูล
async function loadVehicles() {
  let vehicles = [];

  try {
    const res = await fetch("http://localhost:3001/api/vehicles");
    vehicles = await res.json();
  } catch {
    vehicles = [
      { id:"V1", lat:13.75, lng:100.50, type:"ambulance", equipment:["oxygen"], caseType:"รถพยาบาล" },
      { id:"V2", lat:13.76, lng:100.51, type:"fire", equipment:["water"], caseType:"รถดับเพลิง" },
      { id:"V3", lat:13.77, lng:100.52, type:"rescue", equipment:["rescue"], caseType:"รถกู้ภัย" }
    ];
  }

  document.getElementById("status").innerText =
    "🟢 ACTIVE: " + vehicles.length + " units";

  const caseType = document.getElementById("caseType").value;
  const needOxygen = document.getElementById("oxygen").checked;
  const needWater = document.getElementById("water").checked;
  const needRescue = document.getElementById("rescue").checked;

  let visible = new Set();

  vehicles.forEach(v => {

    randomMove(v); // 🔥 ให้รถขยับ

    if (caseType && v.caseType !== caseType) return;
    if (needOxygen && !v.equipment.includes("oxygen")) return;
    if (needWater && !v.equipment.includes("water")) return;
    if (needRescue && !v.equipment.includes("rescue")) return;

    visible.add(v.id);

    const popup = `
      <b>${v.id}</b><br>
      ประเภทรถ: ${v.caseType}<br>
      อุปกรณ์: ${v.equipment.join(", ")}<br><br>
      <button onclick="requestHelp('${v.id}', ${v.lat}, ${v.lng})">
        📡 ขอความช่วยเหลือ
      </button>
    `;

    if (!markers[v.id]) {
      const marker = L.marker([v.lat, v.lng], {
        icon: createIcon(v.type)
      }).bindPopup(popup);

      cluster.addLayer(marker);
      markers[v.id] = marker;
    } else {
      moveMarkerSmooth(markers[v.id], v.lat, v.lng);
      markers[v.id].setPopupContent(popup);
    }
  });

  Object.keys(markers).forEach(id => {
    if (!visible.has(id)) {
      cluster.removeLayer(markers[id]);
      delete markers[id];
    }
  });
}

// 📡 request
function requestHelp(id, lat, lng) {
  if (!myLocation) return alert("ยังไม่รู้ตำแหน่งคุณ");

  alert(`🚨 ส่งคำขอไปยัง ${id}`);
  console.log("SEND:", { from: myLocation, to: [lat, lng], id });
}

// realtime
setInterval(loadVehicles, 5000);
loadVehicles();

