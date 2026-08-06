import { useState, useMemo, useEffect } from "react";
import { useExamTypes, useExamConfigs, useCsvExport, useFeedbackPolisher } from "@/hooks/use-exam";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  AlertCircle,
  Loader2,
  Users,
  Target,
  ChevronRight,
  ClipboardPaste,
  Bookmark,
  Settings2,
  Copy,
  Check,
  FileText,
  Sparkles,
} from "lucide-react";
import type { ParseExamResponse, StudentResult, QuestionTypeEntry } from "@workspace/api-client-react";
import { Link } from "wouter";

// ── Helpers ───────────────────────────────────────────────────────────────────

function distinctTypes(items: { entry: QuestionTypeEntry }[]): string[] {
  return [...new Set(items.map(({ entry }) => entry.questionType).filter(Boolean))];
}

/** 按题型分组，保留每道题的 keyPoint（有则留，无则跳过）。 */
function buildTypeKeyPoints(
  items: { q: number; entry: QuestionTypeEntry }[]
): { type: string; points: string[] }[] {
  const typeMap = new Map<string, string[]>();
  const typeOrder: string[] = [];
  for (const { entry } of items) {
    const type = entry.questionType;
    const kp = entry.keyPoint?.trim() || "";
    if (!typeMap.has(type)) {
      typeMap.set(type, []);
      typeOrder.push(type);
    }
    if (kp) typeMap.get(type)!.push(kp);
  }
  return typeOrder
    .map(type => ({
      type,
      points: [...new Set(typeMap.get(type)!.map(point => cleanPreset(point, type)))],
    }))
    .filter(({ points }) => points.length > 0);
}

/** 清理预设中与模板重复的“题型”“注意”等前缀。 */
function cleanPreset(point: string, type: string): string {
  let result = point.trim();
  const ordinalMatch = result.match(/^(第[一二三四五六七八九十百\d]+道)\s*/);
  const ordinal = ordinalMatch?.[1] || "";
  if (ordinalMatch) result = result.slice(ordinalMatch[0].length).trim();
  if (result.startsWith(type)) result = result.slice(type.length).trim();
  result = result.replace(/^(?:注意[：:、，,]?\s*)+/, "").trim();
  if (!result) return point.trim();
  return ordinal ? `${ordinal}：${result}` : result;
}

function getWrongInConfig(
  student: StudentResult,
  mappings: QuestionTypeEntry[]
): { q: number; entry: QuestionTypeEntry }[] {
  const configMap = new Map<number, QuestionTypeEntry>();
  for (const m of mappings) configMap.set(m.questionNumber, m);

  return student.wrongQuestions
    .map(q => ({ q, entry: configMap.get(q) }))
    .filter(({ entry }) => !!entry) as { q: number; entry: QuestionTypeEntry }[];
}

/** 姓名、Module、题数和题型完全由程序生成，AI 无权改写。 */
function buildFactSentence(
  student: StudentResult,
  mappings: QuestionTypeEntry[]
): string {
  const wrongInConfig = getWrongInConfig(student, mappings);

  const m1Items = wrongInConfig.filter(({ entry }) => entry.module === "Module 1");
  const m2Items = wrongInConfig.filter(({ entry }) => entry.module === "Module 2");

  let sentence = student.studentName;

  if (m1Items.length > 0 || m2Items.length > 0) {
    const parts: string[] = [];
    if (m1Items.length > 0) {
      const types = distinctTypes(m1Items);
      const connector = m1Items.length === 1 ? "是" : "涉及";
      parts.push(`在 Module 1 错了 ${m1Items.length} 题，${connector}${types.join("、")}`);
    }
    if (m2Items.length > 0) {
      const types = distinctTypes(m2Items);
      const connector = m2Items.length === 1 ? "是" : "涉及";
      const prefix = m1Items.length === 0 ? "在 " : "";
      parts.push(`${prefix}Module 2 错了 ${m2Items.length} 题，${connector}${types.join("、")}`);
    }
    sentence += parts.join("；");
  } else if (wrongInConfig.length > 0) {
    sentence += `在配置范围内错了 ${wrongInConfig.length} 题`;
  } else {
    sentence += "在本次配置范围内未出现错题";
  }

  return `${sentence}。`;
}

function buildTemplateSuggestion(
  student: StudentResult,
  mappings: QuestionTypeEntry[]
): string {
  const wrongInConfig = getWrongInConfig(student, mappings);
  const typeKeyPoints = buildTypeKeyPoints(wrongInConfig);
  if (typeKeyPoints.length === 0) return "";

  const tipParts = typeKeyPoints.map(({ type, points }) =>
    `${type}：${points.join("；")}`
  );
  return `建议：${tipParts.join("；")}。`;
}

/** 用于模板展示和复制的完整兜底反馈。 */
function buildAnalysisSentence(student: StudentResult, mappings: QuestionTypeEntry[]): string {
  return `${buildFactSentence(student, mappings)}${buildTemplateSuggestion(student, mappings)}`;
}

function countConfiguredWrongQuestions(student: StudentResult, mappings: QuestionTypeEntry[]): number {
  const configured = new Set(mappings.map(m => m.questionNumber));
  return student.wrongQuestions.filter(q => configured.has(q)).length;
}

// ── Component ─────────────────────────────────────────────────────────────────

const LS_DATA_KEY = "exam_parser_data";
const LS_CONFIG_KEY = "exam_parser_config";

function loadParsedData(): ParseExamResponse | null {
  try {
    const raw = localStorage.getItem(LS_DATA_KEY);
    return raw ? (JSON.parse(raw) as ParseExamResponse) : null;
  } catch {
    return null;
  }
}

export default function ParserPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [parsedData, setParsedData] = useState<ParseExamResponse | null>(loadParsedData);
  const [selectedConfigName, setSelectedConfigName] = useState<string>(
    () => localStorage.getItem(LS_CONFIG_KEY) ?? ""
  );
  const [copiedReport, setCopiedReport] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<Record<string, string>>({});

  // Persist parsed data across page navigation
  useEffect(() => {
    if (parsedData) {
      localStorage.setItem(LS_DATA_KEY, JSON.stringify(parsedData));
    } else {
      localStorage.removeItem(LS_DATA_KEY);
    }
  }, [parsedData]);

  useEffect(() => {
    localStorage.setItem(LS_CONFIG_KEY, selectedConfigName);
    setAiFeedback({});
  }, [selectedConfigName]);

  const { toast } = useToast();
  const exportService = useCsvExport();
  const polishService = useFeedbackPolisher();
  const { data: configsData } = useExamConfigs();
  const { data: typesData } = useExamTypes(selectedConfigName || undefined);

  const configs = configsData?.configs || [];
  const mappings: QuestionTypeEntry[] = typesData?.mappings || [];

  // Build analysis report for all students
  const analysisReport = useMemo(() => {
    if (!parsedData || mappings.length === 0) return [];
    return parsedData.students.map(s => buildAnalysisSentence(s, mappings));
  }, [parsedData, mappings]);

  const displayedReport = useMemo(() => {
    if (!parsedData) return [];
    return parsedData.students.map((student, index) =>
      aiFeedback[student.studentName]
        ? `${buildFactSentence(student, mappings)}${aiFeedback[student.studentName]}`
        : analysisReport[index] || ""
    );
  }, [parsedData, mappings, aiFeedback, analysisReport]);

  const configuredWrongTotal = useMemo(() => {
    if (!parsedData) return 0;
    return parsedData.students.reduce(
      (total, student) => total + countConfiguredWrongQuestions(student, mappings),
      0,
    );
  }, [parsedData, mappings]);

  const handleParseJson = () => {
    if (!jsonInput.trim()) {
      toast({ title: "无内容", description: "请粘贴从书签工具复制的 JSON 数据", variant: "destructive" });
      return;
    }
    try {
      const data = JSON.parse(jsonInput.trim()) as ParseExamResponse;
      if (!data.students || !Array.isArray(data.students)) throw new Error("格式不正确");
      const normalized: ParseExamResponse = {
        totalStudents: data.students.length,
        students: data.students.map((s: StudentResult) => ({
          studentName: s.studentName,
          wrongQuestions: (s.wrongQuestions || []).map(Number).filter(n => !isNaN(n)),
          totalQuestions: s.totalQuestions,
          score: s.score,
        })),
      };
      setParsedData(normalized);
      setAiFeedback({});
      toast({ title: "导入成功", description: `成功导入 ${normalized.totalStudents} 名学生的数据` });
    } catch {
      toast({ title: "格式错误", description: "JSON 格式不正确，请重新从书签工具复制", variant: "destructive" });
    }
  };

  const handlePolishFeedback = async () => {
    if (!parsedData || mappings.length === 0) return;
    try {
      const result = await polishService.mutateAsync({
        data: { students: parsedData.students, questionTypeMappings: mappings },
      });
      const next = Object.fromEntries(
        result.feedbacks.map(item => [item.studentName, item.feedback]),
      );
      setAiFeedback(next);
      toast({
        title: "AI 润色完成",
        description: `已生成 ${result.feedbacks.length} 名学生的自然版反馈，其余继续使用模板反馈`,
      });
    } catch {
      toast({
        title: "AI 润色失败",
        description: "已保留原有模板反馈，请检查智谱 API Key 或稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleExport = async () => {
    if (!parsedData) return;
    try {
      await exportService.downloadCsv({
        students: parsedData.students,
        questionTypeMappings: mappings,
      }, "模考结果.csv");
      toast({ title: "导出成功", description: "CSV 文件已开始下载" });
    } catch {
      toast({ title: "导出失败", description: "生成 CSV 文件时发生错误", variant: "destructive" });
    }
  };

  const handleCopyReport = async () => {
    const text = displayedReport.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    } catch {
      toast({ title: "复制失败", description: "请手动选中文字后复制", variant: "destructive" });
    }
  };

  const getQuestionEntry = (qNum: number) =>
    mappings.find(m => m.questionNumber === qNum) || null;

  return (
    <div className="flex flex-col gap-6 pb-12">

      {/* ── Input card ── */}
      <section className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 flex-shrink-0">
            <ClipboardPaste className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">粘贴 JSON 数据</h2>
            <p className="text-sm text-muted-foreground">
              使用{" "}
              <Link href="/bookmarklet" className="text-primary underline underline-offset-2">书签工具</Link>
              {" "}在已登录的教师后台提取数据后，将复制的 JSON 粘贴到此处。
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
          <Bookmark className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
          <p>前往「书签工具」添加书签 → 在教师后台成绩页点击书签 → 自动复制到剪贴板 → 在下方 Ctrl+V 粘贴</p>
        </div>

        {/* Config selector — top, always visible */}
        <div className="mb-4 flex flex-wrap items-center gap-3 p-3.5 bg-muted/40 border border-border/60 rounded-xl">
          <Settings2 className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-foreground">选择题型配置：</span>
          <select
            value={selectedConfigName}
            onChange={(e) => setSelectedConfigName(e.target.value)}
            className="flex-1 min-w-[180px] max-w-xs px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
          >
            <option value="">— 不使用题型标注 —</option>
            {configs.map(cfg => (
              <option key={cfg.name} value={cfg.name}>{cfg.name}（{cfg.count} 题）</option>
            ))}
          </select>
          {configs.length === 0 && (
            <Link href="/settings" className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 flex-shrink-0">
              前往设置题型配置 →
            </Link>
          )}
          {selectedConfigName && (
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium flex-shrink-0">
              已选：{selectedConfigName}
            </span>
          )}
        </div>

        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={`{\n  "students": [\n    { "studentName": "张三", "wrongQuestions": [1, 5, 12] }\n  ]\n}`}
          className="w-full h-44 p-4 rounded-xl bg-secondary/30 border border-border/60 font-mono text-sm text-foreground/80 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all resize-none"
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleParseJson}
            disabled={!jsonInput.trim()}
            className="px-6 py-2.5 rounded-xl font-medium bg-emerald-600 text-white shadow-sm hover:shadow-md hover:bg-emerald-700 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all flex items-center gap-2"
          >
            <ClipboardPaste className="w-4 h-4" />
            开始解析
          </button>
        </div>
      </section>

      {/* ── Results ── */}
      <AnimatePresence mode="wait">
        {parsedData ? (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-5"
          >
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card p-5 rounded-2xl shadow-sm border border-border/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm text-muted-foreground font-medium block">学生数量</span>
                  <span className="text-2xl font-bold text-foreground">
                    {parsedData.totalStudents}
                    <span className="text-sm font-normal text-muted-foreground ml-1">人</span>
                  </span>
                </div>
              </div>
              <div className="bg-card p-5 rounded-2xl shadow-sm border border-border/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm text-muted-foreground font-medium block">平均错题数</span>
                  <span className="text-2xl font-bold text-foreground">
                    {parsedData.totalStudents > 0
                      ? Math.round(
                          (configuredWrongTotal / parsedData.totalStudents) *
                            10
                        ) / 10
                      : 0}
                    <span className="text-sm font-normal text-muted-foreground ml-1">题（反馈范围）</span>
                  </span>
                </div>
              </div>
            </div>

            {/* ── Analysis report ── */}
            {analysisReport.length > 0 && (
              <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <h3 className="text-base font-bold text-foreground">分析报告</h3>
                    <span className="text-xs text-muted-foreground">（基于配置：{selectedConfigName}）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePolishFeedback}
                      disabled={polishService.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-60"
                    >
                      {polishService.isPending ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" />正在润色…</>
                      ) : (
                        <><Sparkles className="w-3.5 h-3.5" />{Object.keys(aiFeedback).length ? "重新润色" : "使用 AI 润色"}</>
                      )}
                    </button>
                    <button
                      onClick={handleCopyReport}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors"
                    >
                      {copiedReport ? (
                        <><Check className="w-3.5 h-3.5 text-emerald-500" />已复制</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" />一键复制</>
                      )}
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-border/40">
                  {parsedData.students.map((student, idx) => {
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="px-5 py-4 flex items-start gap-3"
                      >
                        <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        {aiFeedback[student.studentName] ? (
                          <p className="text-sm text-foreground leading-relaxed flex-1">
                            <span className="font-semibold">{buildFactSentence(student, mappings)}</span>
                            {aiFeedback[student.studentName]}
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full align-middle">
                              <Sparkles className="w-2.5 h-2.5" />AI 润色
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm text-foreground leading-relaxed flex-1">
                            {buildAnalysisSentence(student, mappings)}
                          </p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Detail table ── */}
            <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">错题明细表</h3>
                <button
                  onClick={handleExport}
                  disabled={exportService.isPending}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm transition-colors"
                >
                  {exportService.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  导出 CSV
                  {selectedConfigName && <span className="text-xs text-muted-foreground">(含题型)</span>}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
                    <tr>
                      <th className="px-5 py-3 font-medium">学生姓名</th>
                          <th className="px-5 py-3 font-medium text-center">错题数</th>
                      <th className="px-5 py-3 font-medium">错题详情</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {parsedData.students.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-10 text-center text-muted-foreground">
                          没有解析到学生数据
                        </td>
                      </tr>
                    ) : (
                      parsedData.students.map((student, idx) => (
                        <motion.tr
                          key={idx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-5 py-3.5 font-medium text-foreground whitespace-nowrap">
                            {student.studentName}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full font-medium text-xs ${
                              countConfiguredWrongQuestions(student, mappings) === 0
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-rose-50 text-rose-600"
                            }`}>
                              {countConfiguredWrongQuestions(student, mappings) === 0
                                ? "反馈范围 0 题"
                                : `${countConfiguredWrongQuestions(student, mappings)} 题`}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex flex-wrap gap-1.5">
                              {student.wrongQuestions.length === 0 ? (
                                <span className="text-emerald-500 text-xs font-medium">—</span>
                              ) : (
                                student.wrongQuestions.filter(q => getQuestionEntry(q)).map((q) => {
                                  const entry = getQuestionEntry(q);
                                  return (
                                    <span
                                      key={q}
                                      className="inline-flex items-center rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground gap-1"
                                    >
                                      <span className="text-muted-foreground">Q{q}</span>
                                      {entry && (
                                        <>
                                          <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                                          <span className="text-primary/80">{entry.questionType}</span>
                                          {entry.keyPoint && (
                                            <span className="text-violet-600/80">·{entry.keyPoint}</span>
                                          )}
                                          {entry.module && (
                                            <span className="text-muted-foreground/60 text-[10px]">({entry.module})</span>
                                          )}
                                        </>
                                      )}
                                    </span>
                                  );
                                })
                              )}
                              {student.wrongQuestions.length > countConfiguredWrongQuestions(student, mappings) && (
                                <span className="text-[10px] text-muted-foreground self-center ml-1">
                                  另有 {student.wrongQuestions.length - countConfiguredWrongQuestions(student, mappings)} 道未设反馈题
                                </span>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.section>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-16 flex flex-col items-center justify-center text-center px-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground/50 mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">等待解析数据</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              先选择题型配置，再粘贴从书签工具复制的 JSON 数据，点击「开始解析」即可查看分析报告和错题明细。
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
