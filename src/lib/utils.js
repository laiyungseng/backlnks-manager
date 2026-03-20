/**
 * Shared utility functions for the application.
 */

/**
 * Extracts the root domain from a URL string, returning the protocol and hostname with a trailing slash.
 * If no protocol is provided, it defaults to 'https://'.
 * @param {string} url - The URL to parse.
 * @returns {string} - The extracted domain (e.g., 'https://example.com/'), or an empty string if invalid.
 */
export const parseDomainUrl = (url) => {
    if (!url) return '';
    try {
        let rawUrl = String(url).trim();
        // Automatically prepend https:// if no protocol is found
        if (!/^https?:\/\//i.test(rawUrl)) {
            rawUrl = `https://${rawUrl}`;
        }
        
        const u = new URL(rawUrl);
        return `${u.protocol}//${u.hostname}/`;
    } catch {
        return '';
    }
};

/**
 * Parses numeric metrics from strings that might contain commas, percentage signs, or generic labels (e.g., "N/A").
 * @param {string|number} val - The input value to parse
 * @param {boolean} isFloat - Whether to parse as float (true) or integer (false)
 * @returns {number|null} The parsed numeric value or null if invalid.
 */
export const parseMetric = (val, isFloat = false) => {
    if (val === undefined || val === null || val === '') return null;
    
    // Convert to string for cleaning
    let strVal = String(val).trim().toUpperCase();
    
    // Filter out common "empty" or "unknown" markers from SEO tools
    if (['N/A', 'NULL', 'NONE', '-'].includes(strVal)) return null;

    // Handle K/M postfixes (e.g. 1.5K -> 1500)
    let multiplier = 1;
    if (strVal.endsWith('K')) {
        multiplier = 1000;
        strVal = strVal.slice(0, -1);
    } else if (strVal.endsWith('M')) {
        multiplier = 1000000;
        strVal = strVal.slice(0, -1);
    }

    // Strip out commas and percentage signs
    strVal = strVal.replace(/[,%]/g, '');

    const parsed = isFloat ? parseFloat(strVal) : parseInt(strVal, 10);
    
    if (isNaN(parsed)) return null;
    return parsed * multiplier;
};
