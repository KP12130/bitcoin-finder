import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { email, code1, code2 } = await req.json();

    if (!email || !code1 || !code2) {
      return NextResponse.json({ error: 'Missing required credentials' }, { status: 400 });
    }

    const envEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const envCode1 = (process.env.ADMIN_CODE_1 || '').trim();
    const envCode2 = (process.env.ADMIN_CODE_2 || '').trim();

    if (
      email.trim().toLowerCase() !== envEmail ||
      code1.trim() !== envCode1 ||
      code2.trim() !== envCode2
    ) {
      return NextResponse.json({ error: 'Access Denied: Invalid security credentials' }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin Verify API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
