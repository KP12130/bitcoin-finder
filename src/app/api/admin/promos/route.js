import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (url && key) {
      _supabaseAdmin = createClient(url, key);
    }
  }
  return _supabaseAdmin;
}

async function verifyAdminRequest(req) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error } = await supabaseUser.auth.getUser();
  if (error || !user) return null;

  const adminClient = getSupabaseAdmin();
  if (!adminClient) return null;

  const { data: profile } = await adminClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return null;
  return user;
}

export async function GET(req) {
  try {
    const admin = await verifyAdminRequest(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = getSupabaseAdmin();
    if (!adminClient) return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });

    // Get all promo codes with redemption counts
    const { data: codes, error } = await adminClient
      .from('promo_codes')
      .select('*, promo_redemptions(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (codes || []).map(c => ({
      ...c,
      redemption_count: c.promo_redemptions?.[0]?.count ?? 0,
    }));

    return NextResponse.json({ success: true, codes: formatted });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const admin = await verifyAdminRequest(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = getSupabaseAdmin();
    if (!adminClient) return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });

    const body = await req.json();

    if (body.action === 'create') {
      const { code, bonusPct, maxBonus } = body;
      if (!code || !bonusPct || !maxBonus) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }
      const { error } = await adminClient.from('promo_codes').insert({
        code: code.trim().toUpperCase(),
        bonus_pct: parseFloat(bonusPct),
        max_bonus: parseFloat(maxBonus),
        is_active: true,
      });
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Code created' });
    }

    if (body.action === 'toggle') {
      const { code, is_active } = body;
      const { error } = await adminClient
        .from('promo_codes')
        .update({ is_active: !is_active })
        .eq('code', code);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'delete') {
      const { code } = body;
      await adminClient.from('promo_codes').delete().eq('code', code);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

