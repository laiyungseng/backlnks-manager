/**
 * Writes an audit log entry to the `audit_log` table.
 * Silently swallows errors — audit logging must never block the primary action.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ action: string, actor?: string, actorId?: string, targetId?: string, detail?: string }} entry
 */
export async function writeAuditLog(supabase, { action, actor, actorId, targetId, detail }) {
    try {
        await supabase.from('audit_log').insert({
            action,
            actor: actor ?? null,
            actor_id: actorId ?? null,
            target_id: targetId ?? null,
            detail: detail ?? null,
            created_at: new Date().toISOString(),
        });
    } catch (e) {
        // Log to server console but never throw — audit must be non-blocking
        console.error('[auditLog] Failed to write audit entry:', e?.message);
    }
}
