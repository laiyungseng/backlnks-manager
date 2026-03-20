import { NextResponse } from 'next/server';

export function middleware(request) {
    const { pathname } = request.nextUrl;

    // Only protect /admin routes
    if (pathname.startsWith('/admin')) {
        const sessionCookie = request.cookies.get('df_admin_session_active');

        // If no session cookie exists, redirect to login
        if (!sessionCookie) {
            const loginUrl = new URL('/login', request.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    return NextResponse.next();
}

// Specify which routes should trigger this middleware
export const config = {
    matcher: ['/admin/:path*'],
};
