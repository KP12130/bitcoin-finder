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

export async function POST(req) {
  try {
    const { code, depositAmount, accessToken } = await req.json();

    if (!code || !depositAmount || !accessToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    // Initialize client using user's access token to satisfy RLS policies
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });

    const adminClient = getSupabaseAdmin();

    // Verify the player via access token
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const upperCode = code.trim().toUpperCase();

    // 1. Check code exists and is active
    const { data: promo, error: promoErr } = await userClient
      .from('promo_codes')
      .select('*')
      .eq('code', upperCode)
      .eq('is_active', true)
      .single();

    if (promoErr || !promo) {
      return NextResponse.json({ error: 'Invalid or expired promo code' }, { status: 400 });
    }

    // 2. Check the player has never used ANY promo code before
    const { data: existing, error: checkErr } = await userClient
      .from('promo_redemptions')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (checkErr) {
      console.error('Promo eligibility check error:', checkErr);
      return NextResponse.json({ error: `Database error checking eligibility: ${checkErr.message}` }, { status: 500 });
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'You have already used a promo code before. One per account only.' }, { status: 400 });
    }

    // 3. Calculate bonus: bonusPct% of depositAmount, capped at maxBonus
    const deposit = parseFloat(depositAmount);
    if (isNaN(deposit) || deposit <= 0) {
      return NextResponse.json({ error: 'Invalid deposit amount' }, { status: 400 });
    }

    const rawBonus = (deposit * promo.bonus_pct) / 100;
    const bonusAmount = Math.min(rawBonus, promo.max_bonus);
    const bonusRounded = Math.round(bonusAmount * 100) / 100;

    // 4. Record the redemption using the authenticated user client
    const { error: insertErr } = await userClient
      .from('promo_redemptions')
      .insert({
        user_id: userId,
        code: upperCode,
        deposit_amount: deposit,
        bonus_amount: bonusRounded,
      });

    if (insertErr) {
      console.error('Promo redemption insert error:', insertErr);
      // Handle unique constraint violation (double-click protection)
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'Promo code already redeemed.' }, { status: 400 });
      }
      return NextResponse.json({ error: `Failed to record redemption: ${insertErr.message}` }, { status: 500 });
    }

    // 5. Credit the bonus to the player's balance (using RPC or direct update fallback)
    const clientForBalance = adminClient || userClient;
    const { error: balanceErr } = await clientForBalance.rpc('increment_balance', {
      p_user_id: userId,
      p_amount: bonusRounded
    });

    if (balanceErr) {
      console.warn('increment_balance RPC failed, falling back to direct update:', balanceErr);
      const { data: profile, error: fetchProfileErr } = await clientForBalance
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

      if (fetchProfileErr) {
        console.error('Fetch profile for balance fallback failed:', fetchProfileErr);
      } else if (profile) {
        const { error: updateProfileErr } = await clientForBalance
          .from('profiles')
          .update({ balance: (profile.balance || 0) + bonusRounded })
          .eq('id', userId);
        if (updateProfileErr) {
          console.error('Direct balance update fallback failed:', updateProfileErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      bonus: bonusRounded,
      message: `🎁 Bonus of $${bonusRounded.toFixed(2)} applied from code ${upperCode}!`
    });

  } catch (err) {
    console.error('Promo redeem error:', err);
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
