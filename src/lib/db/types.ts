import * as schema from './schema';

export type Database = {
  users: typeof schema.users.$inferSelect;
  transactions: typeof schema.transactions.$inferSelect;
}; 