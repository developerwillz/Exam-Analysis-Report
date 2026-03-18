import { useState } from "react";
import { Bookmark, Copy, Check, ChevronRight, MousePointerClick, ClipboardPaste, Chrome, GripHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Bookmarklet script — targets veritas.xiaosaas.com el-table structure.
//
// Confirmed table structure (from live HTML):
//   Student name : <span class="x-color-blue x-pointer">张润思</span>  (in fixed left column)
//   Correct cell : <span class="x-title-14 x-title-bold x-color-green">D</span>  or el-icon-check
//   Wrong cell   : <span class="x-title-14 x-title-bold x-color-red">A</span>   or el-icon-close
//   Question nums: from <th> header cells whose innerText is a bare integer
//   Column key   : CSS class matching /el-table_\d+_column_\d+/ on both <th> and <td>
// ─────────────────────────────────────────────────────────────────────────────
const BOOKMARKLET_SCRIPT = `javascript:(function(){
var students=[];
var examTitle='';

/* ── 1. Exam title ─────────────────────────────────────────── */
try{
  var els=document.querySelectorAll('p,span,div,h3,h4');
  for(var i=0;i<els.length;i++){
    var t=(els[i].innerText||'').trim();
    if(t.match(/(真题|模考|SAT|TOEFL|托福|雅思|Module)/i)&&t.length>5&&t.length<150&&els[i].children.length===0){
      examTitle=t;break;
    }
  }
}catch(e){}

/* ── 2. Process each el-table on the page ──────────────────── */
var tableEls=document.querySelectorAll('.el-table');
tableEls.forEach(function(tableEl){

  /* Build: columnClass → questionNumber  (from header th cells) */
  var colToQ={};
  var headerThs=tableEl.querySelectorAll('.el-table__header th');
  headerThs.forEach(function(th){
    var txt=(th.innerText||'').trim();
    if(!/^\d+$/.test(txt))return;
    var qNum=parseInt(txt);
    th.classList.forEach(function(c){
      if(/^el-table_\d+_column_\d+$/.test(c))colToQ[c]=qNum;
    });
  });

  /* Need at least a few question columns to be a score table */
  if(Object.keys(colToQ).length<3)return;

  /* Process body rows */
  var rows=tableEl.querySelectorAll('.el-table__body tr.el-table__row');
  rows.forEach(function(row){

    /* Student name — blue clickable span in first column */
    var nameSpan=row.querySelector('span.x-color-blue.x-pointer');
    if(!nameSpan)return;
    var name=nameSpan.innerText.trim();
    if(!name||name.length<2)return;

    /* Skip students who have not started (未开始 appears in row text) */
    if((row.innerText||'').includes('未开始'))return;

    var wrongQs=[];
    var tds=row.querySelectorAll('td');
    tds.forEach(function(td){
      /* Find this td's column class */
      var colClass=null;
      td.classList.forEach(function(c){
        if(/^el-table_\d+_column_\d+$/.test(c))colClass=c;
      });
      var qNum=colToQ[colClass];
      if(!qNum)return; /* Not a question column */

      /* Wrong answer: span with BOTH x-title-bold AND x-color-red */
      var redBold=td.querySelector('span.x-title-bold.x-color-red,span.x-color-red.x-title-bold,span.x-title-14.x-color-red');
      if(redBold)wrongQs.push(qNum);
    });

    /* Deduplicate students (table may be split into left-fixed + scrollable) */
    var existing=students.find(function(s){return s.studentName===name;});
    if(!existing){
      students.push({studentName:name,wrongQuestions:wrongQs});
    }else{
      /* Merge any extra wrong questions found in a second table section */
      wrongQs.forEach(function(q){
        if(existing.wrongQuestions.indexOf(q)===-1)existing.wrongQuestions.push(q);
      });
    }
  });
});

/* Sort wrong questions numerically for each student */
students.forEach(function(s){
  s.wrongQuestions.sort(function(a,b){return a-b;});
});

var payload=JSON.stringify({
  examTitle:examTitle,
  students:students,
  totalStudents:students.length
});

/* ── 3. Copy to clipboard ──────────────────────────────────── */
function onDone(){
  if(students.length>0){
    alert('\\u2705 \\u5df2\\u590d\\u5236 '+students.length+' \\u540d\\u5b66\\u751f\\u7684\\u6570\\u636e\\uff01\\n\\u8bf7\\u8fd4\\u56de\\u5206\\u6790\\u5de5\\u5177\\uff0c\\u9009\\u300c\\u7c98\\u8d34 JSON \\u6a21\\u5f0f\\u300d\\u7c98\\u8d34\\u5373\\u53ef\\u3002');
  }else{
    alert('\\u26a0\\ufe0f \\u672a\\u627e\\u5230\\u5b66\\u751f\\u6210\\u7ee9\\u6570\\u636e\\u3002\\n\\u8bf7\\u786e\\u8ba4\\u5df2\\u5207\\u6362\\u5230\\u6a21\\u8003\\u6210\\u7ee9\\u8be6\\u60c5\\u9875\\uff0c\\u518d\\u6b21\\u70b9\\u51fb\\u4e66\\u7b7e\\u3002');
  }
}
function fallbackCopy(){
  var ta=document.createElement('textarea');
  ta.value=payload;
  ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.focus();ta.select();
  try{document.execCommand('copy');}catch(e){}
  document.body.removeChild(ta);
  onDone();
}
if(navigator&&navigator.clipboard&&navigator.clipboard.writeText){
  navigator.clipboard.writeText(payload).then(onDone,fallbackCopy);
}else{
  fallbackCopy();
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
    desc: "登录 veritas.xiaosaas.com，进入对应班级的模考作业，切换到「已批改」成绩详情页，确保成绩表格已显示",
  },
  {
    icon: MousePointerClick,
    title: "点击书签栏中的「提取成绩数据」",
    desc: "在教师后台页面点击书签，脚本会自动扫描绿色/红色成绩格，提取错题数据并弹出"已复制"提示",
  },
  {
    icon: ClipboardPaste,
    title: "返回本工具粘贴 JSON",
    desc: "回到本页，进入「解析页面」→ 切换到「粘贴 JSON 模式」→ Ctrl+V 粘贴 → 点击「导入数据」",
  },
];

export default function BookmarkletPage() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(BOOKMARKLET_SCRIPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      toast({
        title: "脚本代码已复制",
        description: "在浏览器书签管理器中新建书签，将代码粘贴到「网址」栏后保存",
      });
    } catch {
      toast({ title: "复制失败", description: "请手动选择并复制", variant: "destructive" });
    }
  };

  const handleBookmarkletClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toast({
      title: "请拖动，不要在这里点击 👆",
      description: "此按钮需拖到浏览器书签栏。登录教师后台后，再点击书签栏中的按钮才能提取数据。",
    });
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bookmark className="w-6 h-6 text-primary" />
          书签提取工具
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          教师后台需要登录，书签工具让你在已登录的页面上一键提取成绩数据
        </p>
      </div>

      {/* Important notice */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
        <div>
          <strong>重要：</strong>下方橙色按钮需要用鼠标<strong>拖动</strong>到浏览器书签栏，而不是在此处点击。添加成功后，在教师后台页面点击该书签才能提取数据。
        </div>
      </div>

      {/* Drag zone */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-8 flex flex-col items-center gap-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
          <GripHorizontal className="w-4 h-4" />
          第一步：将下方按钮拖动到浏览器书签栏
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="text-2xl animate-bounce">☝️</div>
          <p className="text-xs text-orange-600 font-medium">书签栏在浏览器顶部（Ctrl+Shift+B 显示）</p>
        </div>

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
          ↑ 按住此按钮 → 拖动到浏览器顶部书签栏 → 松开鼠标
        </p>

        <div className="w-full border-t border-orange-200 pt-4">
          <p className="text-xs text-center text-orange-700/70 mb-3 font-medium">
            拖动不成功？点击「复制脚本代码」→ 书签栏右键「添加书签」→ 将代码粘贴到网址栏
          </p>
          <div className="flex justify-center">
            <button
              onClick={handleCopyScript}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-orange-300 text-orange-700 hover:bg-orange-50 transition-colors shadow-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "已复制" : "复制脚本代码"}
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
          <strong className="text-foreground">安全说明：</strong>书签脚本仅在你的本地浏览器运行，只读取当前页面可见的成绩表格（识别绿色正确、红色错误格），不会上传任何 Cookie、密码或登录信息。
        </div>
      </div>
    </div>
  );
}
