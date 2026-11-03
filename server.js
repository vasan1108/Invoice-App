// Serves the invoice app on 127.0.0.1 and saves its data in MongoDB.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(DIR, '.env');
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB || 'gst_invoice';
const PORT = Number(process.env.PORT) || 8081;
const HOST = '127.0.0.1';
const MAX_BODY = 20 * 1024 * 1024;

// Only these files are served, so .env, node_modules and anything else in the folder stay private.
const FILES = {
  '/invoice-app.html': 'text/html; charset=utf-8',
  '/sw.js': 'text/javascript; charset=utf-8',
  '/manifest.webmanifest': 'application/manifest+json',
  '/icon-192.png': 'image/png',
  '/icon-512.png': 'image/png'
};
// Collections holding one document per invoice or profile, with the app's id as _id.
const LISTS = { invoices: { createdAt: 1 }, clients: { name: 1 }, businesses: { name: 1 } };
const SETTINGS_ID = 'settings';
// Requests must come from this app's own page, which blocks other websites and DNS rebinding.
const HOSTS = [HOST + ':' + PORT, 'localhost:' + PORT];

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000 });
const db = client.db(DB_NAME);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Send JSON.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Data is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (e) { throw new HttpError(400, 'Invalid JSON.'); }
}

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

async function readAll() {
  const out = {};
  for (const [name, sort] of Object.entries(LISTS)) {
    out[name] = await db.collection(name).find({}, { projection: { _id: 0 } }).sort(sort).collation({ locale: 'en' }).toArray();
  }
  out.settings = await db.collection('settings').findOne({ _id: SETTINGS_ID }, { projection: { _id: 0 } });
  return out;
}

// The app sends the whole list on every save; the collection is made to match it.
async function replaceList(name, items) {
  if (!Array.isArray(items) || !items.every(it => isObject(it) && typeof it.id === 'string' && it.id)) {
    throw new HttpError(400, 'Expected a list of records, each with an id.');
  }
  const col = db.collection(name);
  const ids = items.map(it => it.id);
  // Deletions go first, so a number freed by a deleted invoice can be reused in the same save.
  await col.deleteMany({ _id: { $nin: ids } });
  if (items.length) {
    await col.bulkWrite(items.map(it => ({ replaceOne: { filter: { _id: it.id }, replacement: it, upsert: true } })), { ordered: false });
  }
}

async function replaceSettings(value) {
  if (!isObject(value)) throw new HttpError(400, 'Expected a settings object.');
  await db.collection('settings').replaceOne({ _id: SETTINGS_ID }, value, { upsert: true });
}

async function handleApi(req, res, name) {
  const origin = req.headers.origin;
  if (!HOSTS.includes(req.headers.host) || (origin && !HOSTS.some(h => origin === 'http://' + h))) {
    throw new HttpError(403, 'Not allowed.');
  }
  if (req.method === 'GET' && name === 'data') return sendJson(res, 200, await readAll());
  if (req.method === 'PUT' && LISTS[name]) { await replaceList(name, await readJson(req)); return sendJson(res, 200, { ok: true }); }
  if (req.method === 'PUT' && name === 'settings') { await replaceSettings(await readJson(req)); return sendJson(res, 200, { ok: true }); }
  throw new HttpError(404, 'Not found.');
}

async function serveFile(req, res, pathname) {
  if (pathname === '/') { res.writeHead(302, { Location: '/invoice-app.html' }); return res.end(); }
  const type = FILES[pathname];
  if (!type || (req.method !== 'GET' && req.method !== 'HEAD')) { res.writeHead(404); return res.end('Not found'); }
  const body = await readFile(path.join(DIR, pathname.slice(1)));
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://' + HOST);
  try {
    if (pathname.startsWith('/api/')) await handleApi(req, res, pathname.slice(5));
    else await serveFile(req, res, pathname);
  } catch (e) {
    const status = e.status || (e.code === 11000 ? 409 : 500);
    const message = e.status ? e.message : e.code === 11000 ? 'Two invoices have the same number.' : 'Could not reach MongoDB.';
    if (!e.status) console.error(new Date().toISOString(), req.method, pathname, e.message);
    if (!res.headersSent) sendJson(res, status, { error: message });
    else res.end();
  }
});

try {
  await client.connect();
  await db.command({ ping: 1 });
} catch (e) {
  console.error('Could not connect to MongoDB: ' + e.message);
  console.error('Check that the MongoDB service is running and that MONGODB_URI in .env is correct.');
  process.exit(1);
}
try {
  await db.collection('invoices').createIndex({ number: 1 }, { unique: true });
} catch (e) {
  console.warn('Warning: could not make invoice numbers unique in MongoDB: ' + e.message);
}
server.on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? 'Port ' + PORT + ' is already in use. Close the other server first.' : e.message);
  process.exit(1);
});
server.listen(PORT, HOST, () => {
  console.log('Connected to MongoDB, database "' + DB_NAME + '".');
  console.log('Open http://' + HOST + ':' + PORT + '/invoice-app.html  (press Ctrl+C to stop)');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { server.close(); client.close().finally(() => process.exit(0)); });
}
