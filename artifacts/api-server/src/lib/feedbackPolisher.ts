type Student = { studentName: string; wrongQuestions: number[] };
type Mapping = {
  questionNumber: number;
  questionType: string;
  module?: string;
  keyPoint?: string;
};

type PreparedQuestion = {
  presetId: string;
  questionNumber: number;
  module: string;
  questionType: string;
  preset: string;
};

type PreparedStudent = {
  studentId: string;
  studentName: string;
  wrongQuestions: PreparedQuestion[];
};

export type PolishedFeedback = { studentName: string; feedback: string };

const ZHIPU_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

function getDeepSeekModel(): string {
  const configured = process.env.DEEPSEEK_MODEL?.trim();
  if (!configured) return DEFAULT_DEEPSEEK_MODEL;
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(configured)) {
    throw new Error("Invalid DEEPSEEK_MODEL configuration");
  }
  return configured;
}

const SYSTEM_PROMPT = [
  "你是一名 SAT 阅读教师，只负责把结构化反馈预设整理成自然、具体的中文学习建议。",
  "输入仅含匿名 studentId，不得猜测或添加学生姓名。姓名、Module、错题数量和题型分布将由程序另行添加。",
  "feedback 中不得重复 Module、错题数量和题型分布；studentId 必须与输入完全一致。",
  "必须覆盖每一道输入题目的 presetId。内容实质相同的预设可以合并表达，但 coveredPresetIds 仍须列出对应的全部 ID。",
  "不同的方法、关键词和解题要求不得合并或省略。例如“提取变量”和“破坏前提”必须同时保留。",
  "只能使用输入提供的题型和反馈预设，不得虚构学生能力、态度、成绩或答题过程；英文关键词必须原样保留。",
  "消除“注意注意”“推理题注意推理题”等重复措辞。建议要有清晰的题型归属，语气温和自然，长度按信息量控制在 80 至 300 个汉字。",
  "feedback 必须以“建议”开头，只写学习建议。",
  "严格返回 JSON：{\"feedbacks\":[{\"studentId\":\"S1\",\"feedback\":\"建议……\",\"coveredPresetIds\":[\"Q1\",\"Q2\"]}]}，不得输出其他内容。",
].join("\n");

function prepareStudents(students: Student[], mappings: Mapping[]): PreparedStudent[] {
  const mappingByQuestion = new Map(mappings.map(entry => [entry.questionNumber, entry]));

  return students.flatMap((student, index) => {
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

    return matched.length > 0 ? [{
      studentId: `S${index + 1}`,
      studentName: student.studentName,
      wrongQuestions: matched,
    }] : [];
  });
}

function modelInput(input: PreparedStudent[]) {
  return {
    students: input.map(({ studentId, wrongQuestions }) => ({ studentId, wrongQuestions })),
  };
}

function parseModelJson(content: string): unknown {
  const withoutFence = content.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(withoutFence);
}

function validateFeedbacks(content: string, input: PreparedStudent[]): PolishedFeedback[] {
  const parsed = parseModelJson(content) as { feedbacks?: unknown };
  if (!Array.isArray(parsed.feedbacks)) throw new Error("Invalid feedback response shape");

  const expectedById = new Map(input.map(student => [
    student.studentId,
    {
      studentName: student.studentName,
      presetIds: new Set(student.wrongQuestions.map(question => question.presetId)),
    },
  ]));

  return parsed.feedbacks.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.studentId !== "string" ||
      typeof row.feedback !== "string" ||
      !Array.isArray(row.coveredPresetIds)
    ) return [];

    const expected = expectedById.get(row.studentId);
    const feedback = row.feedback.trim();
    if (
      !expected ||
      !feedback ||
      /Module|错了\s*\d+\s*题/i.test(feedback)
    ) return [];

    const covered = new Set(
      row.coveredPresetIds.filter((id): id is string => typeof id === "string"),
    );
    if ([...expected.presetIds].some(id => !covered.has(id))) return [];

    return [{
      studentName: expected.studentName,
      feedback: feedback.startsWith("建议") ? feedback : `建议${feedback}`,
    }];
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 45_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function polishWithDeepSeek(
  input: PreparedStudent[],
  apiKey: string,
): Promise<PolishedFeedback[]> {
  const model = getDeepSeekModel();
  const response = await fetchWithTimeout(DEEPSEEK_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      thinking: { type: "disabled" },
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(modelInput(input)) },
      ],
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`DeepSeek API ${response.status} (${model}): ${detail}`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek API returned empty content");
  return validateFeedbacks(content, input);
}

async function polishWithZhipu(
  input: PreparedStudent[],
  apiKey: string,
): Promise<PolishedFeedback[]> {
  const response = await fetchWithTimeout(ZHIPU_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "glm-4.7-flash",
      thinking: { type: "disabled" },
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(modelInput(input)) },
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
  return validateFeedbacks(content, input);
}

export async function polishFeedback(
  students: Student[],
  mappings: Mapping[],
): Promise<PolishedFeedback[]> {
  const deepSeekApiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const zhipuApiKey = process.env.ZHIPU_API_KEY?.trim();
  if (!deepSeekApiKey && !zhipuApiKey) {
    throw new Error("No AI API key is configured");
  }

  const input = prepareStudents(students, mappings);
  if (input.length === 0) return [];

  const completed: PolishedFeedback[] = [];
  if (deepSeekApiKey) {
    try {
      const deepSeekModel = getDeepSeekModel();
      const deepSeekResults = await polishWithDeepSeek(input, deepSeekApiKey);
      completed.push(...deepSeekResults);
      console.info(
        `[feedback] DeepSeek ${deepSeekModel} accepted ${deepSeekResults.length}/${input.length}`,
      );
    } catch (error) {
      console.warn("DeepSeek feedback provider failed, falling back:", error);
    }
  }

  const completedNames = new Set(completed.map(item => item.studentName));
  const missing = input.filter(student => !completedNames.has(student.studentName));
  if (missing.length > 0 && zhipuApiKey) {
    try {
      const zhipuResults = await polishWithZhipu(missing, zhipuApiKey);
      completed.push(...zhipuResults);
      console.info(`[feedback] Zhipu accepted ${zhipuResults.length}/${missing.length}`);
    } catch (error) {
      console.warn("Zhipu feedback provider failed:", error);
    }
  }

  return completed;
}
