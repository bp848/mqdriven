import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, search, hash } = request.nextUrl;
  
  // コールバックページは保護しない（認証処理のため）
  if (pathname.startsWith('/auth/callback')) {
    // コールバックページでのクエリパラメータやフラグメントを保持
    console.log(`コールバックページへのアクセス: ${pathname}${search}`);
    return NextResponse.next();
  }
  
  // 認証コードを含むURLはコールバックページにリダイレクト
  if (search.includes('code=') || search.includes('access_token=')) {
    const callbackUrl = new URL('/auth/callback', request.url);
    callbackUrl.search = search;
    console.log(`認証コードをコールバックページにリダイレクト: ${callbackUrl.toString()}`);
    return NextResponse.redirect(callbackUrl);
  }
  
  // その他のページは通常通り処理
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
