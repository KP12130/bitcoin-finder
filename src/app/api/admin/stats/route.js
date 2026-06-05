import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

export async function GET(req) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const reqCode1 = req.headers.get('x-admin-code-1');
    const reqCode2 = req.headers.get('x-admin-code-2');
    const envEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const envCode1 = (process.env.ADMIN_CODE_1 || '').trim();
    const envCode2 = (process.env.ADMIN_CODE_2 || '').trim();

    if (
      user.email?.toLowerCase() !== envEmail ||
      reqCode1 !== envCode1 ||
      reqCode2 !== envCode2
    ) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 403 });
    }

    // ── Fetch aggregate statistics from Supabase using user-authorized client ──
    
    // 1. Total active players
    const { count: totalPlayers } = await userSupabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // 2. Ledger Aggregates
    const { data: ledgerItems } = await userSupabase
      .from('ledger')
      .select('type, amount, status');

    let totalDeposited = 0;
    let totalWithdrawn = 0;
    
    if (ledgerItems) {
      ledgerItems.forEach(item => {
        if (item.status === 'completed') {
          if (item.type === 'deposit') {
            totalDeposited += Number(item.amount);
          } else if (item.type === 'withdrawal') {
            totalWithdrawn += Number(item.amount);
          }
        }
      });
    }

    // 3. Game Profit/Loss (House Margin)
    const { data: gameBets } = await userSupabase
      .from('game_results')
      .select('bet, payout');

    let totalWagered = 0;
    let totalPayouts = 0;

    if (gameBets) {
      gameBets.forEach(bet => {
        totalWagered += Number(bet.bet);
        totalPayouts += Number(bet.payout);
      });
    }

    const netHouseProfit = totalWagered - totalPayouts;

    return NextResponse.json({
      success: true,
      stats: {
        totalPlayers: totalPlayers || 0,
        totalDeposited,
        totalWithdrawn,
        totalWagered,
        totalPayouts,
        netHouseProfit,
        marginPercentage: totalWagered > 0 ? ((netHouseProfit / totalWagered) * 100).toFixed(2) : '0.00'
      }
    });

  } catch (err) {
    console.error('Admin Stats API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
