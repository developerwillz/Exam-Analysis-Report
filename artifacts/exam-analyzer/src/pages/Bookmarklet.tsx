import { useState, useRef, useEffect } from "react";
import { Bookmark, Copy, Check, Terminal, GripHorizontal, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Extraction rules (confirmed from live HTML + user screenshots):
//
//  Column headers : "Q1","Q2",... or bare "1","2",...  (textContent trim)
//  Student name   : span.x-color-blue.x-pointer
//  Status column  : 已查阅 / 已完成 = participated; 未开始 = skip entirely
//  WRONG answer   : span.x-title-bold.x-color-red  OR  cell text === "--"
//                   (-- means unanswered; counts as wrong for participating students)
//  CORRECT answer : span.x-title-bold.x-color-green
//
// Bookmarklet quoting rule (user-verified):
//   Single quotes inside javascript: URLs must be URL-encoded as %27.
//   The browser decodes %27 → ' before executing the script.
//   Regex literals (/pattern/) work fine as-is; only string literals need %27.
// ─────────────────────────────────────────────────────────────────────────────

// ── Bookmarklet (user-verified working version) ───────────────────────────────
// Key: single quotes inside javascript: URLs must be %27 (URL-encoded).
// The browser URL-decodes %27 → ' before executing, so selectors work correctly.
const BOOKMARKLET_SCRIPT = `javascript:(function(){  try{    var students=[], examTitle='';    document.querySelectorAll('p').forEach(function(p){      var t=(p.textContent||'').trim();      if(!examTitle && /(真题|模考|SAT|TOEFL|托福|雅思|Module)/i.test(t) && t.length>5 && t.length<200 && p.children.length===0){        examTitle=t;      }    });    document.querySelectorAll('.el-table').forEach(function(tbl){      var colToQ={};      tbl.querySelectorAll('.el-table__header th').forEach(function(th){        var raw=(th.textContent||'').trim();        var m=raw.match(/^Q(\\d+)/i);        var num=/^\\d+$/.test(raw) ? parseInt(raw,10) : (m ? parseInt(m[1],10) : null);        if(!num) return;        th.classList.forEach(function(c){          if(/^el-table_\\d+_column_\\d+$/.test(c)){            colToQ[c]=num;          }        });      });      if(Object.keys(colToQ).length<2) return;      tbl.querySelectorAll(%27.el-table__body tr.el-table__row%27).forEach(function(row){        var ns=row.querySelector(%27span.x-color-blue.x-pointer%27);        if(!ns) return;        var name=(ns.textContent||%27%27).trim();        var rowText=(row.textContent||%27%27);        if(!name || name.length<2 || rowText.indexOf(%27未开始%27)>-1) return;        var wq=[];        row.querySelectorAll(%27td%27).forEach(function(td){          var cc=null;          td.classList.forEach(function(c){            if(/^el-table_\\d+_column_\\d+$/.test(c)) cc=c;          });          if(!colToQ[cc]) return;          var cellText=(td.textContent||%27%27).trim();          if(            td.querySelector(%27span.x-title-bold.x-color-red, span.x-color-red.x-title-bold%27) ||            cellText===%27--%27          ){            wq.push(colToQ[cc]);          }        });        var ex=students.find(function(s){          return s.studentName===name;        });        if(!ex){          students.push({            studentName:name,            wrongQuestions:wq          });        }else{          wq.forEach(function(q){            if(ex.wrongQuestions.indexOf(q)<0) ex.wrongQuestions.push(q);          });        }      });    });    students.forEach(function(s){      s.wrongQuestions.sort(function(a,b){ return a-b; });    });    var result=JSON.stringify({      examTitle:examTitle,      students:students,      totalStudents:students.length    }, null, 2);    if(navigator.clipboard && navigator.clipboard.writeText){      navigator.clipboard.writeText(result).then(function(){        alert(%27提取成功，共 %27 + students.length + %27 名学生，结果已复制到剪贴板%27);      }).catch(function(){        prompt(%27自动复制失败，请手动复制下面内容：%27, result);      });    }else{      prompt(%27当前页面不支持自动复制，请手动复制下面内容：%27, result);    }  }catch(e){    alert(%27报错: %27 + e.message);    console.error(e);  }})();`;

// ── Console Script (paste into Chrome DevTools → Console) ────────────────────
const CONSOLE_SCRIPT = `(function(){
  var students = [], examTitle = '';

  // Find exam title
  document.querySelectorAll('p').forEach(function(p) {
    var t = (p.textContent || '').trim();
    if (!examTitle && /(真题|模考|SAT|TOEFL|托福|雅思|Module)/i.test(t) && t.length > 5 && t.length < 200 && p.children.length === 0)
      examTitle = t;
  });

  // Extract from score tables
  document.querySelectorAll('.el-table').forEach(function(tbl) {
    var colToQ = {};
    tbl.querySelectorAll('.el-table__header th').forEach(function(th) {
      var raw = (th.textContent || '').trim();
      var num = /^\\d+$/.test(raw) ? parseInt(raw)
              : ((raw.match(/^Q(\\d+)/i) || [])[1] ? parseInt(raw.match(/^Q(\\d+)/i)[1]) : null);
      if (!num) return;
      th.classList.forEach(function(c) {
        if (/^el-table_\\d+_column_\\d+$/.test(c)) colToQ[c] = num;
      });
    });
    if (Object.keys(colToQ).length < 2) return;
    console.log('✔ 找到成绩表格，题目列数:', Object.keys(colToQ).length, '列');

    tbl.querySelectorAll('.el-table__body tr.el-table__row').forEach(function(row) {
      var ns = row.querySelector('span.x-color-blue.x-pointer');
      if (!ns) return;
      var name = (ns.textContent || '').trim();
      if (!name || name.length < 2) return;

      // 未开始 = did not take exam → skip
      if ((row.textContent || '').includes('未开始')) {
        console.log('  跳过 (未开始):', name);
        return;
      }

      var wq = [];
      row.querySelectorAll('td').forEach(function(td) {
        var cc = null;
        td.classList.forEach(function(c) {
          if (/^el-table_\\d+_column_\\d+$/.test(c)) cc = c;
        });
        if (!colToQ[cc]) return;
        var cellText = (td.textContent || '').trim();
        // Wrong = red-bold span (wrong answer) OR "--" (unanswered = wrong)
        if (td.querySelector('span.x-title-bold.x-color-red, span.x-color-red.x-title-bold') || cellText === '--')
          wq.push(colToQ[cc]);
      });

      var ex = students.find(function(s) { return s.studentName === name; });
      if (!ex) students.push({ studentName: name, wrongQuestions: wq });
      else wq.forEach(function(q) { if (ex.wrongQuestions.indexOf(q) < 0) ex.wrongQuestions.push(q); });
      console.log(' ', name, '→ 错题:', wq.join(', ') || '无');
    });
  });

  students.forEach(function(s) { s.wrongQuestions.sort(function(a, b) { return a - b; }); });

  var result = JSON.stringify({ examTitle: examTitle, students: students, totalStudents: students.length }, null, 2);
  copy(result); // Chrome DevTools built-in copy()
  console.log('\\n✅ 已复制 ' + students.length + ' 名学生数据到剪贴板！');
  console.log(result);
})();`;

export default function BookmarkletPage() {
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const [copiedConsole, setCopiedConsole] = useState(false);
  const { toast } = useToast();
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  // React blocks javascript: URLs in href props for security.
  // Setting the attribute directly on the DOM element bypasses this restriction,
  // which is intentional here — we need a draggable bookmarklet link.
  useEffect(() => {
    if (bookmarkletRef.current) {
      bookmarkletRef.current.setAttribute("href", BOOKMARKLET_SCRIPT);
    }
  }, []);

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
      toast({ title: "控制台脚本已复制", description: "粘贴到 Chrome DevTools Console 标签页中运行" });
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  const handleBookmarkletClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toast({ title: "请拖动到书签栏，不要在这里点击", description: "拖到书签栏后，在教师后台「已批改」页点击它" });
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

      {/* Logic summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        {[
          { icon: "✅", label: "已查阅 / 已完成", desc: "参加考试，统计错题（含未答）" },
          { icon: "➖", label: "-- 未作答", desc: "计为错题（参加考试的学生）" },
          { icon: "⏭️", label: "未开始", desc: "未参加考试，跳过不统计" },
        ].map((item) => (
          <div key={item.label} className="flex gap-3 p-3 bg-muted/50 border border-border/50 rounded-xl">
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            <div>
              <p className="font-semibold text-foreground text-xs">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
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
            在教师后台的成绩表格页面，按 <kbd className="bg-white border border-blue-300 rounded px-1.5 py-0.5 font-mono text-xs">F12</kbd> 打开开发者工具 → 点击 <strong>Console</strong> 标签 → 粘贴下方脚本 → 回车。数据自动复制到剪贴板，控制台会显示每位学生的错题列表。
          </p>
          <div className="relative bg-slate-900 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800">
              <span className="text-slate-400 text-xs font-mono">Console 脚本（粘贴到 F12 → Console）</span>
              <button onClick={handleCopyConsole} className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors">
                {copiedConsole ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedConsole ? "已复制" : "复制脚本"}
              </button>
            </div>
            <pre className="p-4 text-xs text-green-400 overflow-x-auto leading-relaxed max-h-52 overflow-y-auto">
              {CONSOLE_SCRIPT}
            </pre>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {[
              { step: "1", text: "进入已批改成绩页（有绿/红答题格）" },
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
            <div>必须在「已批改」成绩详情页使用（有 Q1、Q2… 题目列，绿/红答题格）。点击书签后页面会弹出浮层显示结果。</div>
          </div>
          <div className="flex flex-col items-center gap-4 py-2">
            <p className="text-sm text-orange-700 font-medium flex items-center gap-2">
              <GripHorizontal className="w-4 h-4" />
              拖动下方按钮到书签栏（Ctrl+Shift+B 显示书签栏）
            </p>
            <a
              ref={bookmarkletRef}
              className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-base shadow-lg cursor-grab active:cursor-grabbing select-none flex items-center gap-2 transition-colors"
              onClick={handleBookmarkletClick}
              draggable
            >
              <Bookmark className="w-5 h-5" />
              📋 提取成绩数据
            </a>
          </div>
          <div className="border-t border-orange-200 pt-4">
            <p className="text-xs text-orange-700 text-center mb-2">书签拖动失败？复制代码 → 书签栏右键「添加书签」→ 粘贴到网址栏</p>
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
          <strong className="text-foreground">安全说明：</strong>脚本仅在本地浏览器运行，只读取页面成绩表格数据，不会上传任何账号、密码或 Cookie 信息。
        </div>
      </div>
    </div>
  );
}
