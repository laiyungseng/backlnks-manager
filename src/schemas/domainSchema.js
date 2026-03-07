import { z } from 'zod';

export const domainSchema = z.object({
    domain_url: z.string().min(1, 'Domain URL is required').url('Must be a valid URL').describe('Root domain URL (e.g., https://example.com)'),
    DR: z.coerce.number().min(0).max(100).nullable().optional().describe('Ahrefs Domain Rating (0-100)'),
    Traffic: z.coerce.number().min(0).nullable().optional().describe('Monthly organic traffic estimate'),
    Domain_age: z.coerce.number().min(0).nullable().optional().describe('Domain age in years'),
    Spam_Score: z.coerce.number().min(0).max(100).nullable().optional().describe('Moz Spam Score percentage (0-100)'),
    Last_checked_at: z.string().nullable().optional().describe('ISO timestamp indicating when metrics were last updated'),
}).describe('Schema representing the complete domain_details JSONB structure in the domains table');
