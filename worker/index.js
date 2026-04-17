// SBTI API Worker v2 - Full Leaderboard System
// Deploy to Cloudflare Workers with D1 binding

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/api/init' && request.method === 'POST')
        return await handleInit(env, corsHeaders);
      if (path === '/api/submit' && request.method === 'POST')
        return await handleSubmit(request, env, corsHeaders);
      if (path === '/api/ranking/submit' && request.method === 'POST')
        return await handleRankingSubmit(request, env, corsHeaders);
      if (path === '/api/leaderboard' && request.method === 'GET')
        return await handleLeaderboard(env, corsHeaders, url);
      if (path === '/api/rankings' && request.method === 'GET')
        return await handleRankings(env, corsHeaders, url);
      if (path === '/api/ranking/my' && request.method === 'GET')
        return await handleMyRanking(env, corsHeaders, url);
      if (path === '/api/stats' && request.method === 'GET')
        return await handleStats(env, corsHeaders);
      if (path === '/api/count' && request.method === 'GET')
        return await handleCount(env, corsHeaders);
      if (path === '/api/daily/submit' && request.method === 'POST')
        return await handleDailySubmit(request, env, corsHeaders);
      if (path === '/api/daily/stats' && request.method === 'GET')
        return await handleDailyStats(request, env, corsHeaders);
      if (path === '/api/data' && request.method === 'DELETE')
        return await handleDataDelete(request, env, corsHeaders);
      if (path === '/api/user/history' && request.method === 'GET')
        return await handleUserHistoryGet(env, corsHeaders, url);
      if (path === '/api/user/history' && request.method === 'POST')
        return await handleUserHistoryPost(request, env, corsHeaders);
      if (path === '/api/user/history' && request.method === 'DELETE')
        return await handleUserHistoryDelete(request, env, corsHeaders);
      if (path === '/api/user/daily-status' && request.method === 'GET')
        return await handleUserDailyStatus(env, corsHeaders, url);
      if (path === '/api/user/daily/submit' && request.method === 'POST')
        return await handleUserDailySubmit(request, env, corsHeaders);
      if (path === '/api/user/progress' && request.method === 'GET')
        return await handleUserProgressGet(env, corsHeaders, url);
      if (path === '/api/user/progress' && request.method === 'POST')
        return await handleUserProgressPost(request, env, corsHeaders);
      if (path === '/api/user/profile' && request.method === 'GET')
        return await handleUserProfileGet(env, corsHeaders, url);
      if (path === '/api/user/profile' && request.method === 'PUT')
        return await handleUserProfilePut(request, env, corsHeaders);
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

function json(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function generateGuestCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function handleInit(env, h) {
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
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tr_mbti ON test_results(mbti_type)').run(); } catch(e) {}

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

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS daily_quiz (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_code TEXT,
    quiz_date TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_dq_date ON daily_quiz(quiz_date)').run(); } catch(e) {}
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_dq_guest_date ON daily_quiz(guest_code, quiz_date)').run(); } catch(e) {}

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
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_users_mbti ON users(mbti_type)').run(); } catch(e) {}

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_test_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    guest_code TEXT,
    personality_code TEXT NOT NULL,
    match_score REAL,
    pattern TEXT,
    test_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_uth_guest ON user_test_history(guest_code)').run(); } catch(e) {}
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_uth_user ON user_test_history(user_id)').run(); } catch(e) {}

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_progress (
    guest_code TEXT PRIMARY KEY,
    user_id INTEGER,
    answers_json TEXT,
    current_question INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_daily_stats (
    guest_code TEXT PRIMARY KEY,
    user_id INTEGER,
    total_days INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    last_quiz_date TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_rankings (
    user_id INTEGER,
    guest_code TEXT,
    linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, guest_code)
  )`).run();

  return json({ success: true, message: 'Database v3 initialized' }, h);
}

async function handleSubmit(request, env, h) {
  const body = await request.json();
  const { personality_code, mbti_type, language, pattern, match_score, timezone } = body;
  if (!personality_code) return json({ error: 'personality_code required' }, h, 400);
  const r = await env.DB.prepare(
    'INSERT INTO test_results (personality_code, mbti_type, language, pattern, match_score, timezone) VALUES (?,?,?,?,?,?)'
  ).bind(personality_code, mbti_type || null, language || 'zh', pattern || null, match_score || null, timezone || null).run();
  return json({ success: true, id: r.meta.last_row_id }, h);
}

async function handleRankingSubmit(request, env, h) {
  const body = await request.json();
  const { nickname, personality_code, match_score, mbti_type, signature, timezone } = body;
  if (!nickname || !personality_code) {
    return json({ error: 'nickname and personality_code required' }, h, 400);
  }
  if (nickname.length < 1 || nickname.length > 16) {
    return json({ error: 'nickname 1-16 chars' }, h, 400);
  }
  const rank_id = 'rk_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  const guest_code = 'SBTI-' + generateGuestCode();
  const tr = await env.DB.prepare(
    'INSERT INTO test_results (personality_code, mbti_type, match_score) VALUES (?,?,?)'
  ).bind(personality_code, mbti_type || null, match_score || null).run();
  await env.DB.prepare(
    'INSERT INTO rankings (rank_id, result_id, nickname, personality_code, match_score, mbti_type, signature, guest_code, timezone) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(rank_id, tr.meta.last_row_id, nickname, personality_code, match_score || null, mbti_type || null, signature || null, guest_code, timezone || null).run();
  const rankResult = await env.DB.prepare(
    'SELECT COUNT(*) + 1 as rank FROM rankings WHERE personality_code = ? AND match_score > ?'
  ).bind(personality_code, match_score || 0).first();
  return json({ success: true, rank_id, guest_code, rank: rankResult.rank, personality_code, match_score }, h);
}

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
  const total = await env.DB.prepare(type ? 'SELECT COUNT(*) as total FROM rankings WHERE personality_code = ?' : 'SELECT COUNT(*) as total FROM rankings').bind(...(type ? [type] : [])).first();
  return json({ rankings: results.results, total: total.total, limit, offset }, h);
}

async function handleMyRanking(env, h, url) {
  const code = url.searchParams.get('code');
  if (!code) return json({ error: 'code required' }, h, 400);
  const myRanking = await env.DB.prepare('SELECT * FROM rankings WHERE guest_code = ?').bind(code).first();
  if (!myRanking) return json({ error: 'not found' }, h, 404);
  const rankResult = await env.DB.prepare('SELECT COUNT(*) + 1 as rank FROM rankings WHERE personality_code = ? AND match_score > ?').bind(myRanking.personality_code, myRanking.match_score || 0).first();
  return json({ ...myRanking, rank: rankResult.rank }, h);
}

async function handleLeaderboard(env, h, url) {
  const limit = parseInt(url.searchParams.get('limit') || '27');
  const period = url.searchParams.get('period') || 'all';
  const region = url.searchParams.get('region') || '';
  const regionMap = {
    'asia': ['Asia/', 'Indian/', 'Pacific/Auckland', 'Pacific/Fiji'],
    'europe': ['Europe/', 'Atlantic/', 'Africa/'],
    'americas': ['America/', 'Pacific/Honolulu'],
    'oceania': ['Australia/', 'Pacific/Auckland', 'Pacific/Fiji']
  };
  let conditions = [];
  let params = [];
  if (period === 'today') conditions.push("created_at >= date('now')");
  else if (period === 'week') conditions.push("created_at >= date('now', '-7 days')");
  else if (period === 'month') conditions.push("created_at >= date('now', '-30 days')");
  if (region && regionMap[region.toLowerCase()]) {
    const prefixes = regionMap[region.toLowerCase()];
    const tzList = prefixes.map(() => '?').join(',');
    conditions.push(`timezone IN (${tzList})`);
    params.push(...prefixes);
  }
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const results = await env.DB.prepare(`SELECT personality_code, COUNT(*) as count FROM test_results ${whereClause} GROUP BY personality_code ORDER BY count DESC LIMIT ?`).bind(...params, limit).all();
  const total = await env.DB.prepare(`SELECT COUNT(*) as total FROM test_results ${whereClause}`).bind(...params).first();
  return json({ leaderboard: results.results, total: total.total, period, region: region || 'global' }, h);
}

async function handleStats(env, h) {
  const counts = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM test_results) as total, (SELECT COUNT(*) FROM rankings) as ranked, (SELECT COUNT(*) FROM test_results WHERE mbti_type IS NOT NULL AND mbti_type != '') as with_mbti`).first();
  const dist = await env.DB.prepare(`SELECT personality_code, COUNT(*) as count, ROUND(COUNT(*)*100.0/(SELECT COUNT(*) FROM test_results),1) as pct FROM test_results GROUP BY personality_code ORDER BY count DESC`).all();
  const mbtiCross = await env.DB.prepare(`SELECT mbti_type, personality_code, COUNT(*) as count FROM test_results WHERE mbti_type IS NOT NULL AND mbti_type != '' GROUP BY mbti_type, personality_code ORDER BY mbti_type, count DESC`).all();
  const mbtiDist = await env.DB.prepare(`SELECT mbti_type, COUNT(*) as count, ROUND(COUNT(*)*100.0/(SELECT COUNT(*) FROM test_results WHERE mbti_type IS NOT NULL AND mbti_type != ''),1) as pct FROM test_results WHERE mbti_type IS NOT NULL AND mbti_type != '' GROUP BY mbti_type ORDER BY count DESC`).all();
  const dailyStats = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM daily_quiz) as total, (SELECT COUNT(DISTINCT guest_code) FROM daily_quiz WHERE guest_code IS NOT NULL) as unique_users`).first();
  const dailyStreaks = await env.DB.prepare('SELECT guest_code, COUNT(*) as days FROM daily_quiz GROUP BY guest_code ORDER BY days DESC LIMIT 10').all();
  return json({
    total: counts.total,
    ranked: counts.ranked,
    distribution: dist.results,
    completion_rate: counts.total > 0 ? { with_mbti: counts.with_mbti, mbti_rate: Math.round(counts.with_mbti / counts.total * 1000) / 10 } : { with_mbti: 0, mbti_rate: 0 },
    mbti_distribution: mbtiDist.results,
    mbti_cross: mbtiCross.results,
    daily_quiz: { total_participations: dailyStats.total, unique_users: dailyStats.unique_users, top_streaks: dailyStreaks.results }
  }, h);
}

async function handleCount(env, h) {
  const result = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM test_results) as total, (SELECT COUNT(*) FROM test_results WHERE created_at >= date('now')) as today, (SELECT COUNT(*) FROM rankings) as ranked`).first();
  return json({ total: result.total, today: result.today, ranked: result.ranked }, h);
}

async function handleDailySubmit(request, env, h) {
  const body = await request.json();
  const { quiz_date, answer, guest_code } = body;
  if (!quiz_date || !answer) return json({ error: 'quiz_date and answer required' }, h, 400);
  const existing = await env.DB.prepare('SELECT id FROM daily_quiz WHERE guest_code = ? AND quiz_date = ?').bind(guest_code || '__none__', quiz_date).first();
  if (existing) return json({ error: 'already answered', already: true }, h);
  await env.DB.prepare('INSERT INTO daily_quiz (guest_code, quiz_date, answer) VALUES (?, ?, ?)').bind(guest_code || null, quiz_date, answer).run();
  const stats = await env.DB.prepare('SELECT answer, COUNT(*) as count FROM daily_quiz WHERE quiz_date = ? GROUP BY answer').bind(quiz_date).all();
  return json({ success: true, stats: stats.results }, h);
}

async function handleDailyStats(request, env, h) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
  const result = await env.DB.prepare(`SELECT answer, COUNT(*) as count, (SELECT COUNT(*) FROM daily_quiz WHERE quiz_date = ?) as total FROM daily_quiz WHERE quiz_date = ? GROUP BY answer`).bind(date, date).all();
  const total = result.results.length > 0 ? result.results[0].total : 0;
  return json({ date, total: total, distribution: result.results }, h);
}

async function handleDataDelete(request, env, h) {
  const body = await request.json().catch(() => null);
  const url = new URL(request.url);
  const guest_code = body?.guest_code || url.searchParams.get('guest_code');
  if (!guest_code || !guest_code.startsWith('SBTI-')) {
    return json({ error: 'Valid guest_code required (SBTI-XXXX)' }, h, 400);
  }
  let deleted = { rankings: 0, daily_quiz: 0, history: 0, progress: 0, daily_stats: 0 };
  const ranking = await env.DB.prepare('SELECT rank_id, result_id FROM rankings WHERE guest_code = ?').bind(guest_code).first();
  if (ranking) {
    if (ranking.result_id) {
      await env.DB.prepare('DELETE FROM test_results WHERE rowid = ?').bind(ranking.result_id).run();
    }
    await env.DB.prepare('DELETE FROM rankings WHERE guest_code = ?').bind(guest_code).run();
    deleted.rankings = 1;
  }
  const dr = await env.DB.prepare('DELETE FROM daily_quiz WHERE guest_code = ?').bind(guest_code).run();
  deleted.daily_quiz = dr.meta.changes || 0;
  const hr = await env.DB.prepare('DELETE FROM user_test_history WHERE guest_code = ?').bind(guest_code).run();
  deleted.history = hr.meta.changes || 0;
  const pr = await env.DB.prepare('DELETE FROM user_progress WHERE guest_code = ?').bind(guest_code).run();
  deleted.progress = pr.meta.changes || 0;
  const dsr = await env.DB.prepare('DELETE FROM user_daily_stats WHERE guest_code = ?').bind(guest_code).run();
  deleted.daily_stats = dsr.meta.changes || 0;
  return json({ success: true, message: 'User data deleted', deleted }, h);
}

async function handleUserHistoryGet(env, h, url) {
  const guest_code = url.searchParams.get('guest_code');
  const user_id = url.searchParams.get('user_id');
  if (!guest_code && !user_id) {
    return json({ error: 'guest_code or user_id required' }, h, 400);
  }
  let results;
  if (user_id) {
    results = await env.DB.prepare('SELECT * FROM user_test_history WHERE user_id = ? ORDER BY created_at DESC').bind(user_id).all();
  } else {
    results = await env.DB.prepare('SELECT * FROM user_test_history WHERE guest_code = ? ORDER BY created_at DESC').bind(guest_code).all();
  }
  return json({ history: results.results }, h);
}

async function handleUserHistoryPost(request, env, h) {
  const body = await request.json();
  const { guest_code, user_id, personality_code, match_score, pattern, date } = body;
  if (!personality_code) {
    return json({ error: 'personality_code required' }, h, 400);
  }
  const result = await env.DB.prepare('INSERT INTO user_test_history (user_id, guest_code, personality_code, match_score, pattern, test_date) VALUES (?, ?, ?, ?, ?, ?)').bind(user_id || null, guest_code || null, personality_code, match_score || null, pattern || null, date || null).run();
  return json({ success: true, id: result.meta.last_row_id }, h);
}

async function handleUserHistoryDelete(request, env, h) {
  const url = new URL(request.url);
  const guest_code = url.searchParams.get('guest_code');
  const id = url.searchParams.get('id');
  if (!id) {
    return json({ error: 'id required' }, h, 400);
  }
  const existing = await env.DB.prepare('SELECT id FROM user_test_history WHERE id = ? AND (guest_code = ? OR guest_code IS NULL)').bind(id, guest_code).first();
  if (!existing) {
    return json({ error: 'not found or no permission' }, h, 404);
  }
  await env.DB.prepare('DELETE FROM user_test_history WHERE id = ?').bind(id).run();
  return json({ success: true }, h);
}

async function handleUserDailyStatus(env, h, url) {
  const guest_code = url.searchParams.get('guest_code');
  if (!guest_code) {
    return json({ error: 'guest_code required' }, h, 400);
  }
  const today = new Date().toISOString().split('T')[0];
  const todayAnswer = await env.DB.prepare('SELECT answer FROM daily_quiz WHERE guest_code = ? AND quiz_date = ?').bind(guest_code, today).first();
  const stats = await env.DB.prepare('SELECT total_days, current_streak, last_quiz_date FROM user_daily_stats WHERE guest_code = ?').bind(guest_code).first();
  return json({ today_answered: !!todayAnswer, today_answer: todayAnswer ? todayAnswer.answer : null, total_days: stats ? stats.total_days : 0, current_streak: stats ? stats.current_streak : 0, last_quiz_date: stats ? stats.last_quiz_date : null }, h);
}

async function handleUserDailySubmit(request, env, h) {
  const body = await request.json();
  const { guest_code, user_id, quiz_date, answer } = body;
  if (!guest_code || !quiz_date || !answer) {
    return json({ error: 'guest_code, quiz_date, and answer required' }, h, 400);
  }
  const existing = await env.DB.prepare('SELECT id FROM daily_quiz WHERE guest_code = ? AND quiz_date = ?').bind(guest_code, quiz_date).first();
  if (existing) {
    return json({ error: 'already answered', already: true }, h);
  }
  await env.DB.prepare('INSERT INTO daily_quiz (guest_code, quiz_date, answer) VALUES (?, ?, ?)').bind(guest_code, quiz_date, answer).run();
  const stats = await env.DB.prepare('SELECT total_days, current_streak, last_quiz_date FROM user_daily_stats WHERE guest_code = ?').bind(guest_code).first();
  let total_days = 1;
  let current_streak = 1;
  if (stats) {
    total_days = stats.total_days + 1;
    if (stats.last_quiz_date) {
      const lastDate = new Date(stats.last_quiz_date);
      const today = new Date(quiz_date);
      const diffTime = Math.abs(today - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        current_streak = stats.current_streak + 1;
      } else if (diffDays === 0) {
        current_streak = stats.current_streak;
      } else {
        current_streak = 1;
      }
    }
    await env.DB.prepare('UPDATE user_daily_stats SET total_days = ?, current_streak = ?, last_quiz_date = ?, updated_at = CURRENT_TIMESTAMP WHERE guest_code = ?').bind(total_days, current_streak, quiz_date, guest_code).run();
  } else {
    await env.DB.prepare('INSERT INTO user_daily_stats (guest_code, user_id, total_days, current_streak, last_quiz_date) VALUES (?, ?, ?, ?, ?)').bind(guest_code, user_id || null, total_days, current_streak, quiz_date).run();
  }
  const dist = await env.DB.prepare('SELECT answer, COUNT(*) as count FROM daily_quiz WHERE quiz_date = ? GROUP BY answer').bind(quiz_date).all();
  return json({ success: true, total_days, current_streak, distribution: dist.results }, h);
}

async function handleUserProgressGet(env, h, url) {
  const guest_code = url.searchParams.get('guest_code');
  if (!guest_code) {
    return json({ error: 'guest_code required' }, h, 400);
  }
  const progress = await env.DB.prepare('SELECT answers_json, current_question, updated_at FROM user_progress WHERE guest_code = ?').bind(guest_code).first();
  if (!progress) {
    return json({ exists: false }, h);
  }
  return json({ exists: true, answers_json: progress.answers_json, current_question: progress.current_question, updated_at: progress.updated_at }, h);
}

async function handleUserProgressPost(request, env, h) {
  const body = await request.json();
  const { guest_code, user_id, answers_json, current_question } = body;
  if (!guest_code) {
    return json({ error: 'guest_code required' }, h, 400);
  }
  await env.DB.prepare(`INSERT INTO user_progress (guest_code, user_id, answers_json, current_question, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(guest_code) DO UPDATE SET user_id = excluded.user_id, answers_json = excluded.answers_json, current_question = excluded.current_question, updated_at = CURRENT_TIMESTAMP`).bind(guest_code, user_id || null, answers_json || '{}', current_question || 0).run();
  return json({ success: true }, h);
}

async function handleUserProfileGet(env, h, url) {
  const guest_code = url.searchParams.get('guest_code');
  const user_id = url.searchParams.get('user_id');
  if (!guest_code && !user_id) {
    return json({ error: 'guest_code or user_id required' }, h, 400);
  }
  let profile = null;
  if (user_id) {
    profile = await env.DB.prepare('SELECT id, username, nickname, mbti_type, avatar, created_at FROM users WHERE id = ?').bind(user_id).first();
  }
  let stats = { total_tests: 0, total_daily: 0, current_streak: 0 };
  let gc = guest_code;
  if (!gc && profile) {
    const r = await env.DB.prepare('SELECT guest_code FROM user_rankings WHERE user_id = ? LIMIT 1').bind(user_id).first();
    gc = r?.guest_code;
  }
  if (gc) {
    const testCount = await env.DB.prepare('SELECT COUNT(*) as count FROM user_test_history WHERE guest_code = ?').bind(gc).first();
    const dailyStats = await env.DB.prepare('SELECT total_days, current_streak FROM user_daily_stats WHERE guest_code = ?').bind(gc).first();
    if (testCount) stats.total_tests = testCount.count || 0;
    if (dailyStats) {
      stats.total_daily = dailyStats.total_days || 0;
      stats.current_streak = dailyStats.current_streak || 0;
    }
  }
  return json({ success: true, profile, stats }, h);
}

async function handleUserProfilePut(request, env, h) {
  const body = await request.json();
  const { user_id, nickname, mbti_type, avatar } = body;
  if (!user_id) {
    return json({ error: 'user_id required' }, h, 400);
  }
  await env.DB.prepare('UPDATE users SET nickname = ?, mbti_type = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(nickname || null, mbti_type || null, avatar || null, user_id).run();
  return json({ success: true }, h);
}

async function handleRegister(request, env, h) {
  const body = await request.json();
  const { username, password, nickname, mbti_type } = body;
  if (!username || !password) {
    return json({ error: 'username and password required' }, h, 400);
  }
  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) {
    return json({ error: 'username already exists' }, h, 409);
  }
  const password_hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
  const result = await env.DB.prepare('INSERT INTO users (username, password_hash, nickname, mbti_type) VALUES (?, ?, ?, ?)').bind(username, password_hash, nickname || null, mbti_type || null).run();
  return json({ success: true, user_id: result.meta.last_row_id }, h);
}

async function handleLogin(request, env, h) {
  const body = await request.json();
  const { username, password } = body;
  if (!username || !password) {
    return json({ error: 'username and password required' }, h, 400);
  }
  const password_hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
  const user = await env.DB.prepare('SELECT id, username, nickname, mbti_type, avatar FROM users WHERE username = ? AND password_hash = ?').bind(username, password_hash).first();
  if (!user) {
    return json({ error: 'invalid credentials' }, h, 401);
  }
  return json({ success: true, user }, h);
}

async function handleUserProfile(request, env, h) {
  const body = await request.json();
  const { user_id, nickname, mbti_type, avatar } = body;
  if (!user_id) {
    return json({ error: 'user_id required' }, h, 400);
  }
  await env.DB.prepare('UPDATE users SET nickname = ?, mbti_type = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(nickname || null, mbti_type || null, avatar || null, user_id).run();
  return json({ success: true }, h);
}

async function handleLinkGuest(request, env, h) {
  const body = await request.json();
  const { user_id, guest_code } = body;
  if (!user_id || !guest_code) {
    return json({ error: 'user_id and guest_code required' }, h, 400);
  }
  await env.DB.prepare('INSERT OR REPLACE INTO user_rankings (user_id, guest_code) VALUES (?, ?)').bind(user_id, guest_code).run();
  await env.DB.prepare('UPDATE user_test_history SET user_id = ? WHERE guest_code = ?').bind(user_id, guest_code).run();
  await env.DB.prepare('UPDATE user_progress SET user_id = ? WHERE guest_code = ?').bind(user_id, guest_code).run();
  await env.DB.prepare('UPDATE user_daily_stats SET user_id = ? WHERE guest_code = ?').bind(user_id, guest_code).run();
  return json({ success: true, message: 'Guest code linked to user' }, h);
}
