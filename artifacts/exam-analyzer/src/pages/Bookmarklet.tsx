import { useState } from "react";
import { Bookmark, Copy, Check, ChevronRight, MousePointerClick, ClipboardPaste, Chrome, GripHorizontal, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Bookmarklet — veritas.xiaosaas.com
//
// STRATEGY: Instead of relying on clipboard API (which can be blocked by CSP),
// we inject a visible overlay popup on the page showing the JSON. The user can
// then manually select-all and copy it, or use the Copy button in the overlay.
//
// Target page: the per-question score detail page (el-table with width>1500px,
//   headers containing bare integers 1,2,3..., cells with x-color-green/red)
//
// Detection:
//   Student name : span.x-color-blue.x-pointer
//   Wrong answer : span containing class x-title-bold AND x-color-red
//   Correct answer: span containing class x-title-bold AND x-color-green
//   Question col : th whose textContent.trim() is a bare integer
//   Column key   : CSS class /el-table_\d+_column_\d+/
// ─────────────────────────────────────────────────────────────────────────────
const BOOKMARKLET_SCRIPT = `javascript:(function(){

/* ─── helpers ─────────────────────────────────── */
function txt(el){return(el&&el.textContent||'').trim();}

/* ─── 1. exam title ───────────────────────────── */
var examTitle='';
try{
  var ps=document.querySelectorAll('p');
  for(var i=0;i<ps.length;i++){
    var t=txt(ps[i]);
    if(t.match(/(真题|模考|SAT|TOEFL|托福|雅思|Module)/i)&&t.length>5&&t.length<200&&ps[i].children.length===0){
      examTitle=t;break;
    }
  }
}catch(e){}

/* ─── 2. find score tables & extract ──────────── */
var students=[];
var tablesProcessed=0;

document.querySelectorAll('.el-table').forEach(function(tableEl,ti){
  /* Build columnClass→questionNumber map from header */
  var colToQ={};
  tableEl.querySelectorAll('.el-table__header th').forEach(function(th){
    var t=txt(th);
    if(!/^\\d+$/.test(t))return;
    th.classList.forEach(function(c){
      if(/^el-table_\\d+_column_\\d+$/.test(c))colToQ[c]=parseInt(t);
    });
  });

  /* Must have question columns to be the right table */
  if(Object.keys(colToQ).length<3)return;
  tablesProcessed++;

  /* Process rows */
  tableEl.querySelectorAll('.el-table__body tr.el-table__row').forEach(function(row){
    var nameSpan=row.querySelector('span.x-color-blue.x-pointer');
    if(!nameSpan)return;
    var name=txt(nameSpan);
    if(!name||name.length<2)return;
    if(txt(row).includes('\\u672a\\u5f00\\u59cb'))return; /* 未开始 */

    var wrongQs=[];
    row.querySelectorAll('td').forEach(function(td){
      var colClass=null;
      td.classList.forEach(function(c){
        if(/^el-table_\\d+_column_\\d+$/.test(c))colClass=c;
      });
      if(!colToQ[colClass])return;
      /* wrong = span with both x-title-bold and x-color-red */
      if(td.querySelector('span.x-title-bold.x-color-red,span.x-color-red.x-title-bold'))
        wrongQs.push(colToQ[colClass]);
    });

    var existing=students.find(function(s){return s.studentName===name;});
    if(!existing){
      students.push({studentName:name,wrongQuestions:wrongQs});
    }else{
      wrongQs.forEach(function(q){if(existing.wrongQuestions.indexOf(q)===-1)existing.wrongQuestions.push(q);});
    }
  });
});

students.forEach(function(s){s.wrongQuestions.sort(function(a,b){return a-b;});});

var payload=JSON.stringify({
  examTitle:examTitle,
  students:students,
  totalStudents:students.length
},null,2);

/* ─── 3. Show overlay popup ───────────────────── */
/* Remove any existing overlay */
var old=document.getElementById('_xiao_extractor');
if(old)old.remove();

var overlay=document.createElement('div');
overlay.id='_xiao_extractor';
overlay.style.cssText=[
  'position:fixed','top:0','left:0','width:100vw','height:100vh',
  'background:rgba(0,0,0,0.6)','z-index:99999','display:flex',
  'align-items:center','justify-content:center','font-family:sans-serif'
].join(';');

var ok=students.length>0;
var headerBg=ok?'#16a34a':'#dc2626';
var headerText=ok
  ? '\\u2705 \\u63d0\\u53d6\\u6210\\u529f\\uff01\\u5171 '+students.length+' \\u540d\\u5b66\\u751f'
  : '\\u26a0\\ufe0f \\u672a\\u627e\\u5230\\u6210\\u7ee9\\u8868\\u683c\\uff08\\u5df2\\u626b\\u63cf '+tablesProcessed+' \\u4e2a\\u8868\\uff09';
var bodyHtml=ok
  ? '<p style="margin:0 0 8px;color:#374151;font-size:13px;">\\u8bf7\\u5168\\u9009\\u4e0b\\u65b9\\u6587\\u672c\\u6846\\u5185\\u5185\\u5bb9\\uff08Ctrl+A\\uff09\\uff0c\\u518d\\u590d\\u5236\\uff08Ctrl+C\\uff09\\uff0c\\u7136\\u540e\\u8fd4\\u56de\\u5206\\u6790\\u5de5\\u5177\\u7c98\\u8d34\\u3002</p>'
  : '<p style="margin:0 0 8px;color:#374151;font-size:13px;">\\u8bf7\\u786e\\u8ba4\\u5df2\\u5728\\u300c\\u5df2\\u6279\\u6539\\u300d\\u8be6\\u60c5\\u9875\\u9762\\uff0c\\u9875\\u9762\\u4e0a\\u53ef\\u770b\\u5230\\u7eff\\u8272/\\u7ea2\\u8272\\u7684\\u9898\\u76ee\\u683c\\uff0c\\u518d\\u6b21\\u70b9\\u51fb\\u4e66\\u7b7e\\u3002</p>';

overlay.innerHTML=[
  '<div style="background:#fff;border-radius:12px;width:600px;max-width:90vw;max-height:80vh;',
  'display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.4);overflow:hidden;">',
  '<div style="background:'+headerBg+';color:#fff;padding:16px 20px;font-size:15px;font-weight:bold;',
  'display:flex;align-items:center;justify-content:space-between;">',
  '<span>'+headerText+'</span>',
  '<button id="_xiao_close" style="background:rgba(255,255,255,0.2);border:none;color:#fff;',
  'border-radius:6px;padding:4px 10px;cursor:pointer;font-size:14px;">\\u5173\\u95ed</button>',
  '</div>',
  '<div style="padding:16px 20px;flex:1;overflow:auto;">',
  bodyHtml,
  ok?'<div style="display:flex;gap:8px;margin-bottom:8px;">'+
    '<button id="_xiao_copy" style="background:#2563eb;color:#fff;border:none;border-radius:6px;'+
    'padding:6px 16px;cursor:pointer;font-size:13px;font-weight:bold;">\\u4e00\\u952e\\u590d\\u5236</button>'+
    '<span id="_xiao_copy_ok" style="color:#16a34a;font-size:13px;line-height:2;display:none;">\\u2705 \\u5df2\\u590d\\u5236\\uff01</span>'+
    '</div>':'',
  '<textarea id="_xiao_ta" style="width:100%;height:260px;font-family:monospace;font-size:11px;',
  'border:1px solid #d1d5db;border-radius:6px;padding:8px;box-sizing:border-box;resize:vertical;">',
  payload.replace(/</g,'&lt;'),
  '</textarea>',
  '</div>',
  '</div>'
].join('');

document.body.appendChild(overlay);

document.getElementById('_xiao_close').onclick=function(){overlay.remove();};
overlay.addEventListener('click',function(e){if(e.target===overlay)overlay.remove();});

if(ok){
  document.getElementById('_xiao_copy').onclick=function(){
    var ta=document.getElementById('_xiao_ta');
    ta.select();
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(payload).then(function(){
          document.getElementById('_xiao_copy_ok').style.display='inline';
        }).catch(function(){
          document.execCommand('copy');
          document.getElementById('_xiao_copy_ok').style.display='inline';
        });
      }else{
        document.execCommand('copy');
        document.getElementById('_xiao_copy_ok').style.display='inline';
      }
    }catch(e){}
  };
}

})();`;

const STEPS = [
  {
    icon: GripHorizontal,
    title: "拖动书签到书签栏",
    desc: "将下方橙色「提取成绩数据」按钮拖动到浏览器书签栏（Ctrl+Shift+B 显示书签栏）",
    highlight: false,
  },
  {
    icon: Chrome,
    title: "进入「模考批改详情」页面",
    desc: "登录后台 → 找到具体一次模考作业 → 点击「查看详情」或进入该作业 → 切换到「已批改」标签 → 确认页面上有学生姓名及绿色/红色答题格",
    highlight: true,
  },
  {
    icon: MousePointerClick,
    title: "点击书签栏中的「提取成绩数据」",
    desc: "在已显示成绩表格的页面点击书签，页面上会弹出一个黑色遮罩弹窗，显示提取到的 JSON 数据",
    highlight: false,
  },
  {
    icon: ClipboardPaste,
    title: "点击弹窗中「一键复制」，回本工具粘贴",
    desc: "在弹窗中点击「一键复制」按钮（或 Ctrl+A 全选文本框再 Ctrl+C），然后回到本工具的「解析页面」→「粘贴 JSON 模式」→ 粘贴导入",
    highlight: false,
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
        description: "在浏览器书签管理器新建书签，将代码粘贴到「网址」栏后保存",
      });
    } catch {
      toast({ title: "复制失败", description: "请手动选择并复制", variant: "destructive" });
    }
  };

  const handleBookmarkletClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toast({
      title: "请拖动到书签栏，不要在这里点击 👆",
      description: "此按钮需拖到浏览器书签栏，然后在教师后台「已批改」详情页点击它。",
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

      {/* Critical page warning */}
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-300 rounded-xl text-sm text-red-900">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
        <div className="space-y-1">
          <strong>必须在正确的页面才能提取数据：</strong>
          <p>你必须先导航到某次模考作业的「<strong>逐题批改详情页</strong>」，页面上能看到学生姓名列和多个题目列（绿色=答对，红色=答错），才能点击书签提取。</p>
          <p className="text-red-700">在作业列表页（只有圆形进度环的页面）点击书签 <strong>无法</strong> 提取任何数据。</p>
        </div>
      </div>

      {/* What the correct page looks like */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
        <p className="font-semibold text-slate-700 mb-2">✅ 正确页面长这样：</p>
        <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-xs overflow-x-auto text-slate-600">
          <div className="flex gap-2 items-center mb-1">
            <span className="bg-slate-100 px-2 py-0.5 rounded">姓名</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded">第1题</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded">第2题</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded">第3题</span>
            <span className="text-slate-400">...</span>
          </div>
          <div className="flex gap-2 items-center mb-1">
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">张润思</span>
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">D ✓</span>
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">A ✗</span>
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">C ✓</span>
            <span className="text-slate-400">...</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">孔佑祺</span>
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">A ✓</span>
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">B ✓</span>
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">D ✗</span>
            <span className="text-slate-400">...</span>
          </div>
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
          点击书签后，页面上会出现一个弹窗显示提取的 JSON，无需粘贴板权限
        </p>

        <div className="w-full border-t border-orange-200 pt-4">
          <p className="text-xs text-center text-orange-700/70 mb-3 font-medium">
            拖动不成功？复制脚本代码 → 书签栏右键「添加书签」→ 将代码粘贴到网址栏
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
            <div key={i} className={`flex gap-4 p-5 rounded-xl border shadow-sm ${step.highlight ? 'bg-amber-50 border-amber-300' : 'bg-card border-border/50'}`}>
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${step.highlight ? 'bg-amber-200 text-amber-800' : 'bg-primary/10 text-primary'}`}>
                <step.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold rounded px-1.5 py-0.5 ${step.highlight ? 'text-amber-800 bg-amber-200' : 'text-primary/70 bg-primary/10'}`}>步骤 {i + 1}</span>
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
          <strong className="text-foreground">安全说明：</strong>书签脚本仅在本地浏览器运行，只读取当前页面可见的成绩表格，不会上传任何 Cookie、密码或登录信息。
        </div>
      </div>
    </div>
  );
}
