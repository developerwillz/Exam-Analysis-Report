import { useState, useEffect } from "react";
import { useExamConfigs, useExamTypes, useSaveExamTypes, useDeleteExamConfig } from "@/hooks/use-exam";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings2, Plus, Trash2, Save, Loader2, Info, FilePlus2, ChevronRight, AlertTriangle
} from "lucide-react";
import type { QuestionTypeEntry } from "@workspace/api-client-react";

const MODULE_OPTIONS = ["", "Module 1", "Module 2"];

interface RowEntry extends QuestionTypeEntry {
  module?: string;
  keyPoint?: string;
}

export default function QuestionTypesPage() {
  const { data: configsData, isLoading: configsLoading } = useExamConfigs();
  const saveMutation = useSaveExamTypes();
  const deleteMutation = useDeleteExamConfig();
  const { toast } = useToast();

  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [mappings, setMappings] = useState<RowEntry[]>([]);
  const [configName, setConfigName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: typeData, isLoading: typeLoading } = useExamTypes(
    selectedConfig ?? undefined
  );

  // When a config is selected, load its rows into the editor
  useEffect(() => {
    if (typeData && selectedConfig !== null && !isCreatingNew) {
      setMappings(
        (typeData.mappings as RowEntry[]).sort((a, b) => a.questionNumber - b.questionNumber)
      );
      setConfigName(typeData.name || selectedConfig);
    }
  }, [typeData, selectedConfig, isCreatingNew]);

  const startNew = () => {
    setSelectedConfig(null);
    setIsCreatingNew(true);
    setMappings([]);
    setConfigName("");
  };

  const selectConfig = (name: string) => {
    setIsCreatingNew(false);
    setSelectedConfig(name);
  };

  const handleAdd = () => {
    const nextQ = mappings.length > 0 ? Math.max(...mappings.map(m => m.questionNumber)) + 1 : 1;
    setMappings([...mappings, { questionNumber: nextQ, questionType: "", module: "Module 1", keyPoint: "" }]);
  };

  const handleRemove = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, field: keyof RowEntry, value: string | number) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    setMappings(updated);
  };

  const handleSave = async () => {
    const name = configName.trim();
    if (!name) {
      toast({ title: "请填写配置名称", variant: "destructive" });
      return;
    }
    const validMappings = mappings.filter(m => m.questionNumber > 0 && m.questionType.trim() !== "");
    const qNums = validMappings.map(m => m.questionNumber);
    if (qNums.length !== new Set(qNums).size) {
      toast({ title: "存在重复题号", description: "每个题号只能对应一个题型", variant: "destructive" });
      return;
    }
    try {
      await saveMutation.mutateAsync({
        data: { name, mappings: validMappings }
      });
      toast({ title: "保存成功", description: `配置「${name}」已保存 ${validMappings.length} 条映射` });
      setIsCreatingNew(false);
      setSelectedConfig(name);
    } catch {
      toast({ title: "保存失败", description: "网络错误或服务端异常", variant: "destructive" });
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteMutation.mutateAsync({ name });
      toast({ title: "已删除", description: `配置「${name}」已删除` });
      if (selectedConfig === name) {
        setSelectedConfig(null);
        setIsCreatingNew(false);
        setMappings([]);
        setConfigName("");
      }
    } catch {
      toast({ title: "删除失败", variant: "destructive" });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const configs = configsData?.configs || [];
  const showEditor = isCreatingNew || selectedConfig !== null;
  const editorLoading = !isCreatingNew && typeLoading && selectedConfig !== null;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-primary" />
            题型匹配设置
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            保存多套题号→知识点映射，解析时按需选择应用于导出 CSV。
          </p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-0.5 transition-all text-sm"
        >
          <FilePlus2 className="w-4 h-4" />
          新建配置
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5 items-start">
        {/* Left: Saved configs list */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
            <span className="text-sm font-semibold text-foreground">已保存配置</span>
            <span className="ml-2 text-xs text-muted-foreground">({configs.length} 套)</span>
          </div>
          {configsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : configs.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground px-4">
              暂无配置，点击「新建配置」开始
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {configs.map((cfg) => (
                <li key={cfg.name}>
                  <div
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors group ${
                      selectedConfig === cfg.name && !isCreatingNew
                        ? "bg-primary/8 border-l-2 border-primary"
                        : "hover:bg-muted/40"
                    }`}
                    onClick={() => selectConfig(cfg.name)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                        selectedConfig === cfg.name && !isCreatingNew ? "text-primary" : "text-muted-foreground/40"
                      }`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{cfg.name}</p>
                        <p className="text-xs text-muted-foreground">{cfg.count} 题</p>
                      </div>
                    </div>
                    {deleteConfirm === cfg.name ? (
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(cfg.name)}
                          disabled={deleteMutation.isPending}
                          className="text-xs px-2 py-1 rounded bg-destructive text-white hover:bg-destructive/90 transition-colors"
                        >
                          确认
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(cfg.name); }}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                        title="删除配置"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: Editor */}
        <AnimatePresence mode="wait">
          {!showEditor ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card rounded-2xl border border-dashed border-border shadow-sm flex flex-col items-center justify-center py-16 text-center px-6"
            >
              <Settings2 className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">从左侧选择配置查看或编辑</p>
              <p className="text-xs text-muted-foreground/70 mt-1">或点击「新建配置」创建新的映射</p>
            </motion.div>
          ) : editorLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card rounded-2xl border border-border/50 shadow-sm flex items-center justify-center py-20"
            >
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </motion.div>
          ) : (
            <motion.div
              key={selectedConfig ?? "new"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden"
            >
              {/* Editor header */}
              <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">配置名称</label>
                  <input
                    type="text"
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    placeholder="如: 2025 SAT Module 1"
                    className="w-full max-w-xs px-3 py-2 rounded-lg bg-background border border-border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  保存
                </button>
              </div>

              {/* Hint */}
              <div className="mx-6 mt-4 flex items-start gap-2 p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs text-blue-800">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                <p>填写题号、对应的考察知识点（如「词汇题」「代数」），并选择 Module。解析错题后导出 CSV 时会自动打标签。</p>
              </div>

              {/* Table */}
              <div className="px-6 py-4">
                {/* Column headers */}
                <div className="grid grid-cols-[72px_1fr_1fr_130px_36px] gap-2 px-1 mb-2 text-xs font-medium text-muted-foreground">
                  <div>题号</div>
                  <div>考察知识点 / 题型名称</div>
                  <div>考点</div>
                  <div>Module</div>
                  <div></div>
                </div>

                <div className="space-y-2">
                  <AnimatePresence>
                    {mappings.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-8 text-center text-muted-foreground text-sm bg-muted/20 rounded-xl border border-dashed border-border"
                      >
                        暂无题型映射，点击下方按钮添加
                      </motion.div>
                    ) : (
                      mappings.map((row, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="grid grid-cols-[72px_1fr_1fr_130px_36px] gap-2 items-center"
                        >
                          <input
                            type="number"
                            min="1"
                            value={row.questionNumber || ""}
                            onChange={(e) => handleUpdate(idx, "questionNumber", parseInt(e.target.value) || 0)}
                            placeholder="1"
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                          />
                          <input
                            type="text"
                            value={row.questionType}
                            onChange={(e) => handleUpdate(idx, "questionType", e.target.value)}
                            placeholder="如: 词汇、代数…"
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                          />
                          <input
                            type="text"
                            value={row.keyPoint || ""}
                            onChange={(e) => handleUpdate(idx, "keyPoint", e.target.value)}
                            placeholder="如: 同义替换、二次方程…"
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                          />
                          <select
                            value={row.module || ""}
                            onChange={(e) => handleUpdate(idx, "module", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                          >
                            {MODULE_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt || "— 不指定 —"}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleRemove(idx)}
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={handleAdd}
                  className="mt-3 w-full py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  添加一行
                </button>
              </div>

              {/* Warning if unsaved changes hint */}
              {isCreatingNew && (
                <div className="mx-6 mb-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                  新配置尚未保存，请填写名称后点击「保存」
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
