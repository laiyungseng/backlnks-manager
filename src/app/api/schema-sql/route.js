import { NextResponse } from 'next/server';
import { TABLE_SCHEMA_MAP, getSQLSchema } from '@/schemas/registry';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        let sqlOutput = `-- Auto-generated SQL Migration from Zod Registry\n-- Generated at: ${new Date().toISOString()}\n\n`;

        for (const [tableName, zodSchema] of Object.entries(TABLE_SCHEMA_MAP)) {
            const columns = getSQLSchema(zodSchema);

            sqlOutput += `-- Table: ${tableName}\n`;
            sqlOutput += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;

            const colDefs = columns.map(col => `    ${col.field} ${col.sql}`);
            sqlOutput += colDefs.join(',\n');
            sqlOutput += `\n);\n\n`;

            // Extract table comments if available
            if (zodSchema.description) {
                sqlOutput += `COMMENT ON TABLE public.${tableName} IS '${zodSchema.description.replace(/'/g, "''")}';\n\n`;
            }

            // Extract column comments
            columns.forEach(col => {
                if (col.description) {
                    sqlOutput += `COMMENT ON COLUMN public.${tableName}.${col.field} IS '${col.description.replace(/'/g, "''")}';\n`;
                }
            });
            sqlOutput += '\n------------------------------------------------------------\n\n';
        }

        // Add foreign key constraint examples for Phase 3
        sqlOutput += `-- To apply this, copy and run in your Supabase SQL Editor.\n`;

        return new NextResponse(sqlOutput, {
            headers: { 'Content-Type': 'text/plain' }
        });

    } catch (error) {
        return new NextResponse(`Error generating SQL: ${error.message}`, { status: 500 });
    }
}
