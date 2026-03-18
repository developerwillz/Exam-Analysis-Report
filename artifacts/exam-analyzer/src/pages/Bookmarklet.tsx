import { useState } from "react";
import { Bookmark, Copy, Check, ChevronRight, MousePointerClick, ClipboardPaste, Chrome, GripHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// The bookmarklet script that runs on veritas.xiaosaas.com
const BOOKMARKLET_SCRIPT = `javascript:(function(){
var students=[];var examTitle='';
try{
  var allText=document.querySelectorAll('p,span,div,h1,h2,h3,h4');
  for(var i=0;i<allText.length;i++){
    var t=allText[i].innerText||'';
    if(t.match(/(真题|模考|SAT|TOEFL|托福|雅思|Module)/i)&&t.length>5&&t.length<100){
      examTitle=t.trim();break;
    }
  }
} catch(e){}
try{
  var tables=document.querySelectorAll('.el-table');
  tables.forEach(function(table){
    var headerCells=table.querySelectorAll('.el-table__header th');
    var qNums=[];
    headerCells.forEach(function(th,i){
      var t=(th.innerText||'').trim();
      if(/^\d+$/.test(t))qNums.push({col:i,num:parseInt(t)});
    });
    if(qNums.length<2)return;
    var rows=table.querySelectorAll('.el-table__body-wrapper tr');
    rows.forEach(function(row){
      var cells=row.querySelectorAll('td');
      if(cells.length<2)return;
      var name=(cells[0].innerText||'').trim();
      if(!name||name.length<2||name.length>20)return;
      var wrongQs=[];
      qNums.forEach(function(q){
        var cell=cells[q.col];
        if(!cell)return;
        var html=cell.innerHTML||'';
        var text=(cell.innerText||'').trim();
        if(html.match(/color\s*:\s*(red|#[Ff][0-9a-fA-F]{4,5}|rgb\(24[0-9]|rgb\(25[0-5])/)||
           text==='\u00d7'||text==='\u2717'||text==='\u274c'||
           cell.classList.contains('wrong')||cell.classList.contains('error')){
          wrongQs.push(q.num);
        }
      });
      if(name&&!students.find(function(s){return s.studentName===name;})){
        students.push({studentName:name,wrongQuestions:wrongQs});
      }
    });
  });
} catch(e){}
if(students.length===0){
  try{
    var rows2=document.querySelectorAll('tr');
    rows2.forEach(function(row){
      var cells=row.querySelectorAll('td');
      if(cells.length<3)return;
      var name=(cells[0].innerText||'').trim();
      if(!name||name.length<2||!/[\u4e00-\u9fa5A-Za-z]/.test(name))return;
      var wrongQs=[];
      for(var i=1;i<cells.length;i++){
        var cell=cells[i];
        var html=cell.innerHTML||'';
        var text=(cell.innerText||'').trim();
        if(html.match(/color\s*:\s*(red|#[Ff][0-9a-fA-F]{4})/)||
           text==='\u00d7'||text==='\u2717'||text==='0'){
          wrongQs.push(i);
        }
      }
      if(!students.find(function(s){return s.studentName===name;})){
        students.push({studentName:name,wrongQuestions:wrongQs});
      }
    });
  } catch(e){}
}
var result=JSON.stringify({examTitle:examTitle,students:students,totalStudents:students.length});
function done(){
  if(students.length>0){
    alert('\u2705 \u5df2\u590d\u5236 '+students.length+' \u540d\u5b66\u751f\u7684\u6570\u636e\uff01\n\u8bf7\u8fd4\u56de\u5206\u6790\u5de5\u5177\uff0c\u70b9\u51fb\u300c\u7c98\u8d34 JSON \u6a21\u5f0f\u300d\u8fdb\u884c\u7c98\u8d34\u3002');
  }else{
    alert('\u26a0\ufe0f \u672a\u627e\u5230\u5b66\u751f\u6210\u7ee9\u6570\u636e\u3002\n\u8bf7\u786e\u8ba4\u5df2\u5207\u6362\u5230\u6a21\u8003\u6210\u7ee9\u8be6\u60c5\u9875\uff0c\u518d\u6b21\u70b9\u51fb\u4e66\u7b7e\u3002');
  }
}
if(navigator.clipboard){
  navigator.clipboard.writeText(result).then(done).catch(function(){
    var ta=document.createElement('textarea');
    ta.value=result;document.body.appendChild(ta);ta.select();
    document.execCommand('copy');document.body.removeChild(ta);done();
  });
}else{
  var ta=document.createElement('textarea');
  ta.value=result;document.body.appendChild(ta);ta.select();
  document.execCommand('copy');document.body.removeChild(ta);done();
}
})();`;

const STEPS = [
  {
    icon: GripHorizontal,
    title: "拖动书签到书签栏",
    desc: "将下方橙色「提取成绩数据」按钮用鼠标拖动到浏览器顶部的书签栏（需先按 Ctrl+Shift+B 显示书签栏）",
  },
  {
    icon: Chrome,
    title: "在教师后台打开成绩页",
    desc: "登录 veritas.xiaosaas.com，进入对应班级的模考作业，切换到「已批改」成绩详情页",
  },
  {
    icon: MousePointerClick,
    title: "点击书签栏中的「提取成绩数据」",
    desc: "在教师后台页面点击刚才保存到书签栏的书签，脚本会自动提取数据并弹出确认",
  },
  {
    icon: ClipboardPaste,
    title: "返回本工具粘贴 JSON",
    desc: "回到本页，进入「解析页面」→ 切换到「粘贴 JSON 模式」→ Ctrl+V 粘贴 → 点击导入",
  },
];

export default function BookmarkletPage() {
  const [copied, setCopied] = useState(false);
  const [showDragTip, setShowDragTip] = useState(false);
  const { toast } = useToast();

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(BOOKMARKLET_SCRIPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "脚本已复制",
        description: "请在浏览器书签管理器中新建书签，将此代码粘贴到网址栏",
      });
    } catch {
      toast({ title: "复制失败", description: "请手动选择下方文本框内容并复制", variant: "destructive" });
    }
  };

  const handleBookmarkletClick = (e: React.MouseEvent) => {
    // When clicked in our app (not on the teacher page), show instructions
    e.preventDefault();
    setShowDragTip(true);
    toast({
      title: "请拖动，不要点击 👆",
      description: "在本页面上，该按钮需要被拖动到书签栏。登录教师后台后再点击书签栏中的按钮才能提取数据。",
    });
    setTimeout(() => setShowDragTip(false), 4000);
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bookmark className="w-6 h-6 text-primary" />
          书签提取工具
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          教师后台需要登录，书签工具让你在已登录的浏览器页面上直接一键提取成绩数据
        </p>
      </div>

      {/* Important notice */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
        <div>
          <strong>重要：</strong>下方橙色按钮需要用鼠标<strong>拖动</strong>到书签栏，而不是在此页面点击。添加到书签栏后，在教师后台页面点击才能发挥作用。
        </div>
      </div>

      {/* Drag target */}
      <div className={`relative bg-gradient-to-br from-orange-50 to-amber-50 border-2 ${showDragTip ? 'border-orange-400' : 'border-orange-200'} rounded-2xl p-8 flex flex-col items-center gap-5 transition-colors`}>
        <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
          <GripHorizontal className="w-4 h-4" />
          第一步：将下方按钮拖动到浏览器书签栏
        </div>

        {/* Animated arrow */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-2xl animate-bounce">☝️</div>
          <p className="text-xs text-orange-600 font-medium">书签栏在浏览器顶部（Ctrl+Shift+B 显示）</p>
        </div>

        {/* The bookmarklet link */}
        <a
          href={BOOKMARKLET_SCRIPT}
          className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-orange-200 cursor-grab active:cursor-grabbing select-none flex items-center gap-3 transition-colors"
          onClick={handleBookmarkletClick}
          draggable
        >
          <Bookmark className="w-5 h-5" />
          📋 提取成绩数据
        </a>

        <p className="text-xs text-orange-600/80 text-center max-w-sm">
          ↑ 按住此按钮，拖动到浏览器顶部书签栏后松开鼠标
        </p>

        {/* Divider */}
        <div className="w-full border-t border-orange-200 pt-4">
          <p className="text-xs text-center text-orange-700/70 mb-3 font-medium">
            拖动不成功？改用手动方式：复制脚本代码 → 浏览器书签栏右键「添加书签」→ 将代码粘贴到网址栏
          </p>
          <div className="flex justify-center">
            <button
              onClick={handleCopyScript}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-orange-300 text-orange-700 hover:bg-orange-50 transition-colors shadow-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "已复制脚本代码" : "复制脚本代码"}
            </button>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-bold text-foreground">完整使用步骤</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STEPS.map((step, i) => (
            <div key={i} className="flex gap-4 p-5 bg-card rounded-xl border border-border/50 shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <step.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-primary/70 bg-primary/10 rounded px-1.5 py-0.5">步骤 {i + 1}</span>
                  <span className="text-sm font-bold text-foreground">{step.title}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 p-4 bg-muted/50 border border-border/50 rounded-xl text-xs text-muted-foreground">
        <span className="text-base">🔒</span>
        <div>
          <strong className="text-foreground">安全说明：</strong>书签脚本仅在你的本地浏览器运行，只读取当前页面可见的成绩表格数据，不会上传任何 Cookie、密码或登录信息。
        </div>
      </div>
    </div>
  );
}
