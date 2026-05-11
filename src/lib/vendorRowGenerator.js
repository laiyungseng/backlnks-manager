/**
 * Generates the vendor-form row set for a single project from its targets blob,
 * language distribution, and any existing staging data. Mirrors the logic that
 * was previously inline in /vendor/[name]/[hash]/page.jsx.
 *
 * Inputs:
 *   targets:              array from projects_hub.targets
 *   languages:            array of { lang_code, ratio } from project_languages
 *   fallbackLanguage:     string fallback if no language pool (e.g. project.language)
 *   existingStagingData:  array from projects_hub.vendor_staging_data
 *   randomizeLanguages:   boolean
 */
export function generateVendorRows({ targets, languages, fallbackLanguage, existingStagingData, randomizeLanguages }) {
    const targetsData = Array.isArray(targets) ? targets : [];
    const langs = (languages || []).map(l => ({ 'lang-code': l.lang_code, ratio: l.ratio }));

    const languagePool = [];
    if (langs.length > 0) {
        langs.forEach(lang => {
            const qty = parseInt(lang.ratio || '0', 10);
            for (let i = 0; i < qty; i++) {
                languagePool.push(lang['lang-code']?.toUpperCase() || 'EN');
            }
        });
    }

    const generatedRows = [];
    let globalLangIndex = 0;

    targetsData.forEach((target, tIdx) => {
        const targetId = target.target_id || `idx-${tIdx}`;
        const targetQty = parseInt(target.quantity || '0', 10);

        for (let i = 0; i < targetQty; i++) {
            const assignedLang = languagePool.length > 0
                ? (languagePool[globalLangIndex] || languagePool[languagePool.length - 1])
                : ((fallbackLanguage || 'EN').toUpperCase());

            if (languagePool.length > 0) globalLangIndex++;

            const rowId = `${targetId}-${assignedLang}-qty-${i}`;
            const legacyRowId = `${targetId}-qty-${generatedRows.length}`;
            const legacyNoLangRowId = `${targetId}-qty-${i}`;
            const undefinedEraRowId = `${targetId}-undefined-qty-${i}`;

            const savedRow = Array.isArray(existingStagingData)
                ? (existingStagingData.find(st => st.id === rowId)
                    || existingStagingData.find(st => st.id === legacyRowId)
                    || existingStagingData.find(st => st.id === legacyNoLangRowId)
                    || existingStagingData.find(st => st.id === undefinedEraRowId))
                : null;

            generatedRows.push({
                id: rowId,
                target_id: targetId,
                tIdx,
                langIdx: languagePool.indexOf(assignedLang),
                category: target.category || null,
                sheet_name: target.sheet_name || null,
                target_url: target.target_url,
                anchor_text: target.anchor_text,
                language: assignedLang,
                domain_url: savedRow?.domain_url || '',
                published_url: savedRow?.published_url || '',
                published_date: savedRow?.published_date || '',
                remark: savedRow?.remark || '',
                indexed_status: savedRow?.indexed_status || '',
                indexed_datetime: savedRow?.indexed_datetime || '',
            });
        }
    });

    if (randomizeLanguages && generatedRows.length > 0) {
        generatedRows.sort((a, b) => {
            const hashA = [...a.id].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0);
            const hashB = [...b.id].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0);
            return hashA - hashB;
        });
    } else if (generatedRows.length > 0) {
        generatedRows.sort((a, b) => {
            if (a.tIdx !== b.tIdx) return (a.tIdx || 0) - (b.tIdx || 0);
            return (a.langIdx || 0) - (b.langIdx || 0);
        });
    }

    return generatedRows;
}

/**
 * Computes per-plan completion: { completed, total } from staging data + targets.
 */
export function getPlanProgress(targets, stagingData) {
    const t = Array.isArray(targets) ? targets : [];
    const s = Array.isArray(stagingData) ? stagingData : [];
    const total = t.reduce((acc, x) => acc + (parseInt(x.quantity || '0', 10)), 0);
    const completed = s.filter(r => r.published_url && r.published_url.trim().length > 0).length;
    return { completed, total };
}
