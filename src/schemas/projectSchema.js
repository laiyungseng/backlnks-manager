import { z } from 'zod';

export const projectLanguageSchema = z.object({
    id: z.number().int().optional().describe('SERIAL; PRIMARY KEY; Unique ID for the language ratio'),
    project_id: z.string().uuid().describe('UUID; FOREIGN KEY (project_id) REFERENCES projects(id); NOT NULL; Reference to the parent project'),
    lang_code: z.string().min(1, 'Language code required').max(5).describe('VARCHAR(5); NOT NULL; Language ISO code (e.g., EN, DE, FR)'),
    ratio: z.coerce.number().min(0).max(100).describe('INTEGER; NOT NULL; Percentage representation for this language (0-100)')
}).describe('Schema defining the project_languages child table');

export const projectTargetSchema = z.object({
    id: z.number().int().optional().describe('SERIAL; PRIMARY KEY; Unique ID for the project target'),
    project_id: z.string().uuid().describe('UUID; FOREIGN KEY (project_id) REFERENCES projects(id); NOT NULL; Reference to the parent project'),
    category: z.enum([
        'NULL', 'PBN', 'GP', 'Tier 2', 'Tier 2 EDU', 'Tier 2 GOV', 'EDU GP', 'GOV GP', 'Web2.0', 'Bookmark', 'Forum'
    ]).describe('VARCHAR(50); NOT NULL; Backlink category/tier for this group of targets'),
    anchor_text: z.string().min(1, 'Anchor text required').describe('TEXT; NOT NULL; The exact text to be used for the hyperlink'),
    target_url: z.string().url('Invalid URL formatting').describe('TEXT; NOT NULL; The destination URL the link should point to'),
    quantity_requested: z.coerce.number().min(1, 'Quantity must be > 0').describe('INTEGER; NOT NULL; Number of links requested for this specific anchor/target pair'),
    sheet_name: z.string().nullable().optional().describe('VARCHAR(255); Origin sheet or cohort identifier')
}).describe('Schema defining the project_targets child table');

// This is the flattened database table schema
export const projectSchema = z.object({
    id: z.string().uuid().optional().describe('UUID; PRIMARY KEY; DEFAULT gen_random_uuid(); Unique ID for the project'),
    project_name: z.string().min(1, 'Project Name is required').describe('TEXT; NOT NULL; The name of the overall project or campaign'),
    organization_id: z.string().uuid().optional().describe('UUID; FOREIGN KEY (organization_id) REFERENCES organizations(id); The owner organization'),
    owner: z.string().min(1, 'Owner is required').describe('TEXT; NOT NULL; The user, admin, or client account that owns this project'),
    start_date: z.string().min(1, 'Start Date is required').describe('DATE; NOT NULL; Date when link placement begins'),
    deadline: z.string().min(1, 'Deadline is required').describe('DATE; NOT NULL; Target completion date for all placements'),
    vendor_id: z.string().uuid().optional().describe('UUID; FOREIGN KEY (vendor_id) REFERENCES vendors(id); The assigned vendor handling this specific portion of the project'),
    country: z.string().min(1, 'Country is required').max(3).describe('VARCHAR(3); NOT NULL; Target country code for these links (e.g., US, FR, DE, UK)'),
    language: z.string().min(1, 'Language is required').max(5).describe('VARCHAR(5); NOT NULL; Legacy target language code (e.g., EN, FR, ES)'),
    total_quantity: z.coerce.number().min(1, 'Quantity must be > 0').describe('INTEGER; NOT NULL; Total gross number of links requested for this project segment'),
    remarks: z.string().nullable().optional().describe('TEXT; Additional instructions or notes for the vendor'),
    dripfeed_enabled: z.coerce.boolean().default(true).describe('BOOLEAN; DEFAULT TRUE; Whether placement should be spread over time'),
    dripfeed_period: z.coerce.number().nullable().optional().describe('INTEGER; Total number of days the period should span'),
    urls_per_day: z.coerce.number().nullable().optional().describe('INTEGER; Limit of links to build per day'),
    url_entry_enabled: z.preprocess(v => v === 'true', z.boolean()).default(false).describe('BOOLEAN; DEFAULT FALSE; Whether the vendor is allowed to edit or supply the Domain URL manually'),
    price: z.coerce.number().min(0).default(0).describe('NUMERIC; DEFAULT 0; Cost associated with this project'),
    price_type: z.enum(['per_url', 'package']).default('per_url').describe('VARCHAR(20); DEFAULT \'per_url\'; Determines if cost scales against quantity or is a flat pack cost'),
    randomize_languages: z.coerce.boolean().default(false).describe('BOOLEAN; DEFAULT FALSE; Whether language assignments array output should be scrambled/shuffled or sequential'),
    status: z.string().default('Active').describe('VARCHAR(50); DEFAULT \'Active\'; Current status of the project'),
    created_date: z.string().optional().describe('TIMESTAMPTZ; DEFAULT now(); Timestamp of creation'),
    completed_date: z.string().nullable().optional().describe('TIMESTAMPTZ; Timestamp when the project reached Completed status'),
    is_approved: z.boolean().default(false).describe('BOOLEAN; DEFAULT FALSE; Whether the project has been reviewed and approved by admin')
}).describe('Schema defining the flattened database columns for the projects table');

// Payload schema for form submissions (integrates the child arrays and preserves UI state)
export const projectFormPayloadSchema = projectSchema.omit({
    id: true,
    vendor_id: true,
    status: true,
    created_date: true,
    organization_id: true,
    total_quantity: true // Master UI field is named "quantity"
}).extend({
    vendor_name: z.string().min(1, 'Vendor Name is required').describe('The assigned vendor handling this specific portion of the project'),
    quantity: z.coerce.number().min(1, 'Master Quantity must be greater than 0').describe('Total gross number of links requested for this project segment'),
    languages_json: z.string()
        .min(1, 'At least one language is required')
        .transform((str, ctx) => {
            try { return JSON.parse(str); } catch (e) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid languages JSON' });
                return z.NEVER;
            }
        })
        .pipe(z.array(z.object({
            code: z.string().min(1, 'Language code required').max(5).describe('Language ISO code (e.g., EN, DE, FR)'),
            ratio: z.coerce.number().min(0).max(100).describe('Percentage representation for this language (0-100)')
        })).min(1, 'At least one language is required').describe('Array of target languages with their requested percentage distributions'))
        .refine((langs) => langs.reduce((sum, l) => sum + l.ratio, 0) === 100, { message: 'Language ratios must sum to exactly 100%' })
        .describe('Stringified JSON array representing multiple language targets and their ratios'),
    project_info_json: z.string()
        .min(1, 'Project Info blocks are required')
        .transform((str, ctx) => {
            try { return JSON.parse(str); } catch (e) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid project_info JSON' });
                return z.NEVER;
            }
        })
        .pipe(z.array(z.object({
            sheet_name: z.string().optional().describe('Origin sheet or cohort identifier'),
            category: projectTargetSchema.shape.category,
            placement_target: z.array(z.object({
                anchor_text: z.string().min(1, 'Anchor text required').describe('The exact text to be used for the hyperlink'),
                target_url: z.string().min(1, 'Target URL is required').transform(val => /^https?:\/\//i.test(val) ? val : `https://${val}`).pipe(z.string().url('Invalid URL formatting')).describe('The destination URL the link should point to'),
                quantity: z.coerce.number().min(1, 'Quantity must be > 0').describe('Number of links requested for this specific anchor/target pair')
            })).min(1, 'At least one target row is required in each group')
        })).min(1, 'At least one project info group is required'))
        .describe('Stringified JSON array holding grouped project info arrays, each containing category, sheet name, and target rows')
}).describe('Schema defining the API payload for creating a new project');
