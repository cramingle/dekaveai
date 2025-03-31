import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import type { PgTableFn } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  tokens: integer('tokens').default(0),
  tier: text('tier').default('Pioneer'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  packageId: text('package_id').notNull(),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('pending'),
  provider: text('provider').notNull().default('stripe'),
  description: text('description'),
  metadata: jsonb('metadata').$type<{
    customerId?: string;
    priceId?: string;
    email?: string;
    paymentIntentId?: string;
    sessionId?: string;
    amount?: number;
    previousPurchase?: boolean;
    error?: string;
    action?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Schema = {
  users: typeof users;
  transactions: typeof transactions;
}; 