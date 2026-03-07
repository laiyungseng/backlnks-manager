import { z } from 'zod';

export const vendorSchema = z.object({
    vendor_name: z.string().min(1, 'Vendor Name is required').describe('Legal or trading name of the vendor'),
    contact: z.string().optional().describe('Primary contact person, email, or profile link'),
    product_types: z.string().optional().describe('Comma-separated list of services offered (e.g., PBN, GP, Niche Edit)'),
    performance: z.coerce.number().min(0).max(10).optional().describe('Internal performance and reliability rating (0-10)'),
    price: z.coerce.number().min(0).optional().describe('General baseline price or starting rate'),
    quality: z.coerce.number().min(0).max(10).optional().describe('Internal content quality rating (0-10)'),
    option_stock: z.coerce.number().min(0).optional().describe('Inventory or available capacity'),
    max_discount_pct: z.coerce.number().min(0).max(100).optional().describe('Maximum negotiated discount percentage allowed (0-100)'),
}).describe('Schema representing the complete vendor_details JSONB structure in the vendors table');
