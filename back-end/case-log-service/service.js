const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos', 'logs');
const DB_FILE = path.join(__dirname, 'db.json');
const PORT = 4001;

function ensureDirs(){
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if(!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  if(!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]');
}

function readDb(){
  try{ return JSON.parse(fs.readFileSync(DB_FILE)); }catch(e){ return []; }
}

function writeDb(data){
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function saveImage(base64, caseId){
  if(!base64) return null;
  const matches = base64.match(/^data:(.+);base64,(.*)$/);
  let ext = 'jpg';
  let b64 = base64;
  if(matches){ ext = matches[1].split('/').pop() || 'jpg'; b64 = matches[2]; }
  const fname = `case_${caseId}_${Date.now()}.${ext}`;
  const fpath = path.join(PHOTOS_DIR, fname);
  fs.writeFileSync(fpath, Buffer.from(b64, 'base64'));
  return path.relative(path.join(__dirname, '..'), fpath).replace(/\\/g, '/');
}

function getSimulatedGPS(){
  // simple deterministic simulated GPS — replaceable by caller-supplied gps
  return { lat: 13.736717, lng: 100.523186 };
}

function parseBody(req){
  return new Promise((res, rej)=>{
    let data='';
    req.on('data', chunk=> data+=chunk);
    req.on('end', ()=>{
      try{ res(JSON.parse(data || '{}')); }catch(e){ res({}); }
    });
    req.on('error', rej);
  });
}

ensureDirs();

const server = http.createServer(async (req, res) => {
  if(req.method === 'POST' && req.url === '/start-case'){
    const body = await parseBody(req);
    const caseId = body.caseId || `auto_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const gps = body.gps || getSimulatedGPS();
    const imageBase64 = body.imageBase64 || null;

    const db = readDb();
    const imagePath = saveImage(imageBase64, caseId);
    const entry = { id: caseId, timestamp, gps, imagePath };
    db.push(entry);
    writeDb(db);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, entry }));
    return;
  }

  if(req.method === 'GET' && req.url === '/logs'){
    const db = readDb();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(db));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, ()=> console.log(`Case Log Service running on http://localhost:${PORT}`));
