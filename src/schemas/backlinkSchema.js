import { z } from 'zod';

export const backlinkSchema = z.object({
    id: z.string().uuid().optional().describe('UUID; PRIMARY KEY; DEFAULT gen_random_uuid(); Unique ID for this placement/backlink'),
    project_id: z.string().uuid().describe('UUID; FOREIGN KEY (project_id) REFERENCES projects(id); NOT NULL; The parent project context'),
    vendor_id: z.string().uuid().describe('UUID; FOREIGN KEY (vendor_id) REFERENCES vendors(id); NOT NULL; The assigned vendor'),
    domain_id: z.string().uuid().nullable().optional().describe('UUID; FOREIGN KEY (domain_id) REFERENCES domains(id); The target domain for this link'),
    project_target_id: z.number().int().nullable().optional().describe('INTEGER; FOREIGN KEY (project_target_id) REFERENCES project_targets(id); Link to the specific requirement row'),
    sheet_name: z.string().nullable().optional().describe('VARCHAR(255); Origin sheet grouping'),
    category: z.string().nullable().optional().describe('VARCHAR(50); Content category/tier'),
    language: z.string().nullable().optional().describe('VARCHAR(5); Target language'),
    anchor_text: z.string().nullable().optional().describe('TEXT; Requested anchor text'),
    target_url: z.string().nullable().optional().describe('TEXT; Requested destination URL'),
    published_url: z.string().nullable().optional().describe('TEXT; The URL where the vendor actually placed the link'),
    published_date: z.string().nullable().optional().describe('DATE; Date of publication'),
    status: z.string().default('published').describe('VARCHAR(50); DEFAULT \'published\'; Workflow status (e.g., published, verified, rejected)'),
    indexed_status: z.string().nullable().optional().describe('VARCHAR(50); Google indexation status'),
    indexed_checked_at: z.string().nullable().optional().describe('TIMESTAMPTZ; When indexation was last checked'),
    last_vendor_update_at: z.string().nullable().optional().describe('TIMESTAMPTZ; When the vendor last updated this row'),
    notes: z.string().nullable().optional().describe('TEXT; Remark / Notes from admin or vendor'),
    country: z.string().nullable().optional().describe('VARCHAR(3); Target country'),
    vendor_token: z.string().nullable().optional().describe('VARCHAR(255); The original project hash for referencing vendor submissions'),
    created_at: z.string().optional().describe('TIMESTAMPTZ; DEFAULT now(); Timestamp of creation')
}).describe('Schema representing the placements table, the core normalized backlink tracking records');
