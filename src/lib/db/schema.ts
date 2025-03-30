import { pgTable, uuid, varchar, numeric, timestamp, json, text } from 'drizzle-orm/pg-core';

// Transactions table schema
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().notNull(),
  userId: uuid('user_id').notNull(),
  packageId: varchar('package_id', { length: 255 }).notNull(),
  amount: numeric('amount').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('PENDING'),
  provider: varchar('provider', { length: 50 }).notNull(),
  description: text('description'),
  metadata: json('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
}); 