const STORAGE_KEY = 'denari-coupon-db-v1';
const SESSION_KEY = 'denari-session-v1';

const defaultDb = {
  admins: [
    { username: 'admin', password: 'admin123' },
    { username: 'filipd1', password: 'filipck' },
  ],
  coupons: []
};

const state = {
  db: loadDb(),
  user: loadSession(),
  stream: null,
  scanHandle: null,
};

const el = {
  loginSection: document.getElementById('login-section'),
  appSection: document.getElementById('app-section'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  sessionUser: document.getElementById('session-user'),
  logout: document.getElementById('logout'),
  adminForm: document.getElementById('admin-form'),
  newAdminUsername: document.getElementById('new-admin-username'),
  newAdminPassword: document.getElementById('new-admin-password'),
  adminMessage: document.getElementById('admin-message'),
  adminList: document.getElementById('admin-list'),
  createForm: document.getElementById('create-form'),
  customer: document.getElementById('customer'),
  denari: document.getElementById('denari'),
  createError: document.getElementById('create-error'),
  couponList: document.getElementById('coupon-list'),
  startScan: document.getElementById('start-scan'),
  scanner: document.getElementById('scanner'),
  scanResult: document.getElementById('scan-result'),
  manualScan: document.getElementById('manual-scan'),
  manualScanBtn: document.getElementById('manual-scan-btn'),
};

el.loginForm.addEventListener('submit', login);
el.logout.addEventListener('click', logout);
el.createForm.addEventListener('submit', createCoupon);
el.startScan.addEventListener('click', startScan);
el.manualScanBtn.addEventListener('click', () => findCoupon(el.manualScan.value));
el.adminForm.addEventListener('submit', createAdmin);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

render();

function loadDb() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultDb);
  try { return JSON.parse(raw); } catch { return structuredClone(defaultDb); }
}

function saveDb() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.db)); }
function loadSession() { return localStorage.getItem(SESSION_KEY); }
function saveSession(name) { localStorage.setItem(SESSION_KEY, name); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

function login(e) {
  e.preventDefault();
  const username = el.username.value.trim();
  const password = el.password.value;
  const ok = state.db.admins.find((a) => a.username === username && a.password === password);
  if (!ok) {
    el.loginError.textContent = 'Invalid username or password.';
    return;
  }
  state.user = username;
  saveSession(username);
  el.loginError.textContent = '';
  render();
}

function logout() {
  stopScan();
  state.user = null;
  clearSession();
  render();
}

function nextCode() {
  const used = new Set(state.db.coupons.map((c) => Number(c.code)));
  for (let i = 1; i <= 999999; i++) if (!used.has(i)) return String(i).padStart(6, '0');
  return null;
}

function createCoupon(e) {
  e.preventDefault();
  const customer = el.customer.value.trim();
  const denari = Number(el.denari.value);
  if (!customer || !Number.isInteger(denari) || denari <= 0) {
    el.createError.textContent = 'Please enter a valid customer and denari sum.';
    return;
  }
  if (state.db.coupons.some((c) => c.denari === denari)) {
    el.createError.textContent = 'Denari sum must be unique.';
    return;
  }
  const code = nextCode();
  if (!code) {
    el.createError.textContent = 'No more available barcode values in range.';
    return;
  }
  state.db.coupons.push({
    code,
    denari,
    customer,
    used: false,
    createdBy: state.user,
    createdAt: new Date().toISOString(),
  });
  saveDb();
  el.createError.textContent = '';
  el.createForm.reset();
  renderCoupons();
}

function createAdmin(e) {
  e.preventDefault();
  const username = el.newAdminUsername.value.trim();
  const password = el.newAdminPassword.value;
  if (!username || !password) {
    el.adminMessage.textContent = 'Username and password are required.';
    return;
  }
  if (state.db.admins.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
    el.adminMessage.textContent = 'That admin username already exists.';
    return;
  }
  state.db.admins.push({ username, password });
  saveDb();
  el.adminMessage.textContent = `Admin account ${username} created.`;
  el.adminForm.reset();
  renderAdmins();
}

function setUsed(code, used) {
  const coupon = state.db.coupons.find((c) => c.code === code);
  if (!coupon) return;
  coupon.used = used;
  saveDb();
  renderCoupons();
}

function saveCouponEdits(code, customer, denari) {
  const denariNum = Number(denari);
  if (!customer || !Number.isInteger(denariNum) || denariNum <= 0) return alert('Invalid values');
  if (state.db.coupons.some((c) => c.code !== code && c.denari === denariNum)) return alert('Denari sum already exists');
  const coupon = state.db.coupons.find((c) => c.code === code);
  coupon.customer = customer;
  coupon.denari = denariNum;
  saveDb();
  renderCoupons();
}

function render() {
  const loggedIn = !!state.user;
  el.loginSection.classList.toggle('hidden', loggedIn);
  el.appSection.classList.toggle('hidden', !loggedIn);
  if (loggedIn) {
    el.sessionUser.textContent = `Logged in as ${state.user}`;
    renderAdmins();
    renderCoupons();
  }
}

function renderAdmins() {
  el.adminList.innerHTML = '';
  for (const admin of state.db.admins) {
    const li = document.createElement('li');
    li.textContent = admin.username;
    el.adminList.append(li);
  }
}

function renderCoupons() {
  const list = [...state.db.coupons].sort((a, b) => a.code.localeCompare(b.code));
  el.couponList.innerHTML = '';
  for (const c of list) {
    const card = document.createElement('article');
    card.className = 'coupon';
    card.innerHTML = `
      <h3>Coupon #${c.code}</h3>
      <div class="meta">Created by: <strong>${c.createdBy}</strong> • Customer: <input value="${escapeHtml(c.customer)}" data-field="customer"/> • Denari: <input type="number" min="1" value="${c.denari}" data-field="denari"/> • Status: ${c.used ? '✅ Used' : '🟢 Active'}</div>
      <canvas width="330" height="110"></canvas>
      <div class="actions">
        <button data-act="save">Save edits</button>
        <button data-act="used" class="secondary">Mark as ${c.used ? 'unused' : 'used'}</button>
      </div>
    `;
    const canvas = card.querySelector('canvas');
    drawCode128C(canvas, c.code);
    card.querySelector('[data-act="used"]').addEventListener('click', () => setUsed(c.code, !c.used));
    card.querySelector('[data-act="save"]').addEventListener('click', () => {
      saveCouponEdits(
        c.code,
        card.querySelector('[data-field="customer"]').value.trim(),
        card.querySelector('[data-field="denari"]').value,
      );
    });
    el.couponList.append(card);
  }
}

async function startScan() {
  if (!('BarcodeDetector' in window)) {
    el.scanResult.textContent = 'BarcodeDetector is not supported in this browser. Use manual input.';
    return;
  }
  stopScan();
  const detector = new BarcodeDetector({ formats: ['code_128'] });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  state.stream = stream;
  el.scanner.srcObject = stream;
  el.scanner.classList.remove('hidden');

  const loop = async () => {
    if (!state.stream) return;
    const codes = await detector.detect(el.scanner);
    if (codes[0]?.rawValue) {
      findCoupon(codes[0].rawValue);
      stopScan();
      return;
    }
    state.scanHandle = requestAnimationFrame(loop);
  };
  loop();
}

function stopScan() {
  if (state.scanHandle) cancelAnimationFrame(state.scanHandle);
  if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
  state.scanHandle = null;
  state.stream = null;
  el.scanner.classList.add('hidden');
}

function findCoupon(rawCode) {
  const code = String(rawCode).replace(/\D/g, '').slice(-6).padStart(6, '0');
  const c = state.db.coupons.find((coupon) => coupon.code === code);
  el.scanResult.textContent = c
    ? `Found coupon ${c.code}: ${c.denari} denari for ${c.customer}. Created by ${c.createdBy}. Status: ${c.used ? 'USED' : 'ACTIVE'}`
    : `No coupon found for ${code}`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Code 128 subset C patterns.
const CODE128 = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'
];

function drawCode128C(canvas, sixDigit) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const codes = [105]; // Start C
  for (let i = 0; i < sixDigit.length; i += 2) codes.push(Number(sixDigit.slice(i, i + 2)));
  let checksum = 105;
  for (let i = 0; i < codes.length - 1; i++) checksum += codes[i + 1] * (i + 1);
  codes.push(checksum % 103);
  codes.push(106); // stop

  const modules = codes.map((n) => CODE128[n]).join('');
  const moduleWidth = 2;
  let x = 10;
  let black = true;
  ctx.fillStyle = '#000';
  for (const ch of modules) {
    const w = Number(ch) * moduleWidth;
    if (black) ctx.fillRect(x, 10, w, 70);
    x += w;
    black = !black;
  }
  ctx.font = '20px monospace';
  ctx.fillText(sixDigit, 95, 102);
}
