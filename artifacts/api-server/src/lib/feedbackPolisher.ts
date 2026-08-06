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
        presetId: `Q${questionNumber}`,
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
        temperature: 0.2,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "你是一名 SAT 阅读教师，只负责把结构化反馈预设整理成自然、具体的中文学习建议。",
              "姓名、Module、错题数量和题型分布将由程序另行添加；feedback 中不得重复这些事实，也不得省略、修改 studentName 字段。",
              "必须覆盖每一道输入题目的 presetId。内容实质相同的预设可以合并表达，但 coveredPresetIds 仍须列出对应的全部 ID。",
              "不同的方法、关键词和解题要求不得合并或省略。例如“提取变量”和“破坏前提”必须同时保留。",
              "只能使用输入提供的题型和反馈预设，不得虚构学生能力、态度、成绩或答题过程；英文关键词必须原样保留。",
              "消除“注意注意”“推理题注意推理题”等重复措辞。建议要有清晰的题型归属，语气温和自然，长度按信息量控制在 80 至 300 个汉字。",
              "feedback 必须以“建议”开头，只写学习建议。",
              "严格返回 JSON：{\"feedbacks\":[{\"studentName\":\"原姓名\",\"feedback\":\"建议……\",\"coveredPresetIds\":[\"Q1\",\"Q2\"]}]}，不得输出其他内容。",
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

    const expectedByName = new Map(input.map((student) => [
      student.studentName,
      new Set(student.wrongQuestions.map(question => question.presetId)),
    ]));
    const allStudentNames = students.map(student => student.studentName);
    return parsed.feedbacks.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      if (
        typeof row.studentName !== "string" ||
        typeof row.feedback !== "string" ||
        !Array.isArray(row.coveredPresetIds)
      ) return [];

      const studentName = row.studentName;
      const feedback = row.feedback;
      if (
        !expectedByName.has(studentName) ||
        !feedback.trim() ||
        allStudentNames.some(name => feedback.includes(name)) ||
        /Module|错了\s*\d+\s*题/i.test(feedback)
      ) return [];

      const covered = new Set(
        row.coveredPresetIds.filter((id): id is string => typeof id === "string"),
      );
      const expected = expectedByName.get(studentName)!;
      if ([...expected].some(id => !covered.has(id))) return [];

      const suggestion = feedback.trim();
      return [{
        studentName,
        feedback: suggestion.startsWith("建议") ? suggestion : `建议${suggestion}`,
      }];
    });
  } finally {
    clearTimeout(timeout);
  }
}
