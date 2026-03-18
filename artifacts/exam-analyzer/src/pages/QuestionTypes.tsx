import { useState, useEffect } from "react";
import { useExamTypes, useSaveExamTypes } from "@/hooks/use-exam";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Settings2, Plus, Trash2, Save, Loader2, Info } from "lucide-react";
import type { QuestionTypeEntry } from "@workspace/api-client-react";

export default function QuestionTypesPage() {
  const { data, isLoading } = useExamTypes();
  const saveMutation = useSaveExamTypes();
  const { toast } = useToast();

  const [mappings, setMappings] = useState<QuestionTypeEntry[]>([]);
  const [configName, setConfigName] = useState("");

  // Sync incoming data to local state
  useEffect(() => {
    if (data?.mappings) {
      setMappings(data.mappings.sort((a, b) => a.questionNumber - b.questionNumber));
    }
    if (data?.name) {
      setConfigName(data.name);
    }
  }, [data]);

  const handleAdd = () => {
    const nextQ = mappings.length > 0 ? Math.max(...mappings.map(m => m.questionNumber)) + 1 : 1;
    setMappings([...mappings, { questionNumber: nextQ, questionType: "" }]);
  };

  const handleRemove = (index: number) => {
    const newMappings = [...mappings];
    newMappings.splice(index, 1);
    setMappings(newMappings);
  };

  const handleUpdate = (index: number, field: keyof QuestionTypeEntry, value: string | number) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
  };

  const handleSave = async () => {
    // Basic validation
    const validMappings = mappings.filter(m => m.questionNumber > 0 && m.questionType.trim() !== "");
    
    // Check for duplicates
    const qNums = validMappings.map(m => m.questionNumber);
    const uniqueNums = new Set(qNums);
    if (qNums.length !== uniqueNums.size) {
      toast({
        title: "存在重复题号",
        description: "每个题号只能对应一个题型，请检查后重试。",
        variant: "destructive"
      });
      return;
    }

    try {
      await saveMutation.mutateAsync({
        data: {
          name: configName.trim() || "默认模考配置",
          mappings: validMappings
        }
      });
      toast({
        title: "保存成功",
        description: `已更新 ${validMappings.length} 个题型映射`,
      });
    } catch (error) {
      toast({
        title: "保存失败",
        description: "网络错误或服务端异常",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-primary" />
            题型匹配设置
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            设置每道题对应的考察知识点。解析错题后导出 CSV 时会自动带上这些标签。
          </p>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="px-6 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存配置
        </button>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6">
        <div className="mb-6 max-w-md">
          <label className="block text-sm font-medium text-foreground mb-1.5">
            配置名称
          </label>
          <input
            type="text"
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
            placeholder="例如: 2025 SAT 模考一"
            className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
          />
        </div>

        <div className="bg-blue-50/50 text-blue-800 text-sm p-4 rounded-xl mb-6 flex items-start gap-3 border border-blue-100">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
          <p>添加题号及对应的知识点/题型。在导出分析报表时，系统会根据学生错的题号自动填入这里设置的题型。</p>
        </div>

        <div className="space-y-3 mb-6">
          <div className="grid grid-cols-[100px_1fr_40px] gap-4 px-2 text-sm font-medium text-muted-foreground">
            <div>题号</div>
            <div>考察知识点 / 题型名称</div>
            <div className="text-center">操作</div>
          </div>
          
          <AnimatePresence>
            {mappings.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="py-8 text-center text-muted-foreground text-sm bg-muted/20 rounded-xl border border-dashed border-border"
              >
                暂无题型配置，点击下方按钮添加
              </motion.div>
            ) : (
              mappings.map((mapping, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid grid-cols-[100px_1fr_40px] gap-4 items-center group"
                >
                  <input
                    type="number"
                    min="1"
                    value={mapping.questionNumber || ""}
                    onChange={(e) => handleUpdate(idx, "questionNumber", parseInt(e.target.value) || 0)}
                    placeholder="如: 1"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  />
                  <input
                    type="text"
                    value={mapping.questionType}
                    onChange={(e) => handleUpdate(idx, "questionType", e.target.value)}
                    placeholder="如: 词汇题、阅读理解、代数..."
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  />
                  <button
                    onClick={() => handleRemove(idx)}
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
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
          className="w-full py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加新题型映射
        </button>
      </div>
    </div>
  );
}
