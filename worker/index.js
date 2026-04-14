// SBTI API Worker - Leaderboard & Statistics
// Deploy to Cloudflare Workers with D1 binding

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route: Initialize database
      if (path === '/api/init' && request.method === 'POST') {
        return await handleInit(env, corsHeaders);
      }

      // Route: Submit test result
      if (path === '/api/submit' && request.method === 'POST') {
        return await handleSubmit(request, env, corsHeaders);
      }

      // Route: Get leaderboard
      if (path === '/api/leaderboard' && request.method === 'GET') {
        return await handleLeaderboard(env, corsHeaders, url);
      }

      // Route: Get personality stats
      if (path === '/api/stats' && request.method === 'GET') {
        return await handleStats(env, corsHeaders);
      }

      // Route: Get recent tests
      if (path === '/api/recent' && request.method === 'GET') {
        return await handleRecent(env, corsHeaders, url);
      }

      // Route: Get total count
      if (path === '/api/count' && request.method === 'GET') {
        return await handleCount(env, corsHeaders);
      }

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

// Initialize database tables
async function handleInit(env, headers) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personality_code TEXT NOT NULL,
      mbti_type TEXT,
      language TEXT DEFAULT 'zh',
      pattern TEXT,
      radar_values TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_personality ON test_results(personality_code)').run(); } catch(e) {}
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_created ON test_results(created_at)').run(); } catch(e) {}

  return new Response(JSON.stringify({ success: true, message: 'Database initialized' }), {
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

// Submit a test result
async function handleSubmit(request, env, headers) {
  const body = await request.json();
  const { personality_code, mbti_type, language, pattern, radar_values } = body;

  if (!personality_code) {
    return new Response(JSON.stringify({ error: 'personality_code is required' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }

  const result = await env.DB.prepare(
    'INSERT INTO test_results (personality_code, mbti_type, language, pattern, radar_values) VALUES (?, ?, ?, ?, ?)'
  ).bind(
    personality_code,
    mbti_type || null,
    language || 'zh',
    pattern || null,
    radar_values || null
  ).run();

  return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

// Get leaderboard - personality popularity ranking
async function handleLeaderboard(env, headers, url) {
  const limit = parseInt(url.searchParams.get('limit') || '27');
  const period = url.searchParams.get('period') || 'all'; // all, month, week, today

  let periodFilter = '';
  if (period === 'today') {
    periodFilter = "WHERE created_at >= date('now')";
  } else if (period === 'week') {
    periodFilter = "WHERE created_at >= date('now', '-7 days')";
  } else if (period === 'month') {
    periodFilter = "WHERE created_at >= date('now', '-30 days')";
  }

  const results = await env.DB.prepare(
    `SELECT personality_code, COUNT(*) as count
     FROM test_results ${periodFilter}
     GROUP BY personality_code
     ORDER BY count DESC
     LIMIT ?`
  ).bind(limit).all();

  // Get total count
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM test_results ${periodFilter}`
  ).first();

  return new Response(JSON.stringify({
    leaderboard: results.results,
    total: total.total,
    period
  }), {
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

// Get personality distribution stats
async function handleStats(env, headers) {
  // Overall distribution
  const distribution = await env.DB.prepare(
    `SELECT personality_code, COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM test_results), 1) as percentage
     FROM test_results
     GROUP BY personality_code
     ORDER BY count DESC`
  ).all();

  // MBTI cross stats
  const mbtiCross = await env.DB.prepare(
    `SELECT mbti_type, personality_code, COUNT(*) as count
     FROM test_results
     WHERE mbti_type IS NOT NULL
     GROUP BY mbti_type, personality_code
     ORDER BY count DESC
     LIMIT 50`
  ).all();

  // Language split
  const langSplit = await env.DB.prepare(
    `SELECT language, COUNT(*) as count FROM test_results GROUP BY language`
  ).all();

  // Daily trend (last 30 days)
  const trend = await env.DB.prepare(
    `SELECT date(created_at) as date, COUNT(*) as count
     FROM test_results
     WHERE created_at >= date('now', '-30 days')
     GROUP BY date(created_at)
     ORDER BY date`
  ).all();

  const total = await env.DB.prepare('SELECT COUNT(*) as total FROM test_results').first();

  return new Response(JSON.stringify({
    total: total.total,
    distribution: distribution.results,
    mbti_cross: mbtiCross.results,
    language_split: langSplit.results,
    daily_trend: trend.results
  }), {
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

// Get recent tests
async function handleRecent(env, headers, url) {
  const limit = parseInt(url.searchParams.get('limit') || '10');

  const results = await env.DB.prepare(
    `SELECT personality_code, mbti_type, language, created_at
     FROM test_results
     ORDER BY created_at DESC
     LIMIT ?`
  ).bind(limit).all();

  return new Response(JSON.stringify({ recent: results.results }), {
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

// Get total test count
async function handleCount(env, headers) {
  const result = await env.DB.prepare('SELECT COUNT(*) as total FROM test_results').first();

  // Today's count
  const today = await env.DB.prepare("SELECT COUNT(*) as count FROM test_results WHERE created_at >= date('now')").first();

  return new Response(JSON.stringify({
    total: result.total,
    today: today.count
  }), {
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}
