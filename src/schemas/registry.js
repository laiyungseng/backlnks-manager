import { projectSchema, projectLanguageSchema, projectTargetSchema, projectFormPayloadSchema } from './projectSchema';
import { vendorSchema } from './vendorSchema';
import { domainSchema } from './domainSchema';
import { backlinkSchema } from './backlinkSchema';

// Central mapping linking database table names to their unified Zod schema
export const TABLE_SCHEMA_MAP = {
    projects: projectSchema,
    project_languages: projectLanguageSchema,
    project_targets: projectTargetSchema,
    vendors: vendorSchema,
    domains: domainSchema,
    placements: backlinkSchema
};

/**
 * Utility to parse Zod `.describe()` strings into raw SQL column definitions.
 * Expects description string format: "TYPE; CONSTRAINTS; COMMENT"
 * 
 * @param {import('zod').ZodObject} zodObject
 * @returns {Array<{field: string, sql: string, description: string}>}
 */
export function getSQLSchema(zodObject) {
    if (!zodObject || !zodObject.shape) return [];

    return Object.entries(zodObject.shape).map(([key, zodDef]) => {
        const desc = zodDef.description || '';
        const parts = desc.split(';').map(s => s.trim());

        // Defaults if format is omitted
        let type = 'TEXT';
        let constraints = [];
        let comment = '';

        if (parts.length > 0 && parts[0]) {
            type = parts[0];
        }

        // If there are multiple parts, the last part is the comment
        if (parts.length > 1) {
            comment = parts.pop() || '';
            // The middle parts are constraints (like NOT NULL, PRIMARY KEY)
            constraints = parts.slice(1);
        }

        const sql = `${type} ${constraints.join(' ')}`.trim();
        return {
            field: key,
            sql,
            description: comment
        };
    });
}
