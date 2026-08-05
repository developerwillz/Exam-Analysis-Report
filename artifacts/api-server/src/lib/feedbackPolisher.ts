type Student = { studentName: string; wrongQuestions: number[] };
type Mapping = {
  questionNumber: number;
  questionType: string;
  module?: string;
  keyPoint?: string;
};

export type PolishedFeedback = { studentName: string; feedback: string };

const ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

function buildStudents(students: Student[], mappings: Mapping[]) {
  const mappingByQuestion = new Map(mappings.map((entry) => [entry.questionNumber, entry]));

  return students.flatMap((student) => {
    const matched = student.wrongQuestions.flatMap((questionNumber) => {
      const entry = mappingByQuestion.get(questionNumber);
      if (!entry) return [];
      return [{
        questionNumber,
        module: entry.module?.trim() || "未指定 Module",
        questionType: entry.questionType.trim(),
        preset: entry.keyPoint?.trim() || "",
      }];
    });

    return matched.length > 0 ? [{ studentName: student.studentName, wrongQuestions: matched }] : [];
  });
}

function parseModelJson(content: string): unknown {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(withoutFence);
}

export async function polishFeedback(
  students: Student[],
  mappings: Mapping[],
): Promise<PolishedFeedback[]> {
  const apiKey = process.env.ZHIPU_API_KEY?.trim();
  if (!apiKey) throw new Error("ZHIPU_API_KEY is not configured");

  const input = buildStudents(students, mappings);
  if (input.length === 0) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "glm-4.7-flash",
        thinking: { type: "disabled" },
        temperature: 0.4,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "你是一名 SAT 阅读教师，负责把结构化错题信息整理为自然、具体的中文模考反馈。",
              "不得修改或遗漏学生姓名、Module、匹配错题数量、题型和英文关键词。",
              "只能使用输入提供的题型和反馈预设，不得提及未输入的题目，不得虚构能力、态度、成绩或答题过程。",
              "合并重复或相近建议，避免逐题机械罗列；先客观概括错题分布，再给出重点建议。",
              "语气温和、自然、具体，每位学生 100 至 180 个汉字。",
              "严格返回 JSON：{\"feedbacks\":[{\"studentName\":\"原姓名\",\"feedback\":\"反馈正文\"}]}，不得输出其他内容。",
            ].join("\n"),
          },
          { role: "user", content: JSON.stringify({ students: input }) },
        ],
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Zhipu API ${response.status}: ${detail}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Zhipu API returned empty content");

    const parsed = parseModelJson(content) as { feedbacks?: unknown };
    if (!Array.isArray(parsed.feedbacks)) throw new Error("Invalid feedback response shape");

    const expectedNames = new Set(input.map((student) => student.studentName));
    return parsed.feedbacks.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      if (
        typeof row.studentName !== "string" ||
        typeof row.feedback !== "string" ||
        !expectedNames.has(row.studentName) ||
        !row.feedback.trim()
      ) return [];
      return [{ studentName: row.studentName, feedback: row.feedback.trim() }];
    });
  } finally {
    clearTimeout(timeout);
  }
}
