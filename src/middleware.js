import { NextResponse } from 'next/server';

// Configuration list of blocked ISO country codes (Hungary, United States, United Kingdom)
const BLOCKED_COUNTRIES = ['HU', 'US', 'GB'];

export function middleware(req) {
  return NextResponse.next();
  const { pathname } = req.nextUrl;

  // 1. Strictly bypass and permit static assets, internal paths, and the blocked page itself
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/blocked') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') // Permits static file extensions (.png, .css, etc.)
  ) {
    return NextResponse.next();
  }

  // 1. Extract country code from CDN/Vercel/Cloudflare edge geo-location headers
  const country =
    req.headers.get('cf-ipcountry') ||        // Cloudflare Geo-IP header
    req.headers.get('x-vercel-ip-country') || // Vercel Geo-IP header
    req.headers.get('x-country-code') ||      // General CDN/Proxy header
    '';

  const countryUpper = country.toUpperCase();
  // Temporary bypass geoblocking until site is ready
  const isBlocked = false;

  // 2. If blocked, handle API and page requests appropriately
  if (isBlocked) {
    // If it's an API route, return a 403 JSON error instead of a page rewrite to prevent front-end crashes
    if (pathname.startsWith('/api/')) {
      console.warn(`[GEOGRAPHIC BLOCK API] Blocked API access to ${pathname} from ${countryUpper}`);
      return new NextResponse(
        JSON.stringify({ 
          error: 'Forbidden', 
          message: 'Access restricted due to local regulatory compliance.' 
        }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }



    console.warn(`[GEOGRAPHIC BLOCK] Intercepted request from ${countryUpper} trying to reach ${pathname}. Rewriting to /blocked.`);
    
    // Server-side rewrite keeps the active URL the same in the browser but serves the blocked template,
    // which is highly secure and hides the existence of other pages!
    return NextResponse.rewrite(new URL('/blocked', req.url));
  }

  // 3. For non-blocked users, strictly bypass static/internal assets or let them proceed
  return NextResponse.next();
}

// Apply middleware to all matching application pages and API routes
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
