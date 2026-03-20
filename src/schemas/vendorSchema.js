import { z } from 'zod';

export const vendorSchema = z.object({
    id: z.string().uuid().optional().describe('UUID; PRIMARY KEY; DEFAULT gen_random_uuid(); Unique ID for the vendor'),
    vendor_name: z.string().min(1, 'Vendor Name is required').describe('TEXT; NOT NULL; Legal or trading name of the vendor'),
    contact: z.string().nullable().optional().describe('TEXT; Primary contact person, email, or profile link'),
    product_types: z.string().nullable().optional().describe('TEXT; Comma-separated list of services offered (e.g., PBN, GP, Niche Edit)'),
    performance: z.coerce.number().min(0).max(10).nullable().optional().describe('NUMERIC; Internal performance and reliability rating (0-10)'),
    price: z.coerce.number().min(0).nullable().optional().describe('NUMERIC; General baseline price or starting rate'),
    quality: z.coerce.number().min(0).max(10).nullable().optional().describe('NUMERIC; Internal content quality rating (0-10)'),
    option_stock: z.coerce.number().min(0).nullable().optional().describe('INTEGER; Inventory or available capacity'),
    max_discount_pct: z.coerce.number().min(0).max(100).nullable().optional().describe('NUMERIC; Maximum negotiated discount percentage allowed (0-100)'),
    created_at: z.string().optional().describe('TIMESTAMPTZ; DEFAULT now(); Timestamp of creation')
}).describe('Schema representing the complete flattened structure in the vendors table');
