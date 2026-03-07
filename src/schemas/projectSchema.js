import { z } from 'zod';

export const projectSchema = z.object({
    project_name: z.string().min(1, 'Project Name is required').describe('The name of the overall project or campaign'),
    owner: z.string().min(1, 'Owner is required').describe('The user, admin, or client account that owns this project'),
    start_date: z.string().min(1, 'Start Date is required').describe('Date when link placement begins (YYYY-MM-DD format)'),
    deadline: z.string().min(1, 'Deadline is required').describe('Target completion date for all placements (YYYY-MM-DD format)'),
    vendor_name: z.string().min(1, 'Vendor Name is required').describe('The assigned vendor handling this specific portion of the project'),
    country: z.string().min(1, 'Country is required').max(3).describe('Target country code for these links (e.g., US, FR, DE, UK)'),
    // Legacy single language field (backward compat — populated from first language code)
    language: z.string().min(1, 'Language is required').max(5).describe('Legacy target language code (e.g., EN, FR, ES)'),
    // New: multi-language with ratios
    languages_json: z.string()
        .min(1, 'At least one language is required')
        .transform((str, ctx) => {
            try {
                return JSON.parse(str);
            } catch (e) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid languages JSON' });
                return z.NEVER;
            }
        })
        .pipe(
            z.array(z.object({
                code: z.string().min(1, 'Language code required').max(5).describe('Language ISO code (e.g., EN, DE, FR)'),
                ratio: z.coerce.number().min(0).max(100).describe('Percentage representation for this language (0-100)')
            })).min(1, 'At least one language is required').describe('Array of target languages with their requested percentage distributions')
        )
        .refine(
            (langs) => langs.reduce((sum, l) => sum + l.ratio, 0) === 100,
            { message: 'Language ratios must sum to exactly 100%' }
        ).describe('Stringified JSON array representing multiple language targets and their ratios'),
    project_info_json: z.string()
        .min(1, 'Project Info blocks are required')
        .transform((str, ctx) => {
            try {
                return JSON.parse(str);
            } catch (e) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid project_info JSON' });
                return z.NEVER;
            }
        })
        .pipe(
            z.array(z.object({
                sheet_name: z.string().optional().describe('Origin sheet or cohort identifier'),
                category: z.enum([
                    'NULL', 'PBN', 'GP', 'Tier 2', 'Tier 2 EDU', 'Tier 2 GOV', 'EDU GP', 'GOV GP', 'Web2.0', 'Bookmark', 'Forum'
                ]).describe('Backlink category/tier for this group of targets'),
                placement_target: z.array(z.object({
                    anchor_text: z.string().min(1, 'Anchor text required').describe('The exact text to be used for the hyperlink'),
                    target_url: z.string()
                        .min(1, 'Target URL is required')
                        .transform(val => /^https?:\/\//i.test(val) ? val : `https://${val}`)
                        .pipe(z.string().url('Invalid URL formatting')).describe('The destination URL the link should point to'),
                    quantity: z.coerce.number().min(1, 'Quantity must be > 0').describe('Number of links requested for this specific anchor/target pair')
                })).min(1, 'At least one target row is required in each group')
            })).min(1, 'At least one project info group is required')
        ).describe('Stringified JSON array holding grouped project info arrays, each containing category, sheet name, and target rows'),
    quantity: z.coerce.number().min(1, 'Master Quantity must be greater than 0').describe('Total gross number of links requested for this project segment'),
    remarks: z.string().optional().describe('Additional instructions or notes for the vendor'),
    dripfeed_enabled: z.coerce.boolean().default(true).describe('Whether placement should be spread over time (drip-feed)'),
    dripfeed_period: z.coerce.number().nullable().optional().describe('Total number of days the period should span'),
    urls_per_day: z.coerce.number().nullable().optional().describe('Limit of links to build per day'),
    url_entry_enabled: z.preprocess(v => v === 'true', z.boolean()).default(false).describe('Whether the vendor is allowed to edit or supply the Domain URL manually (Domain Entry toggle)'),
    price: z.coerce.number().min(0).default(0).describe('Cost associated with this project (per-url or package rate)'),
    price_type: z.enum(['per_url', 'package']).default('per_url').describe('Determines if cost scales against quantity or is a flat pack cost'),
    randomize_languages: z.coerce.boolean().default(false).describe('Whether language assignments array output should be scrambled/shuffled or sequential'),
}).describe('Schema defining the primary structured fields of the new-project kickoff form');
