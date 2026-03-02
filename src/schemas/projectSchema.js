import { z } from 'zod';

export const projectSchema = z.object({
    project_name: z.string().min(1, 'Project Name is required'),
    owner: z.string().min(1, 'Owner is required'),
    start_date: z.string().min(1, 'Start Date is required'),
    deadline: z.string().min(1, 'Deadline is required'),
    vendor_name: z.string().min(1, 'Vendor Name is required'),
    country: z.string().min(1, 'Country is required').max(3),
    // Legacy single language field (backward compat — populated from first language code)
    language: z.string().min(1, 'Language is required').max(5),
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
                code: z.string().min(1, 'Language code required').max(5),
                ratio: z.coerce.number().min(0).max(100)
            })).min(1, 'At least one language is required')
        )
        .refine(
            (langs) => langs.reduce((sum, l) => sum + l.ratio, 0) === 100,
            { message: 'Language ratios must sum to exactly 100%' }
        ),
    targets_json: z.string()
        .min(1, 'Targets are required')
        .transform((str, ctx) => {
            try {
                return JSON.parse(str);
            } catch (e) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid targets JSON' });
                return z.NEVER;
            }
        })
        .pipe(
            z.array(z.object({
                anchor_text: z.string().min(1, 'Anchor text required'),
                target_url: z.string()
                    .min(1, 'Target URL is required')
                    .transform(val => /^https?:\/\//i.test(val) ? val : `https://${val}`)
                    .pipe(z.string().url('Invalid URL formatting')),
                quantity: z.coerce.number().min(1, 'Quantity must be > 0')
            })).min(1, 'At least one target row is required')
        ),
    backlinks_category: z.enum([
        'NULL',
        'PBN',
        'GP',
        'Tier 2',
        'Tier 2 EDU',
        'Tier 2 GOV',
        'EDU GP',
        'GOV GP',
        'Web2.0',
        'Bookmark',
        'Forum'
    ]),
    sheet_name: z.string().nullable().optional(),
    quantity: z.coerce.number().min(1, 'Master Quantity must be greater than 0'),
    remarks: z.string().optional(),
    dripfeed_enabled: z.coerce.boolean().default(true),
    dripfeed_period: z.coerce.number().nullable().optional(),
    urls_per_day: z.coerce.number().nullable().optional(),
});
