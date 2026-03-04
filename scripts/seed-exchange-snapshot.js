/**
 * 取引レート用: 前日の total_gems / total_ex を exchange_daily_snapshots に1件投入する。
 * 日次 cron で実行するか、手動で node scripts/seed-exchange-snapshot.js
 * 必要: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getYesterdayJST() {
  const todayJst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
  const d = new Date(todayJst + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const date = getYesterdayJST();

  const { data: rows, error: sumError } = await supabase
    .from('profiles')
    .select('gems, evolution_points');

  if (sumError) {
    console.error('Failed to fetch profiles:', sumError.message);
    process.exit(1);
  }

  let totalGems = 0;
  let totalEx = 0;
  for (const r of rows || []) {
    totalGems += Math.max(0, Number(r.gems) || 0);
    totalEx += Math.max(0, Number(r.evolution_points) || 0);
  }

  const { error: upsertError } = await supabase
    .from('exchange_daily_snapshots')
    .upsert(
      { date, total_gems: totalGems, total_ex: totalEx },
      { onConflict: 'date' }
    );

  if (upsertError) {
    console.error('Failed to upsert snapshot:', upsertError.message);
    process.exit(1);
  }

  console.log(`Exchange snapshot: date=${date} total_gems=${totalGems} total_ex=${totalEx}`);
}

main();
