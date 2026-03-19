import { useState } from "react";
import { useExamParser, useExamTypes, useExamConfigs, useCsvExport } from "@/hooks/use-exam";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Code2, 
  FileCheck2, 
  Download, 
  AlertCircle, 
  Loader2,
  Users,
  Target,
  ChevronRight,
  ClipboardPaste,
  Bookmark,
  Settings2,
} from "lucide-react";
import type { ParseExamResponse, StudentResult } from "@workspace/api-client-react";
import { Link } from "wouter";

type InputMode = "html" | "json";

export default function ParserPage() {
  const [htmlInput, setHtmlInput] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("html");
  const [parsedData, setParsedData] = useState<ParseExamResponse | null>(null);
  const [selectedConfigName, setSelectedConfigName] = useState<string>("");
  
  const { toast } = useToast();
  const parseMutation = useExamParser();
  const exportService = useCsvExport();
  const { data: configsData } = useExamConfigs();
  const { data: typesData } = useExamTypes(selectedConfigName || undefined);

  const configs = configsData?.configs || [];

  const handleParseHtml = async () => {
    if (!htmlInput.trim()) {
      toast({ title: "无内容", description: "请先粘贴需要解析的网页 HTML 代码", variant: "destructive" });
      return;
    }
    try {
      const result = await parseMutation.mutateAsync({ data: { html: htmlInput } });
      setParsedData(result);
      toast({ title: "解析成功", description: `成功提取 ${result.totalStudents} 名学生的数据` });
    } catch {
      toast({ title: "解析失败", description: "无法解析该 HTML，请改用「书签工具」提取数据", variant: "destructive" });
    }
  };

  const handleParseJson = () => {
    if (!jsonInput.trim()) {
      toast({ title: "无内容", description: "请粘贴从书签工具复制的 JSON 数据", variant: "destructive" });
      return;
    }
    try {
      const data = JSON.parse(jsonInput.trim()) as ParseExamResponse;
      if (!data.students || !Array.isArray(data.students)) {
        throw new Error("格式不正确");
      }
      const normalized: ParseExamResponse = {
        examTitle: data.examTitle,
        totalStudents: data.students.length,
        students: data.students.map((s: StudentResult) => ({
          studentName: s.studentName,
          wrongQuestions: (s.wrongQuestions || []).map(Number).filter(n => !isNaN(n)),
          totalQuestions: s.totalQuestions,
          score: s.score,
        })),
      };
      setParsedData(normalized);
      toast({ title: "导入成功", description: `成功导入 ${normalized.totalStudents} 名学生的数据` });
    } catch {
      toast({ title: "格式错误", description: "JSON 格式不正确，请重新从书签工具复制", variant: "destructive" });
    }
  };

  const handleExport = async () => {
    if (!parsedData) return;
    try {
      await exportService.downloadCsv({
        students: parsedData.students,
        examTitle: parsedData.examTitle,
        questionTypeMappings: typesData?.mappings || []
      }, `${parsedData.examTitle || '模考结果'}.csv`);
      toast({ title: "导出成功", description: "CSV 文件已开始下载" });
    } catch {
      toast({ title: "导出失败", description: "生成 CSV 文件时发生错误", variant: "destructive" });
    }
  };

  const getQuestionType = (qNum: number) => {
    if (!typesData?.mappings) return null;
    return typesData.mappings.find(m => m.questionNumber === qNum) || null;
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Input Section */}
      <section className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
        {/* Mode tabs */}
        <div className="flex items-center gap-1 mb-6 p-1 bg-muted/50 rounded-xl w-fit">
          <button
            onClick={() => setInputMode("html")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              inputMode === "html" 
                ? "bg-card text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code2 className="w-4 h-4" />
            HTML 模式
          </button>
          <button
            onClick={() => setInputMode("json")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              inputMode === "json" 
                ? "bg-card text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardPaste className="w-4 h-4" />
            粘贴 JSON 模式
          </button>
        </div>

        {inputMode === "html" ? (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg text-primary flex-shrink-0">
                <Code2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">网页源代码输入</h2>
                <p className="text-sm text-muted-foreground">
                  将老师管理后台模考结果页的完整 HTML 粘贴于此。若页面需要登录，请改用{" "}
                  <Link href="/bookmarklet" className="text-primary underline underline-offset-2">书签工具</Link>。
                </p>
              </div>
            </div>
            <textarea
              value={htmlInput}
              onChange={(e) => setHtmlInput(e.target.value)}
              placeholder="<html>...</html>"
              className="w-full h-48 md:h-64 p-4 rounded-xl bg-secondary/30 border border-border/60 font-mono text-sm text-foreground/80 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
            />
            <div className="mt-4 flex items-center justify-between">
              <Link href="/bookmarklet" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                <Bookmark className="w-3.5 h-3.5" />
                页面需要登录？使用书签工具提取
              </Link>
              <button
                onClick={handleParseHtml}
                disabled={parseMutation.isPending || !htmlInput.trim()}
                className="px-6 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all flex items-center gap-2"
              >
                {parseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
                {parseMutation.isPending ? "解析中..." : "开始解析"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 flex-shrink-0">
                <ClipboardPaste className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">粘贴 JSON 数据</h2>
                <p className="text-sm text-muted-foreground">
                  使用{" "}
                  <Link href="/bookmarklet" className="text-primary underline underline-offset-2">书签工具</Link>
                  {" "}在已登录的教师后台提取数据后，粘贴到此处
                </p>
              </div>
            </div>

            <div className="mb-4 flex items-start gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
              <Bookmark className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
              <div className="space-y-1">
                <p className="font-semibold">使用方式：</p>
                <p>1. 先前往「书签工具」页添加书签 → 2. 在教师后台点击该书签 → 3. 数据自动复制到剪贴板 → 4. 在下方按 Ctrl+V 粘贴</p>
              </div>
            </div>

            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder={`{\n  "examTitle": "2025 SAT 模考",\n  "students": [\n    { "studentName": "张三", "wrongQuestions": [1, 5, 12] }\n  ]\n}`}
              className="w-full h-48 md:h-64 p-4 rounded-xl bg-secondary/30 border border-border/60 font-mono text-sm text-foreground/80 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all resize-none"
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleParseJson}
                disabled={!jsonInput.trim()}
                className="px-6 py-2.5 rounded-xl font-medium bg-emerald-600 text-white shadow-sm hover:shadow-md hover:bg-emerald-700 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all flex items-center gap-2"
              >
                <ClipboardPaste className="w-4 h-4" />
                导入数据
              </button>
            </div>
          </>
        )}
      </section>

      {/* Results Section */}
      <AnimatePresence mode="wait">
        {parsedData ? (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-6"
          >
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-card p-5 rounded-2xl shadow-sm border border-border/50 flex flex-col justify-center">
                <span className="text-sm text-muted-foreground font-medium mb-1">考试名称</span>
                <span className="text-base font-bold text-foreground truncate" title={parsedData.examTitle || "未识别到标题"}>
                  {parsedData.examTitle || "未识别到标题"}
                </span>
              </div>
              <div className="bg-card p-5 rounded-2xl shadow-sm border border-border/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm text-muted-foreground font-medium block">学生数量</span>
                  <span className="text-2xl font-bold text-foreground">
                    {parsedData.totalStudents} <span className="text-sm font-normal text-muted-foreground ml-1">人</span>
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
                      ? Math.round((parsedData.students.reduce((acc, s) => acc + s.wrongQuestions.length, 0) / parsedData.totalStudents) * 10) / 10
                      : 0}
                    <span className="text-sm font-normal text-muted-foreground ml-1">题</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Config selector + export */}
            <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-5 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Settings2 className="w-4 h-4 text-primary" />
                选择题型配置：
              </div>
              <div className="flex-1 min-w-[200px]">
                <select
                  value={selectedConfigName}
                  onChange={(e) => setSelectedConfigName(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                >
                  <option value="">— 不使用题型标注 —</option>
                  {configs.map(cfg => (
                    <option key={cfg.name} value={cfg.name}>{cfg.name}（{cfg.count} 题）</option>
                  ))}
                </select>
              </div>
              {configs.length === 0 && (
                <Link href="/question-types" className="text-xs text-primary underline underline-offset-2 hover:text-primary/80">
                  前往设置题型配置 →
                </Link>
              )}
              <div className="ml-auto">
                <button
                  onClick={handleExport}
                  disabled={exportService.isPending}
                  className="px-4 py-2 rounded-lg font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-2 text-sm transition-colors"
                >
                  {exportService.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  导出 CSV
                  {selectedConfigName && <span className="text-xs text-muted-foreground ml-1">(含题型标注)</span>}
                </button>
              </div>
            </div>

            {/* Detail table */}
            <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-border/50 flex items-center justify-between bg-card">
                <h3 className="text-base font-bold text-foreground">错题明细表</h3>
                {selectedConfigName && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    已应用配置：{selectedConfigName}
                  </span>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
                    <tr>
                      <th className="px-6 py-4 font-medium">学生姓名</th>
                      <th className="px-6 py-4 font-medium text-center">错题数量</th>
                      <th className="px-6 py-4 font-medium">错题号及题型</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {parsedData.students.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">
                          没有解析到学生数据
                        </td>
                      </tr>
                    ) : (
                      parsedData.students.map((student, idx) => (
                        <motion.tr 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          key={idx} 
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                            {student.studentName}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full font-medium text-xs ${
                              student.wrongQuestions.length === 0 
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-rose-50 text-rose-600"
                            }`}>
                              {student.wrongQuestions.length === 0 ? "全对 🎉" : `${student.wrongQuestions.length} 题`}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {student.wrongQuestions.length === 0 ? (
                                <span className="text-emerald-500 text-xs font-medium">—</span>
                              ) : (
                                student.wrongQuestions.map((q) => {
                                  const entry = getQuestionType(q);
                                  return (
                                    <span key={q} className="inline-flex items-center rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground gap-1">
                                      <span className="text-muted-foreground">Q{q}</span>
                                      {entry && (
                                        <>
                                          <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                                          <span className="text-primary/80">{entry.questionType}</span>
                                          {entry.module && (
                                            <span className="text-muted-foreground/60 text-[10px]">({entry.module})</span>
                                          )}
                                        </>
                                      )}
                                    </span>
                                  );
                                })
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
              粘贴 HTML 或使用书签工具提取 JSON 数据后，点击解析即可查看错题明细，并支持与预设题型自动匹配。
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
