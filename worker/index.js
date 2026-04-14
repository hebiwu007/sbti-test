// SBTI API Worker v2 - Full Leaderboard System
// Deploy to Cloudflare Workers with D1 binding

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Init DB
      if (path === '/api/init' && request.method === 'POST')
        return await handleInit(env, corsHeaders);

      // Submit anonymous test result
      if (path === '/api/submit' && request.method === 'POST')
        return await handleSubmit(request, env, corsHeaders);

      // Submit to leaderboard (with nickname)
      if (path === '/api/ranking/submit' && request.method === 'POST')
        return await handleRankingSubmit(request, env, corsHeaders);

      // Get leaderboard (personality popularity)
      if (path === '/api/leaderboard' && request.method === 'GET')
        return await handleLeaderboard(env, corsHeaders, url);

      // Get rankings by personality type (with match score)
      if (path === '/api/rankings' && request.method === 'GET')
        return await handleRankings(env, corsHeaders, url);

      // Get my ranking by guest code
      if (path === '/api/ranking/my' && request.method === 'GET')
        return await handleMyRanking(env, corsHeaders, url);

      // Stats
      if (path === '/api/stats' && request.method === 'GET')
        return await handleStats(env, corsHeaders);

      // Count
      if (path === '/api/count' && request.method === 'GET')
        return await handleCount(env, corsHeaders);

      // Daily quiz - submit answer
      if (path === '/api/daily/submit' && request.method === 'POST')
        return await handleDailySubmit(request, env, corsHeaders);

      // Daily quiz - get stats
      if (path === '/api/daily/stats' && request.method === 'GET')
        return await handleDailyStats(request, env, corsHeaders);

      // Delete user data by guest_code
      if (path === '/api/data' && request.method === 'DELETE')
        return await handleDataDelete(request, env, corsHeaders);

      // Auth routes
      if (path === '/api/auth/register' && request.method === 'POST')
        return await handleRegister(request, env, corsHeaders);
      if (path === '/api/auth/login' && request.method === 'POST')
        return await handleLogin(request, env, corsHeaders);
      if (path === '/api/auth/profile' && (request.method === 'POST' || request.method === 'PUT'))
        return await handleUserProfile(request, env, corsHeaders);
      if (path === '/api/auth/link-guest' && request.method === 'POST')
        return await handleLinkGuest(request, env, corsHeaders);

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// ============ Database Init ============
async function handleInit(env, h) {
  // test_results table
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personality_code TEXT NOT NULL,
    mbti_type TEXT,
    language TEXT DEFAULT 'zh',
    pattern TEXT,
    match_score REAL,
    timezone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  try { await env.DB.prepare('ALTER TABLE test_results ADD COLUMN timezone TEXT').run(); } catch(e) {}
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tr_personality ON test_results(personality_code)').run(); } catch(e) {}
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tr_created ON test_results(created_at)').run(); } catch(e) {}

  // rankings table
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS rankings (
    rank_id TEXT PRIMARY KEY,
    result_id INTEGER,
    nickname TEXT NOT NULL,
    personality_code TEXT NOT NULL,
    match_score REAL,
    mbti_type TEXT,
    signature TEXT,
    guest_code TEXT UNIQUE,
    timezone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_rk_personality ON rankings(personality_code)').run(); } catch(e) {}
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_rk_score ON rankings(match_score DESC)').run(); } catch(e) {}
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_rk_guest ON rankings(guest_code)').run(); } catch(e) {}
  try { await env.DB.prepare('ALTER TABLE rankings ADD COLUMN timezone TEXT').run(); } catch(e) {}

  // daily_quiz table
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS daily_quiz (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_code TEXT,
    quiz_date TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_dq_date ON daily_quiz(quiz_date)').run(); } catch(e) {}

  return json({ success: true, message: 'Database v2 initialized' }, h);
}

// ============ Submit anonymous result ============
async function handleSubmit(request, env, h) {
  const body = await request.json();
  const { personality_code, mbti_type, language, pattern, match_score, timezone } = body;
  if (!personality_code) return json({ error: 'personality_code required' }, h, 400);

  const r = await env.DB.prepare(
    'INSERT INTO test_results (personality_code, mbti_type, language, pattern, match_score, timezone) VALUES (?,?,?,?,?,?)'
  ).bind(personality_code, mbti_type || null, language || 'zh', pattern || null, match_score || null, timezone || null).run();

  return json({ success: true, id: r.meta.last_row_id }, h);
}

// ============ Submit to leaderboard with nickname ============
async function handleRankingSubmit(request, env, h) {
  const body = await request.json();
  const { nickname, personality_code, match_score, mbti_type, signature, timezone } = body;

  if (!nickname || !personality_code) {
    return json({ error: 'nickname and personality_code required' }, h, 400);
  }
  if (nickname.length < 1 || nickname.length > 16) {
    return json({ error: 'nickname 1-16 chars' }, h, 400);
  }

  // Generate IDs
  const rank_id = 'rk_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  const guest_code = 'SBTI-' + generateGuestCode();

  // Insert test result first
  const tr = await env.DB.prepare(
    'INSERT INTO test_results (personality_code, mbti_type, match_score) VALUES (?,?,?)'
  ).bind(personality_code, mbti_type || null, match_score || null).run();

  // Insert ranking
  await env.DB.prepare(
    'INSERT INTO rankings (rank_id, result_id, nickname, personality_code, match_score, mbti_type, signature, guest_code, timezone) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(rank_id, tr.meta.last_row_id, nickname, personality_code, match_score || null, mbti_type || null, signature || null, guest_code, timezone || null).run();

  // Get user's rank within this personality type
  const rankResult = await env.DB.prepare(
    'SELECT COUNT(*) + 1 as rank FROM rankings WHERE personality_code = ? AND match_score > ?'
  ).bind(personality_code, match_score || 0).first();

  return json({
    success: true,
    rank_id,
    guest_code,
    rank: rankResult.rank,
    personality_code,
    match_score
  }, h);
}

// ============ Get rankings by personality type ============
async function handleRankings(env, h, url) {
  const type = url.searchParams.get('type');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query, params;
  if (type) {
    query = 'SELECT rank_id, nickname, personality_code, match_score, mbti_type, signature, guest_code, created_at FROM rankings WHERE personality_code = ? ORDER BY match_score DESC, created_at ASC LIMIT ? OFFSET ?';
    params = [type, limit, offset];
  } else {
    query = 'SELECT rank_id, nickname, personality_code, match_score, mbti_type, signature, created_at FROM rankings ORDER BY match_score DESC, created_at ASC LIMIT ? OFFSET ?';
    params = [limit, offset];
  }

  const results = await env.DB.prepare(query).bind(...params).all();
  const total = await env.DB.prepare(type
    ? 'SELECT COUNT(*) as total FROM rankings WHERE personality_code = ?'
    : 'SELECT COUNT(*) as total FROM rankings'
  ).bind(...(type ? [type] : [])).first();

  return json({ rankings: results.results, total: total.total, limit, offset }, h);
}

// ============ Get my ranking by guest code ============
async function handleMyRanking(env, h, url) {
  const code = url.searchParams.get('code');
  if (!code) return json({ error: 'code required' }, h, 400);

  const myRanking = await env.DB.prepare(
    'SELECT * FROM rankings WHERE guest_code = ?'
  ).bind(code).first();

  if (!myRanking) return json({ error: 'not found' }, h, 404);

  // Get my rank within my type
  const rankResult = await env.DB.prepare(
    'SELECT COUNT(*) + 1 as rank FROM rankings WHERE personality_code = ? AND match_score > ?'
  ).bind(myRanking.personality_code, myRanking.match_score || 0).first();

  return json({ ...myRanking, rank: rankResult.rank }, h);
}

// ============ Leaderboard (personality popularity) ============
async function handleLeaderboard(env, h, url) {
  const limit = parseInt(url.searchParams.get('limit') || '27');
  const period = url.searchParams.get('period') || 'all';
  const region = url.searchParams.get('region') || '';

  // Map region to timezone prefixes
  const regionMap = {
    'asia': ['Asia/', 'Indian/', 'Pacific/Auckland', 'Pacific/Fiji'],
    'europe': ['Europe/', 'Atlantic/', 'Africa/'],
    'americas': ['America/', 'Pacific/Honolulu'],
    'oceania': ['Australia/', 'Pacific/Auckland', 'Pacific/Fiji']
  };

  let conditions = [];
  let params = [];

  // Period filter
  if (period === 'today') conditions.push("created_at >= date('now')");
  else if (period === 'week') conditions.push("created_at >= date('now', '-7 days')");
  else if (period === 'month') conditions.push("created_at >= date('now', '-30 days')");

  // Region filter (using timezone column)
  if (region && regionMap[region.toLowerCase()]) {
    const prefixes = regionMap[region.toLowerCase()];
    const tzConditions = prefixes.map(p => "timezone LIKE ?").join(' OR ');
    conditions.push(`(${tzConditions})`);
    params.push(...prefixes.map(p => `${p}%`));
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Always query test_results for personality popularity ranking
  const results = await env.DB.prepare(
    `SELECT personality_code, COUNT(*) as count FROM test_results ${whereClause} GROUP BY personality_code ORDER BY count DESC LIMIT ?`
  ).bind(...params, limit).all();
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM test_results ${whereClause}`
  ).bind(...params).first();

  return json({ leaderboard: results.results, total: total.total, period, region: region || 'global' }, h);
}

// ============ Stats ============
async function handleStats(env, h) {
  const dist = await env.DB.prepare(
    `SELECT personality_code, COUNT(*) as count,
     ROUND(COUNT(*)*100.0/(SELECT COUNT(*) FROM test_results),1) as pct
     FROM test_results GROUP BY personality_code ORDER BY count DESC`
  ).all();

  const total = await env.DB.prepare('SELECT COUNT(*) as total FROM test_results').first();
  const ranked = await env.DB.prepare('SELECT COUNT(*) as total FROM rankings').first();

  // Completion rate: count how many have mbti_type filled vs total
  const withMBTI = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM test_results WHERE mbti_type IS NOT NULL AND mbti_type != ''"
  ).first();

  // MBTI cross distribution
  const mbtiCross = await env.DB.prepare(
    `SELECT mbti_type, personality_code, COUNT(*) as count
     FROM test_results WHERE mbti_type IS NOT NULL AND mbti_type != ''
     GROUP BY mbti_type, personality_code ORDER BY mbti_type, count DESC`
  ).all();

  // Top MBTI types
  const mbtiDist = await env.DB.prepare(
    `SELECT mbti_type, COUNT(*) as count,
     ROUND(COUNT(*)*100.0/(SELECT COUNT(*) FROM test_results WHERE mbti_type IS NOT NULL AND mbti_type != ''),1) as pct
     FROM test_results WHERE mbti_type IS NOT NULL AND mbti_type != ''
     GROUP BY mbti_type ORDER BY count DESC`
  ).all();

  // Daily quiz participation
  const dailyTotal = await env.DB.prepare('SELECT COUNT(*) as total FROM daily_quiz').first();
  const dailyStreaks = await env.DB.prepare(
    'SELECT guest_code, COUNT(*) as days FROM daily_quiz GROUP BY guest_code ORDER BY days DESC LIMIT 10'
  ).all();

  return json({
    total: total.total,
    ranked: ranked.total,
    distribution: dist.results,
    completion_rate: total.total > 0 ? {
      with_mbti: withMBTI.count,
      mbti_rate: Math.round(withMBTI.count / total.total * 1000) / 10
    } : { with_mbti: 0, mbti_rate: 0 },
    mbti_distribution: mbtiDist.results,
    mbti_cross: mbtiCross.results,
    daily_quiz: { total_participations: dailyTotal.total, top_streaks: dailyStreaks.results }
  }, h);
}

// ============ Count ============
async function handleCount(env, h) {
  const total = await env.DB.prepare('SELECT COUNT(*) as total FROM test_results').first();
  const today = await env.DB.prepare("SELECT COUNT(*) as c FROM test_results WHERE created_at >= date('now')").first();
  const ranked = await env.DB.prepare('SELECT COUNT(*) as total FROM rankings').first();
  return json({ total: total.total, today: today.c, ranked: ranked.total }, h);
}

// ============ Daily Quiz ============
async function handleDailySubmit(request, env, h) {
  const body = await request.json();
  const { quiz_date, answer, guest_code } = body;
  if (!quiz_date || !answer) return json({ error: 'quiz_date and answer required' }, h, 400);

  // Check if already answered today
  const existing = await env.DB.prepare(
    'SELECT id FROM daily_quiz WHERE guest_code = ? AND quiz_date = ?'
  ).bind(guest_code || '__none__', quiz_date).first();

  if (existing) return json({ error: 'already answered', already: true }, h);

  await env.DB.prepare(
    'INSERT INTO daily_quiz (guest_code, quiz_date, answer) VALUES (?, ?, ?)'
  ).bind(guest_code || null, quiz_date, answer).run();

  // Get distribution
  const stats = await env.DB.prepare(
    'SELECT answer, COUNT(*) as count FROM daily_quiz WHERE quiz_date = ? GROUP BY answer'
  ).bind(quiz_date).all();

  return json({ success: true, stats: stats.results }, h);
}

async function handleDailyStats(request, env, h) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

  const stats = await env.DB.prepare(
    'SELECT answer, COUNT(*) as count FROM daily_quiz WHERE quiz_date = ? GROUP BY answer'
  ).bind(date).all();

  const total = await env.DB.prepare(
    'SELECT COUNT(*) as total FROM daily_quiz WHERE quiz_date = ?'
  ).bind(date).first();

  return json({ date, total: total.total, distribution: stats.results }, h);
}

// ============ Delete user data ============
async function handleDataDelete(request, env, h) {
  const body = await request.json().catch(() => null);
  const url = new URL(request.url);
  const guest_code = body?.guest_code || url.searchParams.get('guest_code');
  if (!guest_code || !guest_code.startsWith('SBTI-')) {
    return json({ error: 'Valid guest_code required (SBTI-XXXX)' }, h, 400);
  }

  let deleted = { rankings: 0, daily_quiz: 0 };

  // Delete from rankings (also deletes linked test_results via result_id)
  const ranking = await env.DB.prepare(
    'SELECT rank_id, result_id FROM rankings WHERE guest_code = ?'
  ).bind(guest_code).first();

  if (ranking) {
    // Delete test_result linked to this ranking
    if (ranking.result_id) {
      await env.DB.prepare('DELETE FROM test_results WHERE rowid = ?').bind(ranking.result_id).run();
    }
    await env.DB.prepare('DELETE FROM rankings WHERE guest_code = ?').bind(guest_code).run();
    deleted.rankings = 1;
  }

  // Delete daily quiz records
  const dr = await env.DB.prepare(
    'DELETE FROM daily_quiz WHERE guest_code = ?'
  ).bind(guest_code).run();
  deleted.daily_quiz = dr.meta.changes || 0;

  return json({ success: true, message: 'User data deleted', deleted }, h);
}

// ============ Helpers ============
function json(data, h, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...h, 'Content-Type': 'application/json' }
  });
}

function generateGuestCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ============ Auth System ============

// Register
async function handleRegister(request, env, h) {
  const body = await request.json();
  const { username, password, nickname } = body;
  if (!username || !password) return json({ error: 'username and password required' }, h, 400);
  if (username.length < 2 || username.length > 32) return json({ error: 'username 2-32 chars' }, h, 400);
  if (password.length < 4) return json({ error: 'password min 4 chars' }, h, 400);

  // Ensure users table exists
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT,
    mbti_type TEXT,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)').run(); } catch(e) {}

  // Check if username exists
  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) return json({ error: lang === 'zh' ? '用户名已存在' : 'Username already exists' }, h, 409);

  // Hash password (simple SHA-256 with salt — sufficient for this app's scale)
  const salt = crypto.randomUUID().substring(0, 8);
  const hash = await hashPassword(password, salt);
  const token = generateToken();

  await env.DB.prepare(
    'INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)'
  ).bind(username, `${salt}:${hash}`, nickname || username).run();

  const user = await env.DB.prepare('SELECT id, username, nickname, mbti_type, avatar, created_at FROM users WHERE username = ?').bind(username).first();

  return json({ success: true, token, user }, h);
}

// Login
async function handleLogin(request, env, h) {
  const body = await request.json();
  const { username, password } = body;
  if (!username || !password) return json({ error: 'username and password required' }, h, 400);

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT,
    mbti_type TEXT,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();

  const row = await env.DB.prepare('SELECT id, username, password_hash, nickname, mbti_type, avatar, created_at FROM users WHERE username = ?').bind(username).first();
  if (!row) return json({ error: 'user not found' }, h, 404);

  const [salt, storedHash] = row.password_hash.split(':');
  const hash = await hashPassword(password, salt);
  if (hash !== storedHash) return json({ error: 'wrong password' }, h, 401);

  const token = generateToken();
  const user = { id: row.id, username: row.username, nickname: row.nickname, mbti_type: row.mbti_type, avatar: row.avatar, created_at: row.created_at };

  return json({ success: true, token, user }, h);
}

// Get/Update user profile
async function handleUserProfile(request, env, h) {
  const body = await request.json();
  const { user_id, nickname, mbti_type, avatar } = body;
  if (!user_id) return json({ error: 'user_id required' }, h, 400);

  if (request.method === 'PUT') {
    await env.DB.prepare(
      'UPDATE users SET nickname = ?, mbti_type = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(nickname || null, mbti_type || null, avatar || null, user_id).run();
  }

  const user = await env.DB.prepare('SELECT id, username, nickname, mbti_type, avatar, created_at FROM users WHERE id = ?').bind(user_id).first();
  if (!user) return json({ error: 'user not found' }, h, 404);

  return json({ user }, h);
}

// Link guest code to user account
async function handleLinkGuest(request, env, h) {
  const body = await request.json();
  const { user_id, guest_code } = body;
  if (!user_id || !guest_code) return json({ error: 'user_id and guest_code required' }, h, 400);

  // Update rankings to link guest_code to user
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS user_rankings (user_id INTEGER, guest_code TEXT, linked_at DATETIME DEFAULT CURRENT_TIMESTAMP)').run();
  await env.DB.prepare('INSERT OR IGNORE INTO user_rankings (user_id, guest_code) VALUES (?, ?)').bind(user_id, guest_code).run();

  return json({ success: true }, h);
}

// Password helpers
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken() {
  return 'tk_' + crypto.randomUUID().replace(/-/g, '');
}
