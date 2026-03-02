import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');

// Helper: parse .env file into an object
function parseEnv(content) {
    const result = {};
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        result[key] = value;
    }
    return result;
}

// Helper: serialize object back to .env format
function serializeEnv(envObj) {
    return Object.entries(envObj)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') + '\n';
}

// GET: Read current credentials
export async function GET() {
    try {
        if (!fs.existsSync(envPath)) {
            return NextResponse.json({ supabaseUrl: '', supabaseAnonKey: '' });
        }
        const content = fs.readFileSync(envPath, 'utf-8');
        const env = parseEnv(content);
        return NextResponse.json({
            supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL || '',
            supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        });
    } catch (error) {
        console.error('Settings GET error:', error);
        return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
    }
}

// POST: Save credentials
export async function POST(request) {
    try {
        const { supabaseUrl, supabaseAnonKey } = await request.json();

        // Read existing .env to preserve other vars
        let envObj = {};
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            envObj = parseEnv(content);
        }

        // Update only the Supabase keys
        envObj.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl || '';
        envObj.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseAnonKey || '';

        fs.writeFileSync(envPath, serializeEnv(envObj), 'utf-8');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Settings POST error:', error);
        return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }
}
