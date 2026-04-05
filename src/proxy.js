import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/session';

export async function proxy(request) {
    const { pathname } = request.nextUrl;

    const isAdminRoute = pathname.startsWith('/admin');
    const isSensitiveApi = pathname.startsWith('/api/settings') || pathname.startsWith('/api/realtime/dashboard');

    if (isAdminRoute || isSensitiveApi) {
        const sessionCookie = request.cookies.get('df_admin_session');
        const token = sessionCookie?.value;

        const session = token ? await verifySessionToken(token) : null;

        if (!session) {
            // API routes get 401; browser routes get redirect
            if (isSensitiveApi) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const loginUrl = new URL('/login', request.url);
            return NextResponse.redirect(loginUrl);
        }

        // Forward verified admin id in a header so server actions can read it
        const res = NextResponse.next();
        res.headers.set('x-admin-id', String(session.id));
        return res;
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/api/settings/:path*', '/api/realtime/dashboard'],
};
