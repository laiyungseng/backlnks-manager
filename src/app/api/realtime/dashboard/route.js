import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/realtime/dashboard
 *
 * Server-Sent Events stream — polls Supabase every 4 seconds from the SERVER
 * using private credentials (SUPABASE_URL / SUPABASE_ANON_KEY), so the browser
 * never needs to hold any credentials.
 *
 * Event format:
 *   event: projects
 *   data: <JSON array of projects>
 *
 * The client connects with `new EventSource('/api/realtime/dashboard')` and
 * updates React state on each received event.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POLL_INTERVAL_MS = 4000;

function buildSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

async function fetchProjects(supabase) {
    const { data, error } = await supabase
        .from('projects')
        .select(`
            id, owner, created_date, completed_date,
            project_name, country, total_quantity,
            status, is_approved, start_date, deadline, price, price_type,
            dripfeed_enabled, dripfeed_period, urls_per_day,
            vendors ( vendor_name ),
            projects_hub ( hash, targets, vendor_staging_data ),
            placements ( id ),
            project_languages ( lang_code, ratio ),
            project_targets ( category, sheet_name )
        `)
        .order('created_date', { ascending: false });

    if (error) {
        console.error('[SSE] Dashboard fetch error:', error.message);
        return null;
    }
    return data;
}

export async function GET() {
    const supabase = buildSupabase();

    if (!supabase) {
        // Return a proper SSE error event so the client can handle it gracefully.
        const errorBody = 'event: error\ndata: {"message":"Database not configured"}\n\n';
        return new Response(errorBody, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
            },
        });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            // Helper to enqueue a SSE message
            const send = (eventName, payload) => {
                const msg = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
                controller.enqueue(encoder.encode(msg));
            };

            // Send a heartbeat comment every poll so proxies don't close the connection.
            const heartbeat = () => {
                controller.enqueue(encoder.encode(': heartbeat\n\n'));
            };

            // Initial fetch
            const initial = await fetchProjects(supabase);
            if (initial !== null) send('projects', initial);

            // Polling loop
            while (true) {
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

                // Check if client disconnected (controller closed)
                try {
                    heartbeat();
                } catch {
                    break; // Client gone — stop looping
                }

                const data = await fetchProjects(supabase);
                if (data !== null) {
                    try {
                        send('projects', data);
                    } catch {
                        break; // Client gone
                    }
                }
            }
        },

        cancel() {
            // Called when the client disconnects — no cleanup needed for polling.
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable Nginx buffering if behind a proxy
        },
    });
}
