import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const chats = pgTable("chats", {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    message: text('message').notNull(),
    reply: text('reply').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
});

