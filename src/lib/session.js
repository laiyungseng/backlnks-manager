import { cookies } from 'next/headers';

const COOKIE_NAME = 'df_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

function getSecret() {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error('SESSION_SECRET environment variable is not set.');
    return secret;
}

function base64urlEncode(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/')
        + '='.repeat((4 - (str.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function getHmacKey() {
    const enc = new TextEncoder();
    return crypto.subtle.importKey(
        'raw',
        enc.encode(getSecret()),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

/**
 * Produces a signed token string: base64url(payload).signature
 * Payload is JSON containing session data + expiry timestamp.
 */
export async function createSessionToken(sessionData) {
    const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
    const enc = new TextEncoder();
    const payloadJson = JSON.stringify({ ...sessionData, expiresAt });
    const payload = base64urlEncode(enc.encode(payloadJson));
    const key = await getHmacKey();
    const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const sig = base64urlEncode(sigBuffer);
    return `${payload}.${sig}`;
}

/**
 * Verifies a token and returns the session payload, or null if invalid/expired.
 * Uses crypto.subtle.verify for timing-safe comparison.
 */
export async function verifySessionToken(token) {
    try {
        if (!token || typeof token !== 'string') return null;
        const dotIdx = token.lastIndexOf('.');
        if (dotIdx === -1) return null;

        const payload = token.slice(0, dotIdx);
        const receivedSig = token.slice(dotIdx + 1);

        const enc = new TextEncoder();
        const key = await getHmacKey();
        const sigBuffer = base64urlDecode(receivedSig);
        const valid = await crypto.subtle.verify('HMAC', key, sigBuffer, enc.encode(payload));
        if (!valid) return null;

        const dec = new TextDecoder();
        const data = JSON.parse(dec.decode(base64urlDecode(payload)));
        if (!data.expiresAt || Date.now() > data.expiresAt) return null;

        return data;
    } catch {
        return null;
    }
}

/**
 * Sets the signed HttpOnly session cookie from a server action.
 * Must be called inside a Server Action or Route Handler.
 */
export async function setSessionCookie(sessionData) {
    const token = await createSessionToken(sessionData);
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: SESSION_TTL_SECONDS,
    });
}

/**
 * Reads and verifies the session cookie from a server action/route handler.
 * Returns the session payload or null.
 */
export async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    return verifySessionToken(token);
}

/**
 * Deletes the session cookie (logout).
 */
export async function clearSessionCookie() {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

// ---------------------------------------------------------------------------
// Vendor session — scoped cookie set when a vendor validates their project hash
// ---------------------------------------------------------------------------

const VENDOR_COOKIE_NAME = 'df_vendor_session';
const VENDOR_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export async function setVendorSessionCookie(vendorId) {
    const token = await createSessionToken({ vendorId, expiresAt: Date.now() + VENDOR_SESSION_TTL_SECONDS * 1000 });
    const cookieStore = await cookies();
    cookieStore.set(VENDOR_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/vendor',
        maxAge: VENDOR_SESSION_TTL_SECONDS,
    });
}

export async function getVendorSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get(VENDOR_COOKIE_NAME)?.value;
    return verifySessionToken(token);
}

export async function clearVendorSessionCookie() {
    const cookieStore = await cookies();
    cookieStore.delete(VENDOR_COOKIE_NAME);
}
