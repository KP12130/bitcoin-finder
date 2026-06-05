import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

// ── GET: Retrieve all active pending withdrawals and recent ledger history ──
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

    // Retrieve active withdrawals and recent payments
    const { data: withdrawals, error } = await userSupabase
      .from('ledger')
      .select('*')
      .eq('type', 'withdrawal')
      .order('timestamp', { ascending: false });

    if (error) throw error;

    // Fetch active pending deposit sessions for dashboard display
    const { data: activeSessions } = await userSupabase
      .from('payment_sessions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      withdrawals: withdrawals || [],
      activeSessions: activeSessions || []
    });

  } catch (err) {
    console.error('Admin Withdrawals GET Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

// ── POST: Approve or Reject (Refund) a withdrawal ──
export async function POST(req) {
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

    const { ledgerId, action, txHash, rejectReason } = await req.json();

    if (!ledgerId || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Retrieve the target transaction record from ledger
    const { data: tx, error: fetchError } = await userSupabase
      .from('ledger')
      .select('*')
      .eq('id', ledgerId)
      .single();

    if (fetchError || !tx) {
      return NextResponse.json({ error: 'Withdrawal transaction not found' }, { status: 404 });
    }

    if (tx.status !== 'pending') {
      return NextResponse.json({ error: 'Transaction is already settled' }, { status: 400 });
    }

    if (action === 'approve') {
      if (!txHash || txHash.trim().length < 10) {
        return NextResponse.json({ error: 'A valid transaction hash is required for approval' }, { status: 400 });
      }

      // Mark withdrawal as completed and bind the TxHash
      const { error: updateError } = await userSupabase
        .from('ledger')
        .update({
          status: 'completed',
          txid: txHash.trim(),
          label: `${tx.label} (Approved)`
        })
        .eq('id', ledgerId);

      if (updateError) throw updateError;

      console.log(`[ADMIN APPROVED WITHDRAWAL] ${ledgerId} approved with TxHash: ${txHash}`);
      return NextResponse.json({ success: true, status: 'completed' });

    } else if (action === 'reject') {
      const reason = rejectReason || 'Declined by Administrator';

      // 1. Mark transaction as failed
      const { error: updateError } = await userSupabase
        .from('ledger')
        .update({
          status: 'failed',
          label: `${tx.label} - Rejected: ${reason}`
        })
        .eq('id', ledgerId);

      if (updateError) throw updateError;

      // 2. Fetch the player's profile balance to refund
      const { data: profile, error: profileErr } = await userSupabase
        .from('profiles')
        .select('balance')
        .eq('id', tx.user_id)
        .single();

      if (profileErr || !profile) {
        throw new Error('Failed to retrieve player profile for refund balance');
      }

      // 3. Increment profile balance by the exact gross USD amount
      const refundedBalance = Number((Number(profile.balance) + Number(tx.amount)).toFixed(2));
      const { error: refundErr } = await userSupabase
        .from('profiles')
        .update({ balance: refundedBalance })
        .eq('id', tx.user_id);

      if (refundErr) throw refundErr;

      console.log(`[ADMIN REJECTED WITHDRAWAL] ${ledgerId} rejected. Refunded $${tx.amount} to user ${tx.user_id}`);
      return NextResponse.json({ success: true, status: 'failed', refundedAmount: tx.amount });
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });

  } catch (err) {
    console.error('Admin Withdrawals POST Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
