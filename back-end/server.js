/**
 * ป่อเต็กตึ๊ง – Case Management Backend (Final Version)
 */
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const WebSocket = require('ws'); // ประกาศครั้งเดียวที่นี่!

const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = 3002;

app.use(cors());
app.use(express.json({ limit: "20mb" }));

/* ─────────────────────────────────────────
   FILE STORAGE & DATA LOADING
────────────────────────────────────────── */
const DATA_DIR = path.join(__dirname, "data");
const PHOTOS_DIR = path.join(__dirname, "data", "photos");
const CASES_FILE = path.join(DATA_DIR, "cases.json");
const OFFICERS_FILE = path.join(DATA_DIR, "officers.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

function loadJSON(file, def) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  return def;
}
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8"); } catch (e) { console.error(e); }
}

let officers = loadJSON(OFFICERS_FILE, {
  "officer-001": { id: "officer-001", name: "สกล รักษ์ชาติ", status: "available" },
});
let cases = loadJSON(CASES_FILE, {});

/* ─────────────────────────────────────────
   APIs (Port 3001)
────────────────────────────────────────── */
app.get("/api/cases", (_req, res) => res.json({ success: true, data: Object.values(cases) }));
app.get("/api/officers", (_req, res) => res.json({ success: true, data: Object.values(officers) }));

app.post("/api/cases", (req, res) => {
  const { type, location, incidentGps, source, isVerified } = req.body;
  const caseId = `PTT-${Date.now().toString().slice(-5)}`;
  cases[caseId] = { 
    id: caseId, 
    type, 
    location, 
    status: "waiting", 
    incidentGps, 
    source: source || "unknown",
    isVerified: isVerified !== undefined ? isVerified : false,
    createdAt: new Date().toISOString() 
  };
  saveJSON(CASES_FILE, cases);
  res.status(201).json({ success: true, caseId, data: cases[caseId] });
});

/* ═══════════════════════════════════════════
   WEBSOCKET SERVER (Port 3002) - DEMO MODE
═══════════════════════════════════════════ */
const wss = new WebSocket.Server({ port: WS_PORT });

// แก้ไขใน server.js ตรงส่วน demoVehicles
// แก้ไขใน server.js ตรงส่วน demoVehicles
let demoVehicles = [
  { teamId: 'h001', teamName: 'สมชาย (หน่วยเคลื่อนที่เร็ว)', lat: 13.7460, lng: 100.5300 }, // แถวสยาม
  { teamId: 'h002', teamName: 'สมศักดิ์ (อาสาเขตปทุมวัน)', lat: 13.7390, lng: 100.5230 }, // แถวสามย่าน
  { teamId: 'h003', teamName: 'สมศรี (บรรทัดทอง)', lat: 13.7420, lng: 100.5210 }    // แถวบรรทัดทอง
];

// ส่งข้อมูลรถขยับอัตโนมัติทุก 5 วินาที
setInterval(() => {
  demoVehicles = demoVehicles.map(v => ({
    ...v,
    lat: v.lat + (Math.random() - 0.5) * 0.0006,
    lng: v.lng + (Math.random() - 0.5) * 0.0006
  }));

  const payload = JSON.stringify({
    type: 'VEHICLE_UPDATE',
    vehicles: demoVehicles.map(v => ({
      teamId: v.teamId,
      teamName: v.teamName,
      gps: { lat: v.lat, lng: v.lng },
      status: 'สแตนด์บาย'
    }))
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}, 5000);

/* ─────────────────────────────────────────
   START SERVER
────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n🚑 API Run: http://localhost:${PORT}`);
  console.log(`📡 WebSocket Demo Run: http://localhost:${WS_PORT}`);
  console.log(`🚀 สถานะ: ระบบกำลังจำลองรถขยับ 3 คันอัตโนมัติ\n`);
});