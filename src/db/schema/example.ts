import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const example = pgTable("example", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Example = typeof example.$inferSelect;
export type NewExample = typeof example.$inferInsert;
