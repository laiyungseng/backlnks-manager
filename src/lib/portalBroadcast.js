const CHANNEL_NAME = 'df-portal';

/**
 * Broadcast a portal update to all same-origin tabs.
 * Safe to call in any context — returns immediately if BroadcastChannel is unavailable.
 *
 * @param {string} vendorUuid  The vendor UUID to scope the event to.
 */
export function broadcastPortalUpdate(vendorUuid) {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
        const ch = new BroadcastChannel(CHANNEL_NAME);
        ch.postMessage({ scope: `vendor:${vendorUuid}`, ts: Date.now() });
        ch.close();
    } catch {
        // non-fatal — live update is a UX enhancement, not critical path
    }
}

export { CHANNEL_NAME };
