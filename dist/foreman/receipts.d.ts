import { z } from 'zod';
import type { ReceiptStore } from '@arki/admin/receipts';
import type { SchemaInput, StandardSchemaV1 } from '@arki/schema';
import type { Journal, JournalDefinitions, RootDb, TransactionSource } from '../index.js';
/**
 * The receipts table, shaped for a journal entity (string `id`, `version`).
 * Add it to the app's schema and migrate. `name` defaults to `foreman_receipts`.
 */
export declare function foremanReceiptTables(name?: string): {
    receipts: import("drizzle-orm/pg-core").PgTableWithColumns<{
        name: string;
        schema: undefined;
        columns: {
            id: import("drizzle-orm/pg-core").PgBuildColumn<string, import("drizzle-orm/pg-core").SetIsPrimaryKey<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: string;
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            receipt: import("drizzle-orm/pg-core").PgBuildColumn<string, import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").Set$Type<import("drizzle-orm/pg-core").PgJsonbBuilder, {
                status: "pending";
                executionId: string;
                actionId: string;
                requestHash?: string | undefined;
                claimedAt: string;
            } | {
                status: "applied";
                executionId: string;
                actionId: string;
                requestHash?: string | undefined;
                claimedAt: string;
                appliedAt: string;
                result: z.JSONType;
                resultHash?: string | undefined;
            } | {
                status: "failed";
                executionId: string;
                actionId: string;
                requestHash?: string | undefined;
                claimedAt: string;
                failedAt: string;
                error: {
                    code: string;
                    message: string;
                    status?: number | undefined;
                };
            }>>, {
                name: string;
                tableName: string;
                dataType: "object json";
                data: {
                    status: "pending";
                    executionId: string;
                    actionId: string;
                    requestHash?: string | undefined;
                    claimedAt: string;
                } | {
                    status: "applied";
                    executionId: string;
                    actionId: string;
                    requestHash?: string | undefined;
                    claimedAt: string;
                    appliedAt: string;
                    result: z.JSONType;
                    resultHash?: string | undefined;
                } | {
                    status: "failed";
                    executionId: string;
                    actionId: string;
                    requestHash?: string | undefined;
                    claimedAt: string;
                    failedAt: string;
                    error: {
                        code: string;
                        message: string;
                        status?: number | undefined;
                    };
                };
                driverParam: unknown;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            version: import("drizzle-orm/pg-core").PgBuildColumn<string, import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>>, {
                name: string;
                tableName: string;
                dataType: "number int32";
                data: number;
                driverParam: string | number;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
        };
        dialect: 'pg';
    }>;
};
export type ForemanReceiptTables = ReturnType<typeof foremanReceiptTables>;
export type JournalReceiptStoreOptions<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb> = {
    /** The app's journal definitions (`initJournal(...)`). */
    j: JournalDefinitions<Meta, Tx, AppDb>;
    /** The app's composed journal. */
    journal: Journal<Meta, Tx, AppDb>;
    /** The root database. Each claim and settle commits on its own. */
    db: TransactionSource<Tx>;
    tables: ForemanReceiptTables;
    /** The metadata every receipt event records, e.g. `{ actorId: 'foreman' }`. */
    meta: SchemaInput<Meta>;
};
/** A receipt store on `@arki/journal`. Call it once at boot: it defines the `foreman_receipt` entity. */
export declare function journalReceiptStore<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb>(options: JournalReceiptStoreOptions<Meta, Tx, AppDb>): ReceiptStore;
//# sourceMappingURL=receipts.d.ts.map