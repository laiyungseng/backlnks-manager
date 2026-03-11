import { z } from 'zod';

export const domainSchema = z.object({
    id: z.string().uuid().optional().describe('UUID; PRIMARY KEY; DEFAULT gen_random_uuid(); Unique ID for the domain'),
    vendor_id: z.string().uuid().optional().describe('UUID; FOREIGN KEY (vendor_id) REFERENCES vendors(id); Reference to the vendor that owns or offers this domain'),
    domain_url: z.string().min(1, 'Domain URL is required').url('Must be a valid URL').describe('TEXT; NOT NULL; Root domain URL (e.g., https://example.com)'),
    dr: z.coerce.number().min(0).max(100).nullable().optional().describe('NUMERIC; Ahrefs Domain Rating (0-100)'),
    traffic: z.coerce.number().min(0).nullable().optional().describe('INTEGER; Monthly organic traffic estimate'),
    domain_age: z.coerce.number().min(0).nullable().optional().describe('NUMERIC; Domain age in years'),
    spam_score: z.coerce.number().min(0).max(100).nullable().optional().describe('NUMERIC; Moz Spam Score percentage (0-100)'),
    last_checked_at: z.string().nullable().optional().describe('TIMESTAMPTZ; ISO timestamp indicating when metrics were last updated'),
    created_at: z.string().optional().describe('TIMESTAMPTZ; DEFAULT now(); Timestamp of creation')
}).describe('Schema representing the complete flattened structure in the domains table');
