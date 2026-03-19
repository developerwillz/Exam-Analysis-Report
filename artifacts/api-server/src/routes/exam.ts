import { Router, type IRouter } from "express";
import {
  ParseExamHtmlBody,
  ExportCsvBody,
  SaveQuestionTypesBody,
} from "@workspace/api-zod";
import { parseExamHtml } from "../lib/htmlParser.js";
import { generateCsv } from "../lib/csvExporter.js";
import { db } from "@workspace/db";
import { questionTypeMappingsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

// POST /api/exam/parse
router.post("/parse", async (req, res) => {
  try {
    const body = ParseExamHtmlBody.parse(req.body);
    const result = parseExamHtml(body.html);
    res.json(result);
  } catch (err) {
    console.error("Parse error:", err);
    res.status(400).json({ error: "Failed to parse HTML", details: String(err) });
  }
});

// POST /api/exam/export-csv
router.post("/export-csv", (req, res) => {
  try {
    const body = ExportCsvBody.parse(req.body);
    const csv = generateCsv(
      body.students,
      body.questionTypeMappings || [],
      body.examTitle
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(body.examTitle || "exam_results")}.csv`
    );
    res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(400).json({ error: "Failed to generate CSV", details: String(err) });
  }
});

// GET /api/exam/question-types/configs — list all saved config names
router.get("/question-types/configs", async (_req, res) => {
  try {
    const rows = await db
      .select({
        name: questionTypeMappingsTable.mappingName,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(questionTypeMappingsTable)
      .groupBy(questionTypeMappingsTable.mappingName)
      .orderBy(questionTypeMappingsTable.mappingName);

    res.json({ configs: rows.map(r => ({ name: r.name, count: r.count })) });
  } catch (err) {
    console.error("List configs error:", err);
    res.status(500).json({ error: "Failed to list configs" });
  }
});

// GET /api/exam/question-types?name=X — get a specific config (or latest if no name)
router.get("/question-types", async (req, res) => {
  try {
    const name = req.query.name as string | undefined;

    let rows;
    if (name) {
      rows = await db
        .select()
        .from(questionTypeMappingsTable)
        .where(eq(questionTypeMappingsTable.mappingName, name))
        .orderBy(questionTypeMappingsTable.questionNumber);
    } else {
      rows = await db
        .select()
        .from(questionTypeMappingsTable)
        .orderBy(questionTypeMappingsTable.questionNumber);
    }

    const mappings = rows.map((r) => ({
      questionNumber: r.questionNumber,
      questionType: r.questionType,
      module: r.module || "",
    }));

    const nameRow = rows[0];
    res.json({ mappings, name: nameRow?.mappingName || "" });
  } catch (err) {
    console.error("Get question types error:", err);
    res.status(500).json({ error: "Failed to fetch question types" });
  }
});

// POST /api/exam/question-types — save (replace) a named config
router.post("/question-types", async (req, res) => {
  try {
    const body = SaveQuestionTypesBody.parse(req.body);
    const mappingName = body.name?.trim() || "默认映射";

    // Delete all rows for this named config, then insert fresh
    await db
      .delete(questionTypeMappingsTable)
      .where(eq(questionTypeMappingsTable.mappingName, mappingName));

    if (body.mappings.length > 0) {
      await db.insert(questionTypeMappingsTable).values(
        body.mappings.map((m) => ({
          questionNumber: m.questionNumber,
          questionType: m.questionType,
          module: m.module || "",
          mappingName,
        }))
      );
    }

    res.json({ success: true, message: "题型映射已保存" });
  } catch (err) {
    console.error("Save question types error:", err);
    res.status(500).json({ error: "Failed to save question types" });
  }
});

// DELETE /api/exam/question-types/:name — delete a named config
router.delete("/question-types/:name", async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    await db
      .delete(questionTypeMappingsTable)
      .where(eq(questionTypeMappingsTable.mappingName, name));
    res.json({ success: true, message: `配置「${name}」已删除` });
  } catch (err) {
    console.error("Delete config error:", err);
    res.status(500).json({ error: "Failed to delete config" });
  }
});

export default router;
