import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questionTypeMappingsTable = pgTable("question_type_mappings", {
  id: serial("id").primaryKey(),
  questionNumber: integer("question_number").notNull(),
  questionType: text("question_type").notNull(),
  module: text("module").notNull().default(""),
  keyPoint: text("key_point").notNull().default(""),
  mappingName: text("mapping_name").notNull().default("默认映射"),
});

export const insertQuestionTypeMappingSchema = createInsertSchema(questionTypeMappingsTable).omit({ id: true });
export type InsertQuestionTypeMapping = z.infer<typeof insertQuestionTypeMappingSchema>;
export type QuestionTypeMapping = typeof questionTypeMappingsTable.$inferSelect;
