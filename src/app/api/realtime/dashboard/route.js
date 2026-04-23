import { getServerSupabase } from '@/lib/supabase-server';

/**
 * GET /api/realtime/dashboard
 *
 * Server-Sent Events stream — subscribes to Supabase Realtime CDC from the SERVER
 * using private credentials (SUPABASE_SERVICE_ROLE_KEY), so the browser
 * never needs to hold any credentials.
 *
 * Replaces the previous 10s polling loop. Changes in `projects` or `projects_hub`
 * now trigger an immediate refetch + push (debounced 500ms to coalesce rapid writes).
 *
 * Event format:
 *   event: projects
 *   data: <JSON array of projects>
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function buildSupabase() {
    try {
        return getServerSupabase();
    } catch {
        return null;
    }
}

async function fetchProjects(supabase) {
    const { data, error } = await supabase
        .from('projects')
        .select(`
            id, owner, created_date, completed_date,
            project_name, country, total_quantity,
            status, is_approved, start_date, deadline, price, price_type,
            dripfeed_enabled, dripfeed_period, urls_per_day, url_entry_enabled,
            vendors ( vendor_name ),
            projects_hub ( hash, targets, is_locked, vendor_staging_data ),
            placements ( id ),
            project_languages ( lang_code, ratio ),
            project_targets ( category, sheet_name )
        `)
        .order('created_date', { ascending: false });

    if (error) {
        console.error('[SSE] Dashboard fetch error:', error.message);
        return null;
    }

    // Compute completed_count and indexed_count server-side; strip raw blob from the wire
    return data.map(project => {
        const hub = project.projects_hub?.[0];
        if (!hub) return project;
        const staging = Array.isArray(hub.vendor_staging_data) ? hub.vendor_staging_data : [];
        const completed_count = staging.filter(s =>
            s.published_url && s.published_url.trim().length > 0 &&
            s.published_date && s.published_date.trim().length > 0
        ).length;
        const indexed_count = staging.filter(s =>
            s.indexed_status && s.indexed_status.trim().length > 0
        ).length;
        const { vendor_staging_data: _dropped, ...hubWithoutBlob } = hub;
        return {
            ...project,
            projects_hub: [{ ...hubWithoutBlob, completed_count, indexed_count }],
        };
    });
}

export async function GET() {
    const supabase = buildSupabase();

    if (!supabase) {
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
    let activeChannel = null;
    let heartbeatTimer = null;
    let debounceTimer = null;
    let isClosed = false;

    const stream = new ReadableStream({
        async start(controller) {
            const send = (eventName, payload) => {
                if (isClosed) return;
                try {
                    controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`));
                } catch {
                    isClosed = true;
                }
            };

            const heartbeat = () => {
                if (isClosed) return;
                try {
                    controller.enqueue(encoder.encode(': heartbeat\n\n'));
                } catch {
                    isClosed = true;
                }
            };

            // Initial fetch on connect
            const initial = await fetchProjects(supabase);
            if (initial !== null) send('projects', initial);

            // Heartbeat every 25s to keep proxies alive
            heartbeatTimer = setInterval(heartbeat, 25000);

            // Debounced push — coalesces rapid back-to-back DB changes (e.g. bulk vendor save)
            const pushLatest = () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(async () => {
                    if (isClosed) return;
                    const data = await fetchProjects(supabase);
                    if (data !== null) send('projects', data);
                }, 500);
            };

            // Subscribe to CDC events on the two tables that drive the dashboard
            activeChannel = supabase
                .channel('admin-dashboard-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'projects_hub' }, pushLatest)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, pushLatest)
                .subscribe((status) => {
                    console.log(`[Realtime] Dashboard subscription: ${status}`);
                });
        },

        cancel() {
            isClosed = true;
            clearInterval(heartbeatTimer);
            clearTimeout(debounceTimer);
            if (activeChannel) {
                supabase.removeChannel(activeChannel);
                activeChannel = null;
            }
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
