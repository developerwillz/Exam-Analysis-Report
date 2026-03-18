import { useState } from "react";
import { Bookmark, Copy, Check, Terminal, MousePointerClick, ClipboardPaste, Chrome, GripHorizontal, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMED from screenshot: column headers are "Q1","Q2",... with "100%" below,
// NOT bare integers. Fix: match /^Q(\d+)/i as well as /^\d+/.
//
// The popup approach is also fragile. Primary method: DevTools console script.
// ─────────────────────────────────────────────────────────────────────────────

// Core extraction logic (shared between bookmarklet and console script)
const CORE_LOGIC = `
(function(){
  var students=[];
  var examTitle='';

  /* exam title */
  try{
    var ps=document.querySelectorAll('p');
    for(var i=0;i<ps.length;i++){
      var t=(ps[i].textContent||'').trim();
      if(t.match(/(真题|模考|SAT|TOEFL|托福|雅思|Module)/i)&&t.length>5&&t.length<200&&ps[i].children.length===0){
        examTitle=t;break;
      }
    }
  }catch(e){}

  /* find question tables */
  document.querySelectorAll('.el-table').forEach(function(tbl){
    var colToQ={};
    tbl.querySelectorAll('.el-table__header th').forEach(function(th){
      var raw=(th.textContent||'').trim();
      /* handle "Q1","Q2" OR bare "1","2" */
      var num=null;
      if(/^\\d+$/.test(raw)){num=parseInt(raw);}
      else{var m=raw.match(/^Q(\\d+)/i);if(m)num=parseInt(m[1]);}
      if(!num)return;
      th.classList.forEach(function(c){
        if(/^el-table_\\d+_column_\\d+$/.test(c))colToQ[c]=num;
      });
    });
    if(Object.keys(colToQ).length<2)return;

    tbl.querySelectorAll('.el-table__body tr.el-table__row').forEach(function(row){
      var ns=row.querySelector('span.x-color-blue.x-pointer');
      if(!ns)return;
      var name=(ns.textContent||'').trim();
      if(!name||name.length<2)return;
      if((row.textContent||'').indexOf('\\u672a\\u5f00\\u59cb')>-1)return;
      var wq=[];
      row.querySelectorAll('td').forEach(function(td){
        var cc=null;
        td.classList.forEach(function(c){if(/^el-table_\\d+_column_\\d+$/.test(c))cc=c;});
        if(!colToQ[cc])return;
        if(td.querySelector('span.x-title-bold.x-color-red,span.x-color-red.x-title-bold'))wq.push(colToQ[cc]);
      });
      var ex=students.find(function(s){return s.studentName===name;});
      if(!ex){students.push({studentName:name,wrongQuestions:wq});}
      else{wq.forEach(function(q){if(ex.wrongQuestions.indexOf(q)<0)ex.wrongQuestions.push(q);});}
    });
  });

  students.forEach(function(s){s.wrongQuestions.sort(function(a,b){return a-b;});});
  return {examTitle:examTitle,students:students,totalStudents:students.length};
})()`;

// Bookmarklet: shows result in an overlay on the teacher page
const BOOKMARKLET_SCRIPT = `javascript:void(function(){
var r=${CORE_LOGIC};
var j=JSON.stringify(r,null,2);
var d=document.getElementById('_xe');if(d)d.remove();
var o=document.createElement('div');
o.id='_xe';
o.setAttribute('style','position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.65);z-index:2147483647;display:flex;align-items:center;justify-content:center;');
var ok=r.students.length>0;
var inner=document.createElement('div');
inner.setAttribute('style','background:#fff;border-radius:10px;width:580px;max-width:92vw;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.5);overflow:hidden;');
inner.innerHTML='<div style="padding:14px 18px;background:'+(ok?'#16a34a':'#dc2626')+';color:#fff;display:flex;justify-content:space-between;align-items:center;"><b>'+(ok?'\\u2705 \\u63d0\\u53d6\\u6210\\u529f\\uff01\\u5171'+r.students.length+'\\u540d\\u5b66\\u751f':'\\u26a0\\ufe0f \\u672a\\u627e\\u5230\\u6210\\u7ee9\\u8868\\uff0c\\u8bf7\\u5207\\u6362\\u5230\\u5df2\\u6279\\u6539\\u9875\\u9762\\u518d\\u70b9\\u51fb')+'</b><button onclick="document.getElementById(\'_xe\').remove()" style="background:rgba(255,255,255,.25);border:none;color:#fff;padding:3px 10px;border-radius:5px;cursor:pointer;font-size:13px;">\\u5173\\u95ed</button></div>'+(ok?'<div style="padding:10px 16px 4px;"><button id="_xec" style="background:#2563eb;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">\\u4e00\\u952e\\u590d\\u5236</button><span id="_xes" style="color:green;margin-left:10px;display:none;">\\u2705\\u5df2\\u590d\\u5236</span></div>':'')+'<textarea readonly style="flex:1;margin:8px 16px 16px;padding:8px;font-size:11px;font-family:monospace;border:1px solid #ccc;border-radius:6px;resize:none;min-height:200px;">'+j.replace(/[<>&"]/g,function(c){return{\'<\':\'&lt;\',\'>\':\'>}\',\'&\':\'&amp;\',\'"\':\'&quot;\'}[c]||c;})+'</textarea>';
o.appendChild(inner);
document.body.appendChild(o);
o.addEventListener('click',function(e){if(e.target===o)o.remove();});
if(ok){document.getElementById('_xec').onclick=function(){var ta=inner.querySelector('textarea');ta.select();try{navigator.clipboard.writeText(j).then(function(){document.getElementById('_xes').style.display='inline';});}catch(e){document.execCommand('copy');document.getElementById('_xes').style.display='inline';}};}
}());`;

// Console script for DevTools — more reliable, always works
const CONSOLE_SCRIPT = `(function(){
  var students = [], examTitle = '';

  // Find exam title
  document.querySelectorAll('p').forEach(function(p) {
    var t = (p.textContent || '').trim();
    if (!examTitle && t.match(/(真题|模考|SAT|TOEFL|托福|雅思|Module)/i) && t.length > 5 && t.length < 200 && p.children.length === 0)
      examTitle = t;
  });

  // Extract from score table
  document.querySelectorAll('.el-table').forEach(function(tbl) {
    var colToQ = {};
    tbl.querySelectorAll('.el-table__header th').forEach(function(th) {
      var raw = (th.textContent || '').trim();
      var num = /^\\d+$/.test(raw) ? parseInt(raw) : (raw.match(/^Q(\\d+)/i) ? parseInt(raw.match(/^Q(\\d+)/i)[1]) : null);
      if (!num) return;
      th.classList.forEach(function(c) {
        if (/^el-table_\\d+_column_\\d+$/.test(c)) colToQ[c] = num;
      });
    });
    if (Object.keys(colToQ).length < 2) return;
    console.log('找到成绩表格，题目列数:', Object.keys(colToQ).length);

    tbl.querySelectorAll('.el-table__body tr.el-table__row').forEach(function(row) {
      var ns = row.querySelector('span.x-color-blue.x-pointer');
      if (!ns) return;
      var name = (ns.textContent || '').trim();
      if (!name || name.length < 2 || row.textContent.includes('未开始')) return;
      var wq = [];
      row.querySelectorAll('td').forEach(function(td) {
        var cc = null;
        td.classList.forEach(function(c) { if (/^el-table_\\d+_column_\\d+$/.test(c)) cc = c; });
        if (!colToQ[cc]) return;
        if (td.querySelector('span.x-title-bold.x-color-red, span.x-color-red.x-title-bold')) wq.push(colToQ[cc]);
      });
      var ex = students.find(function(s) { return s.studentName === name; });
      if (!ex) students.push({ studentName: name, wrongQuestions: wq });
      else wq.forEach(function(q) { if (ex.wrongQuestions.indexOf(q) < 0) ex.wrongQuestions.push(q); });
    });
  });

  students.forEach(function(s) { s.wrongQuestions.sort(function(a, b) { return a - b; }); });
  var result = JSON.stringify({ examTitle: examTitle, students: students, totalStudents: students.length }, null, 2);
  copy(result);
  console.log('✅ 已复制 ' + students.length + ' 名学生的数据到剪贴板！');
  console.log(result);
})();`;

export default function BookmarkletPage() {
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const [copiedConsole, setCopiedConsole] = useState(false);
  const { toast } = useToast();

  const handleCopyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(BOOKMARKLET_SCRIPT);
      setCopiedBookmarklet(true);
      setTimeout(() => setCopiedBookmarklet(false), 3000);
      toast({ title: "书签脚本已复制", description: "在书签管理器新建书签，将代码粘贴到「网址」栏" });
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  const handleCopyConsole = async () => {
    try {
      await navigator.clipboard.writeText(CONSOLE_SCRIPT);
      setCopiedConsole(true);
      setTimeout(() => setCopiedConsole(false), 3000);
      toast({ title: "控制台脚本已复制", description: "请粘贴到浏览器开发者工具的 Console 标签页中运行" });
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  const handleBookmarkletClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toast({ title: "请拖动，不要在这里点击", description: "拖动到书签栏后，在教师后台页面点击它" });
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bookmark className="w-6 h-6 text-primary" />
          成绩提取工具
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          两种方式提取成绩，推荐使用更可靠的「开发者工具控制台」方式
        </p>
      </div>

      {/* Method 1: Console (RECOMMENDED) */}
      <div className="border-2 border-blue-300 bg-blue-50 rounded-2xl overflow-hidden">
        <div className="bg-blue-600 text-white px-5 py-3 flex items-center gap-2">
          <Terminal className="w-5 h-5" />
          <span className="font-bold text-base">方式一（推荐）：开发者工具控制台</span>
          <span className="ml-2 bg-white/20 text-white text-xs rounded px-2 py-0.5">最稳定，零安装</span>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-blue-900">
            在教师后台的成绩表格页面，按 <kbd className="bg-white border border-blue-300 rounded px-1.5 py-0.5 font-mono text-xs">F12</kbd> 打开开发者工具 → 点击 <strong>Console</strong> 标签 → 粘贴下方脚本 → 回车执行。数据自动复制到剪贴板，控制台会显示「✅ 已复制」。
          </p>

          <div className="relative bg-slate-900 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800">
              <span className="text-slate-400 text-xs font-mono">Console 脚本</span>
              <button
                onClick={handleCopyConsole}
                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors"
              >
                {copiedConsole ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedConsole ? "已复制" : "复制脚本"}
              </button>
            </div>
            <pre className="p-4 text-xs text-green-400 overflow-x-auto leading-relaxed max-h-48 overflow-y-auto">
              {CONSOLE_SCRIPT}
            </pre>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            {[
              { step: "1", text: "进入成绩表格页（有绿/红答题格）" },
              { step: "2", text: "F12 → Console → 粘贴脚本 → 回车" },
              { step: "3", text: "回本工具，粘贴 JSON 模式导入" },
            ].map((s) => (
              <div key={s.step} className="bg-white border border-blue-200 rounded-lg p-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold mb-2">{s.step}</div>
                <p className="text-blue-900 leading-snug">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Method 2: Bookmarklet */}
      <div className="border border-orange-200 bg-orange-50 rounded-2xl overflow-hidden">
        <div className="bg-orange-500 text-white px-5 py-3 flex items-center gap-2">
          <Bookmark className="w-5 h-5" />
          <span className="font-bold text-base">方式二：书签一键提取</span>
        </div>
        <div className="p-5 flex flex-col gap-4">

          <div className="flex items-start gap-3 p-3 bg-amber-100 border border-amber-300 rounded-lg text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong>必须在正确页面使用：</strong>需先切换到成绩批改详情页（有 Q1、Q2… 题目列，绿/红答题格），点击书签才能提取数据。在作业列表页点击无效。
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-orange-700 font-medium flex items-center gap-2">
              <GripHorizontal className="w-4 h-4" />
              拖动下方按钮到书签栏（Ctrl+Shift+B 显示书签栏）
            </p>
            <a
              href={BOOKMARKLET_SCRIPT}
              className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-base shadow-lg cursor-grab active:cursor-grabbing select-none flex items-center gap-2 transition-colors"
              onClick={handleBookmarkletClick}
              draggable
            >
              <Bookmark className="w-5 h-5" />
              📋 提取成绩数据
            </a>
            <p className="text-xs text-orange-600/80 text-center">
              点击书签后，页面弹出浮层显示 JSON，点「一键复制」，回本工具粘贴
            </p>
          </div>

          <div className="border-t border-orange-200 pt-4">
            <p className="text-xs text-orange-700 text-center mb-2">书签拖动失败？手动添加：复制代码 → 书签栏右键「添加书签」→ 粘贴到网址栏</p>
            <div className="flex justify-center">
              <button onClick={handleCopyBookmarklet} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white border border-orange-300 text-orange-700 hover:bg-orange-50 transition-colors">
                {copiedBookmarklet ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copiedBookmarklet ? "已复制" : "复制书签代码"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 p-4 bg-muted/50 border border-border/50 rounded-xl text-xs text-muted-foreground">
        <span className="text-base">🔒</span>
        <div>
          <strong className="text-foreground">安全说明：</strong>脚本仅在本地浏览器运行，只读取页面上可见的成绩表格数据（绿色/红色答题格），不会上传任何账号、密码或 Cookie 信息。
        </div>
      </div>
    </div>
  );
}
