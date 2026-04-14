/* ═══════════════════════════════════════════════
   FoodSaver  app.js  v3.0
   Express backend + Push Notifications
═══════════════════════════════════════════════ */

const express  = require('express');
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const session  = require('express-session');
const User     = require('./models/User');
const Food     = require('./models/Food');

const app = express();

/* ── Try web-push ── */
let webpush = null;
try {
  webpush = require('web-push');
  webpush.setVapidDetails(
    'mailto:foodsaver@example.com',
    'BGTcrjAv51EEZaAxbWw-jUwifaMUvpqJcUsZCupX78djBYnc53z4OOBw6oEa-yH_TWHhUr4IQwSYDeBR7uNoQYE',
    'BYnc53z4OOBw6oEa-yH_TWHhUr4IQwSYDeBR7uNoQYE'
  );
  console.log('✅ web-push loaded');
} catch(e) {
  console.warn('⚠️  web-push not found. Run: npm install web-push');
}

const pushSubs = [];

mongoose.connect('mongodb://127.0.0.1:27017/foodWaste')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(e  => console.error('❌ MongoDB:', e.message));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'foodsaver-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000 }
}));

const auth = (req, res, next) =>
  req.session.userId ? next() : res.status(401).json({ error: 'Not logged in' });

/* ── AUTH ── */
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (await User.findOne({ email })) return res.json({ success:false, message:'Email already registered' });
    await User.create({ username, email, password: await bcrypt.hash(password, 10) });
    res.json({ success: true });
  } catch(e) { res.json({ success:false, message:'Registration failed' }); }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ success:false, message:'User not found' });
    if (!await bcrypt.compare(password, user.password)) return res.json({ success:false, message:'Wrong password' });
    req.session.userId   = user._id;
    req.session.username = user.username;
    res.json({ success:true, username:user.username });
  } catch(e) { res.json({ success:false, message:'Login failed' }); }
});

app.post('/logout', (req, res) => { req.session.destroy(); res.json({ success:true }); });
app.get('/me', (req, res) => req.session.userId
  ? res.json({ loggedIn:true, username:req.session.username })
  : res.json({ loggedIn:false }));

/* ── FOODS ── */
app.post('/foods', auth, async (req, res) => {
  try { await Food.create({ ...req.body, userId:req.session.userId }); res.json({ success:true }); }
  catch(e) { res.json({ success:false, message:'Failed' }); }
});
app.get('/foods', auth, async (req, res) => {
  res.json(await Food.find({ userId:req.session.userId }).sort({ expiryDate:1 }));
});
app.delete('/foods/:id', auth, async (req, res) => {
  await Food.findOneAndDelete({ _id:req.params.id, userId:req.session.userId });
  res.json({ success:true });
});
app.get('/dashboard-data', auth, async (req, res) => {
  const foods = await Food.find({ userId:req.session.userId });
  const now   = new Date();
  const d     = f => (new Date(f.expiryDate)-now)/86400000;
  res.json({
    total:        foods.length,
    expiringSoon: foods.filter(f=>d(f)<=5&&d(f)>=0).length,
    expired:      foods.filter(f=>d(f)<0).length,
    weekly:       foods.filter(f=>f.type==='weekly').length,
    monthly:      foods.filter(f=>f.type==='monthly').length
  });
});

/* ── PUSH ── */
app.post('/push/subscribe', auth, (req, res) => {
  if (!webpush) return res.status(503).json({ error:'web-push not installed' });
  const sub = req.body;
  if (!sub?.endpoint) return res.status(400).json({ error:'Invalid subscription' });
  if (!pushSubs.find(s=>s.endpoint===sub.endpoint)) pushSubs.push(sub);
  console.log(`📬 Subscriptions: ${pushSubs.length}`);
  res.status(201).json({ success:true });
});

app.post('/push/test', auth, async (req, res) => {
  if (!webpush)         return res.status(503).json({ error:'web-push not installed' });
  if (!pushSubs.length) return res.status(400).json({ error:'No subscribers' });
  const payload = JSON.stringify({
    title:'🌱 FoodSaver — Test Notification',
    body: 'Push notifications are working! You will get real expiry alerts even when the browser is closed.',
    icon: '/icon-192.png', url:'/inventory.html', tag:'test'
  });
  let sent=0; const dead=[];
  await Promise.all(pushSubs.map(async(s,i)=>{
    try { await webpush.sendNotification(s,payload); sent++; }
    catch(e){ if([410,404].includes(e.statusCode)) dead.push(i); }
  }));
  dead.reverse().forEach(i=>pushSubs.splice(i,1));
  res.json({ success:true, sent });
});

/* ── EXPIRY SCHEDULER (runs every hour) ── */
async function checkExpiryAndNotify() {
  if (!webpush||!pushSubs.length) return;
  try {
    const now    = new Date();
    const urgent = (await Food.find({})).filter(f=>{
      const d=(new Date(f.expiryDate)-now)/86400000; return d<=2&&d>=0;
    });
    if (!urgent.length) return;
    const names = urgent.slice(0,3).map(f=>f.name).join(', ')+(urgent.length>3?` +${urgent.length-3} more`:'');
    const payload = JSON.stringify({
      title:`⚠️ FoodSaver — ${urgent.length} item${urgent.length>1?'s':''} expiring soon!`,
      body: `Use these soon: ${names}`,
      icon:'/icon-192.png', url:'/inventory.html?f=expiring', tag:'foodsaver-expiry'
    });
    const dead=[];
    await Promise.all(pushSubs.map(async(s,i)=>{
      try { await webpush.sendNotification(s,payload); }
      catch(e){ if([410,404].includes(e.statusCode)) dead.push(i); }
    }));
    dead.reverse().forEach(i=>pushSubs.splice(i,1));
    console.log(`📨 Sent expiry alerts — ${urgent.length} items`);
  } catch(e) { console.error('Scheduler:',e.message); }
}

setInterval(checkExpiryAndNotify, 3600000); // every hour
setTimeout(checkExpiryAndNotify, 20000);    // 20s after start

app.listen(3000, () => {
  console.log('🚀 FoodSaver → http://localhost:3000/login.html');
});
// minor updategit add .
