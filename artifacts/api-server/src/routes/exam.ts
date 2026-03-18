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
import { eq } from "drizzle-orm";

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

// GET /api/exam/question-types
router.get("/question-types", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(questionTypeMappingsTable)
      .orderBy(questionTypeMappingsTable.questionNumber);

    const mappings = rows.map((r) => ({
      questionNumber: r.questionNumber,
      questionType: r.questionType,
    }));

    const nameRow = rows[0];
    res.json({ mappings, name: nameRow?.mappingName || "" });
  } catch (err) {
    console.error("Get question types error:", err);
    res.status(500).json({ error: "Failed to fetch question types" });
  }
});

// POST /api/exam/question-types
router.post("/question-types", async (req, res) => {
  try {
    const body = SaveQuestionTypesBody.parse(req.body);
    const mappingName = body.name || "默认映射";

    // Clear existing and insert new
    await db.delete(questionTypeMappingsTable);

    if (body.mappings.length > 0) {
      await db.insert(questionTypeMappingsTable).values(
        body.mappings.map((m) => ({
          questionNumber: m.questionNumber,
          questionType: m.questionType,
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

export default router;
