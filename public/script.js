/* ═══════════════════════════════════════════
   FoodSaver — script.js  FIXED v4
   Fixes: username display, unit detection,
          add-to-inventory, notifications
═══════════════════════════════════════════ */

let allFoods = [];
const VAPID_PUB = 'BGTcrjAv51EEZaAxbWw-jUwifaMUvpqJcUsZCupX78djBYnc53z4OOBw6oEa-yH_TWHhUr4IQwSYDeBR7uNoQYE';

/* ══════════════════════════════
   FIX 1 — AUTH + USERNAME DISPLAY
   checkAuth now reliably sets the
   navUser span on every page
══════════════════════════════ */
async function checkAuth() {
  try {
    const res  = await fetch('/me');
    const data = await res.json();
    if (!data.loggedIn) { location.href = 'login.html'; return; }

    // ✅ FIX: set username in navbar
    const navEl = document.getElementById('navUser');
    if (navEl) navEl.textContent = '👤 ' + data.username;

    // ✅ FIX: set greeting on dashboard
    const greetEl = document.getElementById('greetMsg');
    if (greetEl) {
      const h = new Date().getHours();
      const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      greetEl.textContent = g + ', ' + data.username + ' 👋';
    }

    // Auto-init notifications silently
    initAutoNotifications();

  } catch (e) {
    console.error('checkAuth failed:', e);
    location.href = 'login.html';
  }
}

async function doLogout() {
  await fetch('/logout', { method: 'POST' });
  location.href = 'login.html';
}

/* ══════════════════════════════
   FIX 2 — UNIT & ICON DETECTION
   Using word-boundary checks so
   "Bread" matches /bread/ correctly
══════════════════════════════ */
function detectUnit(name) {
  if (!name || !name.trim()) return 'units';
  const n = name.toLowerCase().trim();

  if (/\b(rice|wheat|flour|sugar|atta|maida|besan|suji|sooji)\b/.test(n)) return 'kg';
  if (/\b(dal|daal|lentil|chana|rajma|moong|masoor|toor|urad)\b/.test(n)) return 'kg';
  if (/\b(onion|potato|tomato|garlic|ginger|carrot|beans|peas)\b/.test(n)) return 'kg';
  if (/\b(milk|juice|oil|water|ghee|lassi|buttermilk|coconut water)\b/.test(n)) return 'litre';
  if (/\b(chips|biscuit|biscuits|snack|maggi|noodles|poha|upma|cereal|namkeen)\b/.test(n)) return 'packet';
  if (/\b(bread|roti|chapati|naan|pav|paratha|dosa|idli|tortilla)\b/.test(n)) return 'pieces';
  if (/\b(egg|eggs)\b/.test(n)) return 'pieces';
  if (/\b(apple|apples|banana|bananas|orange|oranges|mango|mangoes|grape|grapes|pear|peach|strawberry|kiwi)\b/.test(n)) return 'pieces';
  if (/\b(butter|cheese|paneer|curd|yogurt|cream)\b/.test(n)) return 'g';
  if (/\b(chicken|mutton|fish|meat|prawn|prawns|salmon|tuna)\b/.test(n)) return 'g';
  if (/\b(salt|pepper|turmeric|cumin|coriander|masala|spice)\b/.test(n)) return 'g';
  return 'units';
}

function foodIcon(name) {
  if (!name || !name.trim()) return '🛒';
  const n = name.toLowerCase().trim();

  if (/rice|atta|maida|wheat|flour/.test(n)) return '🍚';
  if (/milk/.test(n))                        return '🥛';
  if (/bread|roti|chapati|naan|pav|paratha/.test(n)) return '🍞';
  if (/apple/.test(n))                       return '🍎';
  if (/banana/.test(n))                      return '🍌';
  if (/mango/.test(n))                       return '🥭';
  if (/orange/.test(n))                      return '🍊';
  if (/egg/.test(n))                         return '🥚';
  if (/chip|snack|biscuit|namkeen/.test(n))  return '🍟';
  if (/oil|ghee/.test(n))                    return '🫙';
  if (/onion/.test(n))                       return '🧅';
  if (/tomato/.test(n))                      return '🍅';
  if (/potato/.test(n))                      return '🥔';
  if (/carrot/.test(n))                      return '🥕';
  if (/water/.test(n))                       return '💧';
  if (/juice/.test(n))                       return '🧃';
  if (/cheese|paneer/.test(n))               return '🧀';
  if (/butter/.test(n))                      return '🧈';
  if (/dal|daal|lentil|chana|rajma|moong/.test(n)) return '🫘';
  if (/chicken|mutton|meat/.test(n))         return '🍗';
  if (/fish|prawn|salmon|tuna/.test(n))      return '🐟';
  if (/sugar/.test(n))                       return '🍬';
  if (/garlic/.test(n))                      return '🧄';
  if (/curd|yogurt|lassi/.test(n))           return '🥛';
  if (/grape/.test(n))                       return '🍇';
  if (/strawberry/.test(n))                  return '🍓';
  if (/kiwi/.test(n))                        return '🥝';
  if (/corn/.test(n))                        return '🌽';
  if (/broccoli/.test(n))                    return '🥦';
  if (/spinach|palak/.test(n))               return '🥬';
  if (/maggi|noodle/.test(n))               return '🍜';
  if (/salt|pepper|masala|spice/.test(n))   return '🧂';
  return '🛒';
}

/* ══════════════════════════════
   LOAD & RENDER FOODS (Inventory)
══════════════════════════════ */
async function loadFoods() {
  const list = document.getElementById('foodList');
  if (!list) return;

  list.innerHTML = `<div class="loader-box"><div class="spinner"></div><span>Loading inventory...</span></div>`;

  try {
    const res = await fetch('/foods');
    if (res.status === 401) { location.href = 'login.html'; return; }
    allFoods = await res.json();
    applyFilters();
    renderAlertBanners(allFoods);

    // Bell dot
    const bell = document.getElementById('bellDot');
    if (bell) {
      const urgent = allFoods.some(f => {
        const d = (new Date(f.expiryDate) - Date.now()) / 86400000;
        return d <= 5 && d >= 0;
      });
      if (urgent) bell.classList.add('show');
    }
  } catch (e) {
    list.innerHTML = `<div style="padding:20px;background:#fee2e2;border-radius:12px;color:#991b1b">⚠️ Could not load foods. Is the server running?</div>`;
  }
}

function applyFilters() {
  const q   = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const typ = document.getElementById('typeFilter')?.value   || 'all';
  const exp = document.getElementById('expiryFilter')?.value || 'all';
  const now = Date.now();

  const filtered = allFoods.filter(f => {
    if (!f.name.toLowerCase().includes(q)) return false;
    if (typ !== 'all' && f.type !== typ)   return false;
    const d = (new Date(f.expiryDate) - now) / 86400000;
    if (exp === 'expiring' && !(d <= 5 && d >= 0)) return false;
    if (exp === 'fresh'    && d <= 5)               return false;
    if (exp === 'expired'  && d >= 0)               return false;
    return true;
  });

  renderFoods(filtered);
}

function renderFoods(foods) {
  const wrap = document.getElementById('foodList');
  const chip = document.getElementById('countChip');
  if (!wrap) return;
  if (chip) chip.textContent = foods.length + (foods.length === 1 ? ' item' : ' items');

  if (!foods.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <span class="e-icon">🛒</span>
        <h5>No items found</h5>
        <p>Try adjusting your filters or <a href="addFood.html" style="color:var(--green-700)">add some groceries</a>.</p>
      </div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'food-grid';

  foods.forEach((food, i) => {
    const icon  = foodIcon(food.name);
    const now   = Date.now();
    const expD  = new Date(food.expiryDate);
    const purD  = new Date(food.purchaseDate);
    const total = Math.max(1, (expD - purD) / 86400000);
    const diff  = (expD - now) / 86400000;

    let barCls, tagCls, daysText;
    if (diff < 0)       { barCls = 'bar-expired'; tagCls = 'dt-expired'; daysText = `Expired ${Math.abs(Math.ceil(diff))}d ago`; }
    else if (diff <= 2) { barCls = 'bar-danger';  tagCls = 'dt-danger';  daysText = diff < 1 ? 'Expires today!' : `${Math.ceil(diff)}d left`; }
    else if (diff <= 5) { barCls = 'bar-warn';    tagCls = 'dt-warn';    daysText = `${Math.ceil(diff)}d left`; }
    else                { barCls = 'bar-safe';    tagCls = 'dt-safe';    daysText = `${Math.ceil(diff)}d left`; }

    const pct    = Math.max(0, Math.min(100, (diff / total) * 100));
    const expFmt = expD.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const card = document.createElement('div');
    card.className = 'food-card';
    card.style.animationDelay = (i * 0.045) + 's';
    card.innerHTML = `
      <div class="fc-top">
        <div class="fc-emoji">${icon}</div>
        <div class="fc-meta">
          <p class="fc-name">${food.name}</p>
          <p class="fc-qty">${food.quantity} ${food.unit}</p>
        </div>
        <span class="fc-type-badge ${food.type === 'weekly' ? 'type-w' : 'type-m'}">${food.type}</span>
      </div>
      <div class="fc-body">
        <div class="fc-exp-row">
          <span class="fc-date-text">📅 ${expFmt}</span>
          <span class="days-tag ${tagCls}">${daysText}</span>
        </div>
        <div class="fc-bar">
          <div class="fc-bar-fill ${barCls}" style="width:${pct}%"></div>
        </div>
        <button class="btn-danger-fs" style="width:100%;justify-content:center" onclick="removeFood('${food._id}')">
          🗑️ Remove
        </button>
      </div>`;
    grid.appendChild(card);
  });

  wrap.innerHTML = '';
  wrap.appendChild(grid);
}

async function removeFood(id) {
  if (!confirm('Remove this item from inventory?')) return;
  const res = await fetch('/foods/' + id, { method: 'DELETE' });
  const data = await res.json();
  if (data.success) {
    showToast('Item removed', 'success');
    loadFoods();
  } else {
    showToast('Failed to remove item', 'err');
  }
}

/* ══════════════════════════════
   ALERT BANNERS
══════════════════════════════ */
function renderAlertBanners(foods) {
  const area = document.getElementById('alertArea');
  if (!area) return;
  const now    = Date.now();
  const soon   = foods.filter(f => { const d = (new Date(f.expiryDate) - now) / 86400000; return d <= 2 && d >= 0; });
  const expd   = foods.filter(f => new Date(f.expiryDate) < now);
  let html = '';
  if (soon.length)
    html += `<div class="alert-strip strip-orange"><span>⚠️</span><span><strong>${soon.length} item${soon.length > 1 ? 's' : ''}</strong> expiring within 2 days: <strong>${soon.map(f => f.name).join(', ')}</strong></span></div>`;
  if (expd.length)
    html += `<div class="alert-strip strip-red"><span>🗑️</span><span><strong>${expd.length} item${expd.length > 1 ? 's have' : ' has'} expired</strong>: ${expd.map(f => f.name).join(', ')}</span></div>`;
  area.innerHTML = html;
}

/* ══════════════════════════════
   COUNTER ANIMATION (Dashboard)
══════════════════════════════ */
function animCount(id, end, duration) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!end || end === 0) { el.textContent = '0'; return; }
  let cur = 0;
  const step = Math.max(16, Math.floor(duration / end));
  const t = setInterval(() => {
    cur++;
    el.textContent = cur;
    if (cur >= end) clearInterval(t);
  }, step);
}

/* ══════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════ */
function showToast(msg, type) {
  type = type || 'success';
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const icons = { success: '✅', err: '❌', warn: '⚠️', info: '💡' };
  const cls   = type === 'success' ? '' : 't-' + type;
  const el    = document.createElement('div');
  el.className = 'toast-item ' + cls;
  el.innerHTML = '<span>' + (icons[type] || 'ℹ️') + '</span><span>' + msg + '</span>';
  stack.appendChild(el);
  setTimeout(function() { el.remove(); }, 4000);
}

/* ══════════════════════════════════════════════
   FIX 3 — PUSH NOTIFICATIONS
   Fully rewritten. Works on localhost in Chrome.
   No VAPID needed for local Notification API.
══════════════════════════════════════════════ */

function urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// ── Called automatically from checkAuth on every page ──
async function initAutoNotifications() {
  if (!('Notification' in window)) return;

  // Register service worker silently
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (e) { /* non-critical */ }
  }

  const perm = Notification.permission;

  if (perm === 'granted') {
    startExpiryChecker();
    updatePushCard('on');
  } else if (perm === 'default') {
    // Show gentle banner after a 2s delay (not intrusive)
    setTimeout(showPermissionBanner, 2000);
    updatePushCard('off');
  } else {
    updatePushCard('blocked');
  }
}

// ── Gentle bottom banner asking for permission ──
function showPermissionBanner() {
  if (document.getElementById('notif-banner')) return;
  if (sessionStorage.getItem('notif-dismissed')) return;

  const banner = document.createElement('div');
  banner.id = 'notif-banner';
  banner.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
    'background:#fff', 'border:1.5px solid #d1fae5', 'border-radius:16px',
    'box-shadow:0 8px 32px rgba(21,128,61,.18)', 'padding:16px 20px',
    'display:flex', 'align-items:center', 'gap:14px',
    'z-index:9999', 'max-width:500px', 'width:calc(100% - 32px)',
    'animation:notif-up .4s cubic-bezier(.34,1.56,.64,1)'
  ].join(';');

  banner.innerHTML = `
    <style>@keyframes notif-up{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}</style>
    <div style="font-size:2rem;flex-shrink:0">🔔</div>
    <div style="flex:1">
      <div style="font-weight:700;font-size:.92rem;color:#0f2d1a;margin-bottom:3px">Enable Expiry Alerts?</div>
      <div style="font-size:.78rem;color:#64748b;line-height:1.5">Get notified automatically when food is about to expire — even with the browser minimised.</div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap">
      <button id="bannerAllow" style="background:linear-gradient(135deg,#15803d,#22c55e);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:.84rem;font-weight:600;cursor:pointer;font-family:inherit">✅ Allow</button>
      <button id="bannerDismiss" style="background:#f1f5f9;color:#64748b;border:none;border-radius:8px;padding:9px 14px;font-size:.84rem;cursor:pointer;font-family:inherit">Not now</button>
    </div>`;

  document.body.appendChild(banner);

  document.getElementById('bannerAllow').onclick   = handleAllowNotifications;
  document.getElementById('bannerDismiss').onclick = handleDismissBanner;
}

function handleDismissBanner() {
  const b = document.getElementById('notif-banner');
  if (b) b.remove();
  sessionStorage.setItem('notif-dismissed', '1');
}

async function handleAllowNotifications() {
  handleDismissBanner();
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    startExpiryChecker();
    updatePushCard('on');
    showToast('🔔 Notifications enabled! Checking inventory…', 'info');
    setTimeout(function() { checkAndNotify(true); }, 1000);
  } else {
    updatePushCard('blocked');
    showToast('Notifications blocked. Click 🔒 in address bar → Allow', 'warn');
  }
}

// ── Dashboard Enable button ──
async function enablePush() {
  const btn   = document.getElementById('enablePushBtn');
  const badge = document.getElementById('pushBadge');
  if (!btn) return;

  if (!('Notification' in window)) {
    showToast('Notifications not supported in this browser', 'err');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Requesting…';

  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    // Register SW
    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('/sw.js'); } catch(e) {}
    }
    startExpiryChecker();
    updatePushCard('on');
    showToast('🔔 Notifications enabled! Checking inventory now…', 'info');
    setTimeout(function() { checkAndNotify(true); }, 800);
  } else if (perm === 'denied') {
    updatePushCard('blocked');
    btn.disabled = false;
    btn.textContent = '🔔 Enable Notifications';
    showToast('Blocked! Click the 🔒 icon in the address bar → Notifications → Allow', 'warn');
  }
}

// ── Update the push card UI on dashboard ──
function updatePushCard(state) {
  const badge   = document.getElementById('pushBadge');
  const btn     = document.getElementById('enablePushBtn');
  const testBtn = document.getElementById('testPushBtn');
  if (!badge) return;

  if (state === 'on') {
    badge.textContent = '🟢 Active — checks every 30 minutes automatically';
    badge.className   = 'push-badge pb-on';
    if (btn)     { btn.textContent = '✅ Enabled'; btn.disabled = true; }
    if (testBtn) { testBtn.style.display = 'flex'; }
  } else if (state === 'blocked') {
    badge.textContent = '🚫 Blocked — click 🔒 in address bar → Allow';
    badge.className   = 'push-badge pb-blocked';
    if (btn) { btn.disabled = true; btn.textContent = '🚫 Blocked'; }
  } else {
    badge.textContent = '🔴 Off — click Enable to get automatic alerts';
    badge.className   = 'push-badge pb-off';
  }
}

// ── Background expiry checker (every 30 min) ──
let _checkerStarted = false;
function startExpiryChecker() {
  if (_checkerStarted) return;
  _checkerStarted = true;
  checkAndNotify(false);
  setInterval(function() { checkAndNotify(false); }, 30 * 60 * 1000);
  console.log('⏰ Auto expiry checker running every 30 min');
}

async function checkAndNotify(force) {
  if (Notification.permission !== 'granted') return;
  try {
    const res   = await fetch('/foods');
    if (!res.ok) return;
    const foods = await res.json();
    const now   = Date.now();

    const expiring = foods.filter(function(f) {
      const d = (new Date(f.expiryDate) - now) / 86400000;
      return d <= 2 && d >= 0;
    });
    const expired = foods.filter(function(f) {
      return new Date(f.expiryDate) < now;
    });

    // Only notify once per day unless forced
    const today = new Date().toDateString();
    const key   = 'notified-' + today;
    if (!force && sessionStorage.getItem(key)) return;

    if (expiring.length > 0) {
      const names = expiring.slice(0, 3).map(function(f) { return f.name; }).join(', ')
                  + (expiring.length > 3 ? ' +' + (expiring.length - 3) + ' more' : '');
      sendNotification(
        '⚠️ ' + expiring.length + ' item' + (expiring.length > 1 ? 's' : '') + ' expiring soon!',
        'Use these within 2 days: ' + names,
        '/inventory.html?f=expiring'
      );
      sessionStorage.setItem(key, '1');
    } else if (expired.length > 0 && force) {
      const names = expired.slice(0, 3).map(function(f) { return f.name; }).join(', ');
      sendNotification(
        '🗑️ ' + expired.length + ' item' + (expired.length > 1 ? 's have' : ' has') + ' expired',
        'Please remove: ' + names,
        '/inventory.html?f=expired'
      );
    } else if (force) {
      sendNotification('✅ All food is fresh!', 'Nothing expiring within 2 days. Great job!', '/inventory.html');
    }
  } catch (e) { /* silent */ }
}

function sendNotification(title, body, url) {
  // Use Service Worker showNotification (works even when tab is hidden)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(function(reg) {
      reg.showNotification(title, {
        body: body,
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        tag: 'foodsaver-expiry',
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: url },
        actions: [
          { action: 'view',    title: '👀 View Inventory' },
          { action: 'dismiss', title: '✕ Dismiss' }
        ]
      });
    }).catch(function() {
      // Fallback to basic Notification
      new Notification(title, { body: body });
    });
  } else {
    // Basic fallback
    try { new Notification(title, { body: body }); } catch(e) {}
  }
}

// ── Test button on dashboard ──
async function testPush() {
  if (Notification.permission !== 'granted') {
    showToast('Please enable notifications first', 'warn');
    return;
  }
  await checkAndNotify(true);
  showToast('🧪 Notification triggered! Check your notifications tray.', 'info');
}
