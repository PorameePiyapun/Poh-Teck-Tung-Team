/**
 * ป่อเต็กตึ๊ง – Case Management Backend
 * Node.js + Express
 *
 * Install:  npm install express cors multer
 * Run:      node server.js
 * Port:     3001
 */

const express = require("express");
const cors    = require("cors");
const fs      = require("fs");
const path    = require("path");
const puppeteer = require('puppeteer');
const axios = require("axios");
const multer = require('multer');
const upload = multer();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.json({ limit: "20mb" }));  // รองรับ base64 รูปภาพ

/* ─────────────────────────────────────────
   FILE STORAGE
────────────────────────────────────────── */
const DATA_DIR      = path.join(__dirname, "data");
const PHOTOS_DIR    = path.join(__dirname, "data", "photos");
const CASES_FILE    = path.join(DATA_DIR, "cases.json");
const ACTIVITY_FILE = path.join(DATA_DIR, "activity.json");
const OFFICERS_FILE = path.join(DATA_DIR, "officers.json");

[DATA_DIR, PHOTOS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// เสิร์ฟรูปภาพ static
app.use("/photos", express.static(PHOTOS_DIR));

function loadJSON(file, def) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  return def;
}
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8"); } catch (e) { console.error(e.message); }
}

/* ─────────────────────────────────────────
   DATA
────────────────────────────────────────── */
let officers = loadJSON(OFFICERS_FILE, {
  "officer-001": { id:"officer-001", name:"สกล รักษ์ชาติ",  status:"available", updatedAt:null },
  "officer-002": { id:"officer-002", name:"วนัส ตั้งมั่น",   status:"busy",      updatedAt:null },
  "officer-003": { id:"officer-003", name:"ธนา ปราการ",     status:"available", updatedAt:null },
  "officer-004": { id:"officer-004", name:"คมกฤช ล้ำเลิศ", status:"busy",      updatedAt:null },
  "officer-005": { id:"officer-005", name:"อนุชา ขวัญใจ",  status:"available", updatedAt:null },
});

let cases = loadJSON(CASES_FILE, {
  "PTT-24001": {
    id:"PTT-24001", type:"อุบัติเหตุ", location:"ถ.พระราม 2 กม.15",
    priority:"critical", status:"waiting", assignedOfficer:null,
    reporterName:"ศิริพร ม.", reporterPhone:"081-234-5678",
    createdAt: new Date().toISOString(),
    // GPS จุดเกิดเหตุ (US-11) – ตั้งโดย dispatcher หรือ geocode จากชื่อสถานที่
    incidentGps: { lat: 13.6680, lng: 100.4722 },
    incidentAddress: "ถนนพระราม 2 กม.15 บางมด จอมทอง กรุงเทพมหานคร",
    incidentPhoto: null,   // base64 หรือ URL รูปภาพ
    enrouteAt:null, enrouteGps:null, enrouteAddress:null,
    arrivedAt:null, arrivedGps:null, arrivedAddress:null,
    closedAt:null, travelMin:null, totalMin:null, note:"",
  },
  "PTT-24004": {
    id:"PTT-24004", type:"ช่วยเหลือทั่วไป", location:"บ้านพัก ถ.เพชรบุรี",
    priority:"normal", status:"waiting", assignedOfficer:null,
    reporterName:"สมศักดิ์ พ.", reporterPhone:"082-345-6789",
    createdAt: new Date().toISOString(),
    incidentGps: { lat: 13.7447, lng: 100.5407 },
    incidentAddress: "ถนนเพชรบุรี ราชเทวี กรุงเทพมหานคร",
    incidentPhoto: null,
    enrouteAt:null, enrouteGps:null, enrouteAddress:null,
    arrivedAt:null, arrivedGps:null, arrivedAddress:null,
    closedAt:null, travelMin:null, totalMin:null, note:"",
  },
  "PTT-24005": {
    id:"PTT-24005", type:"อุบัติเหตุ", location:"แยกลาดกระบัง",
    priority:"high", status:"waiting", assignedOfficer:null,
    reporterName:"มูลนิธิรวมใจ", reporterPhone:"083-456-7890",
    createdAt: new Date().toISOString(),
    incidentGps: { lat: 13.7261, lng: 100.7517 },
    incidentAddress: "แยกลาดกระบัง ลาดกระบัง กรุงเทพมหานคร",
    incidentPhoto: null,
    enrouteAt:null, enrouteGps:null, enrouteAddress:null,
    arrivedAt:null, arrivedGps:null, arrivedAddress:null,
    closedAt:null, travelMin:null, totalMin:null, note:"",
  },
});

let activityLog = loadJSON(ACTIVITY_FILE, []);

saveJSON(OFFICERS_FILE, officers);
saveJSON(CASES_FILE, cases);
saveJSON(ACTIVITY_FILE, activityLog);

/* ─────────────────────────────────────────
   HELPER
────────────────────────────────────────── */
function addLog(caseId, officerId, action, detail = {}) {
  const entry = {
    id:          activityLog.length + 1,
    timestamp:   new Date().toISOString(),
    date:        new Date().toLocaleDateString("th-TH"),
    time:        new Date().toLocaleTimeString("th-TH", { hour12: false }),
    caseId, officerId,
    officerName: officerId ? (officers[officerId]?.name || officerId) : null,
    action, detail,
  };
  activityLog.unshift(entry);
  saveJSON(ACTIVITY_FILE, activityLog);
}

function calcMin(from, to) {
  if (!from) return null;
  return Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000));
}

/* ═══════════════════════════════════════════
   US-01 เปลี่ยนสถานะ
   PATCH /api/officers/:id/status
═══════════════════════════════════════════ */
app.patch("/api/officers/:officerId/status", (req, res) => {
  const { officerId } = req.params;
  const { status }    = req.body;
  if (!officers[officerId]) return res.status(404).json({ success:false, message:"ไม่พบพนักงาน" });
  if (!["available","busy"].includes(status)) return res.status(400).json({ success:false, message:"สถานะไม่ถูกต้อง" });

  officers[officerId].status    = status;
  officers[officerId].updatedAt = new Date().toISOString();
  saveJSON(OFFICERS_FILE, officers);
  addLog(null, officerId, "STATUS_CHANGED", { status });

  return res.json({
    success:true,
    message:`อัปเดตสถานะ ${status==="available"?"พร้อมปฏิบัติงาน ✅":"ไม่ว่าง 🔴"} เรียบร้อย`,
    officer: officers[officerId],
  });
});

app.get("/api/officers", (_req, res) => res.json({ success:true, data:Object.values(officers) }));

/* ═══════════════════════════════════════════
   US-11 โหลดพิกัด/ภาพที่เกิดเหตุทันที
   GET /api/cases/:id/incident
   → คืน GPS + ที่อยู่ + รูปภาพ (< 1 วินาที จาก cache)
═══════════════════════════════════════════ */
app.get("/api/cases/:caseId/incident", (req, res) => {
  const c = cases[req.params.caseId];
  if (!c) return res.status(404).json({ success:false, message:"ไม่พบเคส" });

  return res.json({
    success:     true,
    caseId:      c.id,
    location:    c.location,
    incidentGps: c.incidentGps,
    incidentAddress: c.incidentAddress,
    incidentPhoto:   c.incidentPhoto,  // base64 หรือ URL
    googleMapsUrl: c.incidentGps
      ? `https://www.google.com/maps?q=${c.incidentGps.lat},${c.incidentGps.lng}`
      : null,
    navigationUrl: c.incidentGps
      ? `https://www.google.com/maps/dir/?api=1&destination=${c.incidentGps.lat},${c.incidentGps.lng}&travelmode=driving`
      : null,
  });
});

/* ─────────────────────────────────────────
   US-11 อัปเดต GPS + รูปจุดเกิดเหตุ (dispatcher กรอก)
   POST /api/cases/:id/incident
   Body: { lat, lng, address?, photoBase64? }
────────────────────────────────────────── */
app.post("/api/cases/:caseId/incident", (req, res) => {
  const { caseId } = req.params;
  const { lat, lng, address, photoBase64 } = req.body;
  if (!cases[caseId]) return res.status(404).json({ success:false, message:"ไม่พบเคส" });
  if (lat == null || lng == null) return res.status(400).json({ success:false, message:"กรุณาส่ง lat, lng" });

  const c = cases[caseId];
  c.incidentGps     = { lat, lng };
  c.incidentAddress = address || c.incidentAddress;

  // บันทึกรูปภาพ base64
  if (photoBase64) {
    const ext      = photoBase64.startsWith("data:image/png") ? "png" : "jpg";
    const filename = `${caseId}_incident.${ext}`;
    const filepath = path.join(PHOTOS_DIR, filename);
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(filepath, base64Data, "base64");
    c.incidentPhoto = `http://localhost:3001/photos/${filename}`;
  }

  saveJSON(CASES_FILE, cases);
  addLog(caseId, null, "INCIDENT_UPDATED", { lat, lng, address, hasPhoto: !!photoBase64 });

  return res.json({
    success:true, message:"อัปเดตจุดเกิดเหตุเรียบร้อย",
    incidentGps: c.incidentGps,
    incidentAddress: c.incidentAddress,
    incidentPhoto: c.incidentPhoto,
    navigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
  });
});

/* ═══════════════════════════════════════════
   US-08 กำลังไป
   POST /api/cases/:id/enroute
═══════════════════════════════════════════ */
app.post("/api/cases/:caseId/enroute", (req, res) => {
  const { caseId } = req.params;
  const { officerId, lat, lng, accuracy, address } = req.body;
  if (!cases[caseId])       return res.status(404).json({ success:false, message:"ไม่พบเคส" });
  if (!officers[officerId]) return res.status(404).json({ success:false, message:"ไม่พบพนักงาน" });
  if (lat==null||lng==null) return res.status(400).json({ success:false, message:"กรุณาส่ง lat, lng" });

  const c = cases[caseId];
  c.status          = "enroute";
  c.assignedOfficer = officerId;
  c.enrouteAt       = new Date().toISOString();
  c.enrouteGps      = { lat, lng, accuracy: accuracy ?? null };
  c.enrouteAddress  = address || null;

  officers[officerId].status    = "busy";
  officers[officerId].updatedAt = new Date().toISOString();
  saveJSON(CASES_FILE, cases);
  saveJSON(OFFICERS_FILE, officers);
  addLog(caseId, officerId, "ENROUTE", { lat, lng, accuracy, address });

  return res.json({
    success:true, message:`บันทึก "กำลังไป" เคส ${caseId} เรียบร้อย`,
    caseId, status:"enroute", enrouteAt:c.enrouteAt, gps:c.enrouteGps,
    // ส่ง GPS จุดเกิดเหตุกลับมาด้วย เพื่อแสดงหมุดปลายทาง
    incidentGps:     c.incidentGps,
    incidentAddress: c.incidentAddress,
    navigationUrl:   c.incidentGps
      ? `https://www.google.com/maps/dir/?api=1&destination=${c.incidentGps.lat},${c.incidentGps.lng}&travelmode=driving`
      : null,
  });
});

/* ═══════════════════════════════════════════
   US-09 ถึงที่เกิดเหตุ
   POST /api/cases/:id/arrived
═══════════════════════════════════════════ */
app.post("/api/cases/:caseId/arrived", (req, res) => {
  const { caseId } = req.params;
  const { officerId, lat, lng, accuracy, address } = req.body;
  if (!cases[caseId])       return res.status(404).json({ success:false, message:"ไม่พบเคส" });
  if (!officers[officerId]) return res.status(404).json({ success:false, message:"ไม่พบพนักงาน" });

  const c = cases[caseId];
  if (!c.enrouteAt) return res.status(409).json({ success:false, message:"⚠️ กรุณากด 'กำลังไป' ก่อน" });
  if (c.arrivedAt)  return res.status(409).json({ success:false, message:"เคสนี้บันทึก 'ถึงที่เกิดเหตุ' แล้ว" });
  if (lat==null||lng==null) return res.status(400).json({ success:false, message:"กรุณาส่ง lat, lng" });

  const now       = new Date();
  const travelMin = calcMin(c.enrouteAt, now);

  c.status         = "on_scene";
  c.arrivedAt      = now.toISOString();
  c.arrivedGps     = { lat, lng, accuracy: accuracy ?? null };
  c.arrivedAddress = address || null;
  c.travelMin      = travelMin;

  saveJSON(CASES_FILE, cases);
  addLog(caseId, officerId, "ARRIVED", { lat, lng, accuracy, address, travelMin });

  return res.json({
    success:true, message:`บันทึก "ถึงที่เกิดเหตุ" เคส ${caseId} เรียบร้อย`,
    caseId, status:"on_scene", arrivedAt:c.arrivedAt, gps:c.arrivedGps, travelMin,
  });
});

/* ═══════════════════════════════════════════
   US-16 จบเคส + สรุปเวลา
   POST /api/cases/:id/close
   Body: { officerId, note? }
   → คืนสรุปเวลาครบทุก phase
═══════════════════════════════════════════ */
app.post("/api/cases/:caseId/close", (req, res) => {
  const { caseId } = req.params;
  const { officerId, note } = req.body;
  if (!cases[caseId]) return res.status(404).json({ success:false, message:"ไม่พบเคส" });

  const c   = cases[caseId];
  if (c.status === "closed")
    return res.status(409).json({ success:false, message:"เคสนี้ปิดไปแล้ว" });

  const now = new Date();
  c.status   = "closed";
  c.closedAt = now.toISOString();
  c.note     = note || "";

  // คำนวณเวลาแต่ละ phase
  const travelMin = c.travelMin || calcMin(c.enrouteAt, c.arrivedAt);
  const onSceneMin = calcMin(c.arrivedAt, now);
  const totalMin   = calcMin(c.enrouteAt, now);
  c.travelMin  = travelMin;
  c.onSceneMin = onSceneMin;
  c.totalMin   = totalMin;
  

  if (officerId && officers[officerId]) {
    officers[officerId].status = "available";
    saveJSON(OFFICERS_FILE, officers);
  }

  saveJSON(CASES_FILE, cases);
  addLog(caseId, officerId, "CLOSED", { note, travelMin, onSceneMin, totalMin });

  return res.json({
    success: true,
    message: `✅ ปิดเคส ${caseId} เรียบร้อย`,
    caseId,
    summary: {
      createdAt:   c.createdAt,
      enrouteAt:   c.enrouteAt,
      arrivedAt:   c.arrivedAt,
      closedAt:    c.closedAt,
      travelMin,       // เวลาเดินทาง (enroute → arrived)
      onSceneMin,      // เวลาในพื้นที่ (arrived → closed)
      totalMin,        // เวลารวม (enroute → closed)
      note,
    },
  });
});
/* ═══════════════════════════════════════════
timestamp ลวกๆ
═══════════════════════════════════════════ */
app.put("/api/cases/:caseId", (req, res) => {
  const { caseId } = req.params;
  const { detail } = req.body;

  if (!cases[caseId]) {
    return res.status(404).json({ success: false });
  }

  const c = cases[caseId];

  // 🔥 อัปเดตข้อมูล
  c.detail = detail || c.detail;

  // 🔥 สำคัญที่สุด
  c.updatedAt = new Date().toISOString();

  saveJSON(CASES_FILE, cases);

  res.json({ success: true, data: c });
});
/* ─────────────────────────────────────────
   POST /api/cases – รับเคสใหม่ (จากหน้าจอ)
   Body: { type, priority, location, reporterName, reporterPhone,
           injuredCount, assignedOfficer, note, incidentGps, photoBase64 }
────────────────────────────────────────── */
app.post("/api/cases", (req, res) => {
  const { type, priority, location, reporterName, reporterPhone,
          injuredCount, assignedOfficer, note, incidentGps, photoBase64 } = req.body;

  if (!type)     return res.status(400).json({ success:false, message:"กรุณาระบุประเภทเหตุการณ์" });
  if (!location) return res.status(400).json({ success:false, message:"กรุณาระบุสถานที่เกิดเหตุ" });

  // สร้าง ID ใหม่
  const existingIds = Object.keys(cases).filter(k => k.startsWith("PTT-")).map(k => parseInt(k.replace("PTT-",""))).filter(n => !isNaN(n));
  const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 10001;
  const caseId  = `PTT-${nextNum}`;

  // บันทึกรูปภาพถ้ามี
  let photoUrl = null;
  if (photoBase64) {
    try {
      const ext      = photoBase64.startsWith("data:image/png") ? "png" : "jpg";
      const filename = `${caseId}_incident.${ext}`;
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(path.join(PHOTOS_DIR, filename), base64Data, "base64");
      photoUrl = `http://localhost:${PORT}/photos/${filename}`;
    } catch (e) {
      console.error("[PHOTO SAVE]", e.message);
    }
  }

  const now = new Date().toISOString();
  cases[caseId] = {
    id: caseId, type, priority: priority || "normal", location,
    status: "waiting",
    reporterName:  reporterName  || null,
    reporterPhone: reporterPhone || null,
    injuredCount:  injuredCount  || 0,
    assignedOfficer: assignedOfficer || null,
    note: note || "",
    incidentGps:     incidentGps  || null,
    incidentAddress: null,
    incidentPhoto:   photoUrl,
    createdAt: now,
    enrouteAt: null, enrouteGps: null, enrouteAddress: null,
    arrivedAt: null, arrivedGps: null, arrivedAddress: null,
    closedAt:  null, travelMin:  null, onSceneMin: null, totalMin: null,
  };

  saveJSON(CASES_FILE, cases);
  addLog(caseId, assignedOfficer || null, "CASE_CREATED", { type, priority, location, reporterName, injuredCount, hasPhoto: !!photoUrl });
  console.log(`[NEW CASE] ${caseId} · ${type} · ${location}`);

  return res.status(201).json({
    success: true,
    message: `รับเคส ${caseId} เรียบร้อย`,
    caseId,
    data: cases[caseId],
  });
});

/* ─────────────────────────────────────────
   GET /api/cases  |  GET /api/cases/:id
────────────────────────────────────────── */
app.get("/api/cases",          (_req,res) => res.json({ success:true, data:Object.values(cases) }));
app.get("/api/cases/:caseId",  (req,res)  => {
  const c = cases[req.params.caseId];
  if (!c) return res.status(404).json({ success:false, message:"ไม่พบเคส" });
  res.json({ success:true, data:c });
});

/* ─────────────────────────────────────────
   GET /api/activity
────────────────────────────────────────── */
app.get("/api/activity", (req,res) => {
  const limit = parseInt(req.query.limit)||50;
  res.json({ success:true, data:activityLog.slice(0,limit) });
});

/* ═══════════════════════════════════════════
   REPORT APIs
═══════════════════════════════════════════ */
app.get("/api/reports/summary", (_req,res) => {
  const all = Object.values(cases);
  const byStatus={}, byType={}, byPriority=[], times=[];
  all.forEach(c => {
    byStatus[c.status]   = (byStatus[c.status]||0)+1;
    byType[c.type]       = (byType[c.type]||0)+1;
    byPriority[c.priority] = (byPriority[c.priority]||0)+1;
    if (c.travelMin!=null) times.push(c.travelMin);
  });
  const closed = all.filter(c=>c.status==="closed").length;
  res.json({ success:true, report:{
    generatedAt:new Date().toISOString(),
    total:all.length, byStatus, byType, byPriority,
    avgTravelMin: times.length ? Math.round(times.reduce((a,b)=>a+b,0)/times.length) : null,
    closedCases: closed,
    successRate: all.length ? ((closed/all.length)*100).toFixed(1)+"%" : "0%",
  }});
});

app.get("/api/reports/daily", (req,res) => {
  const date = req.query.date || new Date().toISOString().slice(0,10);
  const day  = Object.values(cases).filter(c=>(c.createdAt||"").startsWith(date));
  const times = day.filter(c=>c.travelMin!=null).map(c=>c.travelMin);
  res.json({ success:true, report:{
    date, generatedAt:new Date().toISOString(),
    totalCases:day.length,
    closedCases:day.filter(c=>c.status==="closed").length,
    onSceneCases:day.filter(c=>c.status==="on_scene").length,
    enrouteCases:day.filter(c=>c.status==="enroute").length,
    waitingCases:day.filter(c=>c.status==="waiting").length,
    avgTravelMin: times.length ? Math.round(times.reduce((a,b)=>a+b,0)/times.length) : null,
    cases: day,
  }});
});

app.get("/api/reports/officer/:officerId", (req,res) => {
  const o = officers[req.params.officerId];
  if (!o) return res.status(404).json({ success:false, message:"ไม่พบพนักงาน" });
  const my = Object.values(cases).filter(c=>c.assignedOfficer===req.params.officerId);
  const times = my.filter(c=>c.travelMin!=null).map(c=>c.travelMin);
  res.json({ success:true, report:{
    generatedAt:new Date().toISOString(), officer:o,
    totalCases:my.length, closedCases:my.filter(c=>c.status==="closed").length,
    avgTravelMin: times.length ? Math.round(times.reduce((a,b)=>a+b,0)/times.length) : null,
    cases: my,
    recentActivity: activityLog.filter(a=>a.officerId===req.params.officerId).slice(0,20),
  }});
});

app.get("/api/reports/gps", (_req,res) => {
  const pts = [];
  Object.values(cases).forEach(c => {
    if (c.incidentGps?.lat) pts.push({ caseId:c.id, type:"incident", ...c.incidentGps, address:c.incidentAddress, photo:c.incidentPhoto });
    if (c.enrouteGps?.lat)  pts.push({ caseId:c.id, type:"enroute",  ...c.enrouteGps,  address:c.enrouteAddress,  timestamp:c.enrouteAt });
    if (c.arrivedGps?.lat)  pts.push({ caseId:c.id, type:"arrived",  ...c.arrivedGps,  address:c.arrivedAddress,  timestamp:c.arrivedAt, travelMin:c.travelMin });
  });
  res.json({ success:true, total:pts.length, data:pts });
});

/* ─────────────────────────────────────────
   START
────────────────────────────────────────── */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚑  ป่อเต็กตึ๊ง API Server พร้อมใช้งาน`);
  console.log(`   http://localhost:${PORT}\n`);
  console.log("── Use Cases ───────────────────────────────");
  console.log("  PATCH  /api/officers/:id/status       → US-01");
  console.log("  GET    /api/cases/:id/incident        → US-11 โหลดพิกัด/ภาพจุดเกิดเหตุ");
  console.log("  POST   /api/cases/:id/incident        → US-11 อัปเดตพิกัด/ภาพ");
  console.log("  POST   /api/cases/:id/enroute         → US-08");
  console.log("  POST   /api/cases/:id/arrived         → US-09");
  console.log("  POST   /api/cases/:id/close           → US-16 จบเคส + สรุปเวลา");
  console.log("── Reports ─────────────────────────────────");
  console.log("  GET    /api/reports/summary");
  console.log("  GET    /api/reports/daily?date=");
  console.log("  GET    /api/reports/officer/:id");
  console.log("  GET    /api/reports/gps");
  console.log(`\n📁 Data: ${DATA_DIR}\n`);
});
/* ═══════════════════════════════════════
   US-07: CREATE + DOWNLOAD PDF (Puppeteer)
═══════════════════════════════════════ */
app.post("/api/report/pdf", upload.none(), async (req, res) => {

  let browser;

  try {
    console.log("📥 RAW BODY:", req.body);

    if (!req.body) {
      throw new Error("Body is empty");
    }

    let data;

    if (typeof req.body.data === "string") {
      data = JSON.parse(req.body.data);
    } else {
      data = req.body;
    }

    console.log("📦 PARSED DATA:", data);

    // 🔥 กัน space + ตัวแปลก
    const safeCaseId = String(data.caseId || "unknown")
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9-_]/g, '');

    console.log("🆔 CASE ID:", safeCaseId);

    // 🔥 เปิด browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // 🔥 👉 วางตรงนี้เลย (แปลงรูป)
    let imageBase64 = null;

    // 🔥 FIX: รองรับทั้ง string และ array
    let imageUrl = null;

    if (Array.isArray(data.images)) {
      imageUrl = data.images[0];
    } else if (typeof data.images === "string") {
      imageUrl = data.images;
    } else {
      imageUrl = data.imageUrl || data.incidentPhoto;
    }

    console.log("👉 imageUrl:", imageUrl);

    if (imageUrl) {
      try {
        console.log("👉 โหลดรูป:", imageUrl);

        const res = await axios.get(imageUrl, {
          responseType: "arraybuffer"
        });

        const base64 = Buffer.from(res.data).toString("base64");
        imageBase64 = `data:image/jpeg;base64,${base64}`;

        console.log("✅ โหลดรูปสำเร็จ");

      } catch (err) {
        console.error("❌ โหลดรูปไม่ได้:", err.message);
      }
    }

    // 🔥 แล้วค่อย newPage
    const page = await browser.newPage();

    // 🔥 HTML (UPDATED)
    const html = `
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: "TH Sarabun New", Arial; padding:40px; }
        .header { text-align:center; }
        table { width:100%; border-collapse:collapse; margin-top:10px; }
        td { border:1px solid #000; padding:8px; }
        .label { background:#eee; font-weight:bold; width:25%; }
        .images img {
          width: 250px;
          margin-top: 10px;
          border: 1px solid #ccc;
        }
      </style>
    </head>

    <body>

      <div class="header">
        <h2>มูลนิธิป่อเต็กตึ๊ง</h2>
        <h3>รายงานการปฏิบัติงานกู้ภัย</h3>
      </div>

      <!-- ข้อมูลหลัก -->
      <table>
        <tr>
          <td class="label">เลขที่เคส</td>
          <td>${data.caseId || "-"}</td>
          <td class="label">วันที่</td>
          <td>${new Date().toLocaleDateString("th-TH")}</td>
        </tr>
        <tr>
          <td class="label">เวลา</td>
          <td colspan="3">${data.timestamp || "-"}</td>
        </tr>
      </table>

      <!-- สถานที่ + เจ้าหน้าที่ -->
      <table>
        <tr>
          <td class="label">สถานที่</td>
          <td colspan="3">${data.location || "-"}</td>
        </tr>
        <tr>
          <td class="label">เจ้าหน้าที่</td>
          <td>${data.officer || "-"}</td>
          <td class="label">สถานะ</td>
          <td>เสร็จสิ้น</td>
        </tr>
      </table>

      <!-- พิกัด -->
      <table>
        <tr>
          <td class="label">พิกัด (GPS)</td>
          <td colspan="3">
            ${
              data.lat && data.lng
                ? `${data.lat}, ${data.lng}`
                : "-"
            }
          </td>
        </tr>
      </table>

      <!-- รายละเอียด -->
      <table>
        <tr>
          <td class="label">รายละเอียด</td>
        </tr>
        <tr>
          <td style="height:120px;">
            ${
              data.detail && data.detail.trim() !== ""
                ? data.detail
                : "-"
            }
          </td>
        </tr>
      </table>

      <br><br>

      <!-- รูป -->
      <b>ภาพประกอบ:</b><br/>
      <div class="images">
        ${
          imageBase64
            ? `<img src="${imageBase64}" />`
            : "ไม่มีรูปภาพ"
        }
      </div>

      <br><br>

      <!-- ลายเซ็น -->
      ลงชื่อ ___________________________<br/>
      (${data.officer || "-"})

    </body>
    </html>
`;

await page.setContent(html, { waitUntil: "networkidle0" });

    // 🔥 สร้าง PDF เป็น buffer (สำคัญมาก)
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true
    });

    console.log("✅ PDF CREATED (BUFFER)");

    // 🔥 header สำหรับ download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=report-${safeCaseId}.pdf`
    );

    // 🔥 ส่งไฟล์
    res.send(pdfBuffer);

  } catch (err) {
    console.error("❌ PDF ERROR:", err);

    res.status(500).send(`
      <h2>PDF ERROR</h2>
      <pre>${err.message}</pre>
    `);

  } finally {
    if (browser) {
      await browser.close();
    }
  }
});