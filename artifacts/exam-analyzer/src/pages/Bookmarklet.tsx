import { useState } from "react";
import { Bookmark, Copy, Check, ChevronRight, MousePointerClick, ClipboardPaste, Chrome } from "lucide-react";

// The bookmarklet script that runs on veritas.xiaosaas.com
// It extracts student score data from the logged-in teacher page
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
    icon: Bookmark,
    title: "拖动书签到书签栏",
    desc: "将下方的「提取数据」按钮拖动到浏览器书签栏（需要先显示书签栏：Ctrl+Shift+B）",
  },
  {
    icon: Chrome,
    title: "在教师后台打开模考成绩页",
    desc: "登录 veritas.xiaosaas.com，进入对应班级的模考作业，切换到「已批改」成绩详情页",
  },
  {
    icon: MousePointerClick,
    title: "点击书签栏中的「提取数据」",
    desc: "点击刚才保存的书签，脚本会自动提取所有学生的错题数据并复制到剪贴板",
  },
  {
    icon: ClipboardPaste,
    title: "回到本工具粘贴",
    desc: "返回本页面，点击「解析页面」→「粘贴 JSON 模式」选项卡，粘贴数据即可",
  },
];

export default function BookmarkletPage() {
  const [copied, setCopied] = useState(false);

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(BOOKMARKLET_SCRIPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bookmark className="w-6 h-6 text-primary" />
          书签提取工具
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          由于教师后台需要登录，使用浏览器书签脚本在已登录的页面上直接提取数据
        </p>
      </div>

      {/* Drag target */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-8 flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground font-medium">将下方按钮拖动到浏览器书签栏</p>
        {/* The bookmarklet link itself */}
        <a
          href={BOOKMARKLET_SCRIPT}
          className="px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg shadow-lg shadow-primary/20 cursor-grab active:cursor-grabbing select-none flex items-center gap-3 hover:bg-primary/90 transition-colors"
          onClick={(e) => {
            e.preventDefault();
            alert("请将此按钮拖动到书签栏，不要直接点击");
          }}
          draggable
        >
          <Bookmark className="w-5 h-5" />
          📋 提取成绩数据
        </a>
        <p className="text-xs text-muted-foreground">↑ 拖动到浏览器顶部书签栏</p>

        <div className="border-t border-primary/10 w-full pt-4 mt-2">
          <p className="text-xs text-center text-muted-foreground mb-2">或者复制脚本代码，手动新建书签并粘贴到网址栏</p>
          <button
            onClick={handleCopyScript}
            className="mx-auto flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-background border border-border hover:bg-muted transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "已复制" : "复制脚本代码"}
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-bold text-foreground">使用步骤</h3>
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

      {/* Note */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>提示：</strong>提取后的数据会自动复制到剪贴板。返回「解析页面」选项卡，在右上角切换到「粘贴 JSON 模式」并按 Ctrl+V 粘贴即可。书签脚本完全在本地运行，不会上传任何登录信息。
        </div>
      </div>
    </div>
  );
}
