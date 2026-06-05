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

  // Check admin role
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

    const { data: players, error } = await adminClient
      .from('profiles')
      .select('id, username, email, balance, total_wagered, total_won, is_banned, created_at, vip_tier')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return NextResponse.json({ success: true, players: players || [] });
  } catch (err) {
    console.error('Admin players GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const admin = await verifyAdminRequest(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = getSupabaseAdmin();
    if (!adminClient) return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });

    const { action, userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    if (action === 'ban') {
      await adminClient.from('profiles').update({ is_banned: true }).eq('id', userId);
      return NextResponse.json({ success: true, message: 'Player banned' });
    } else if (action === 'unban') {
      await adminClient.from('profiles').update({ is_banned: false }).eq('id', userId);
      return NextResponse.json({ success: true, message: 'Player unbanned' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

