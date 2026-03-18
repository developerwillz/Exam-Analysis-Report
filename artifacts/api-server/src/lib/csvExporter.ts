export interface StudentResult {
  studentName: string;
  wrongQuestions: number[];
  totalQuestions?: number;
  score?: string;
}

export interface QuestionTypeEntry {
  questionNumber: number;
  questionType: string;
}

export function generateCsv(
  students: StudentResult[],
  questionTypeMappings: QuestionTypeEntry[] = [],
  examTitle?: string
): string {
  const typeMap = new Map<number, string>();
  for (const entry of questionTypeMappings) {
    typeMap.set(entry.questionNumber, entry.questionType);
  }

  const lines: string[] = [];
  
  // Add BOM for Excel Chinese character support
  const BOM = '\uFEFF';

  // Header
  if (examTitle) {
    lines.push(csvEscape(examTitle));
    lines.push('');
  }

  if (questionTypeMappings.length > 0) {
    // With question type mapping: generate detailed breakdown
    
    // Collect all unique question types
    const allTypes = [...new Set(questionTypeMappings.map(m => m.questionType))];
    
    // Header row
    const headers = ['学生姓名', '错题题号', '错题数量'];
    for (const t of allTypes) {
      headers.push(`${t}错题`);
    }
    lines.push(headers.map(csvEscape).join(','));
    
    // Data rows
    for (const student of students) {
      const wrongQs = student.wrongQuestions;
      const wrongQsStr = wrongQs.join('、');
      const wrongCount = wrongQs.length;
      
      // Count wrong questions per type
      const typeCounts = new Map<string, number[]>();
      for (const t of allTypes) {
        typeCounts.set(t, []);
      }
      
      for (const q of wrongQs) {
        const qType = typeMap.get(q);
        if (qType && typeCounts.has(qType)) {
          typeCounts.get(qType)!.push(q);
        }
      }
      
      const row = [
        student.studentName,
        wrongQsStr,
        wrongCount.toString(),
      ];
      
      for (const t of allTypes) {
        const nums = typeCounts.get(t) || [];
        row.push(nums.length > 0 ? nums.join('、') : '');
      }
      
      lines.push(row.map(csvEscape).join(','));
    }
    
    // Add summary row
    lines.push('');
    lines.push(['汇总统计', '', ''].concat(allTypes.map(() => '')).map(csvEscape).join(','));
    
    // Per-type error count summary
    const typeErrorCounts = new Map<string, number>();
    for (const t of allTypes) {
      typeErrorCounts.set(t, 0);
    }
    for (const student of students) {
      for (const q of student.wrongQuestions) {
        const qType = typeMap.get(q);
        if (qType) {
          typeErrorCounts.set(qType, (typeErrorCounts.get(qType) || 0) + 1);
        }
      }
    }
    
    const summaryRow = ['各题型错误人数', '', ''];
    for (const t of allTypes) {
      summaryRow.push((typeErrorCounts.get(t) || 0).toString());
    }
    lines.push(summaryRow.map(csvEscape).join(','));
    
  } else {
    // Without question type mapping: simple format
    const headers = ['学生姓名', '错题题号', '错题数量'];
    lines.push(headers.map(csvEscape).join(','));
    
    for (const student of students) {
      const row = [
        student.studentName,
        student.wrongQuestions.join('、'),
        student.wrongQuestions.length.toString(),
      ];
      lines.push(row.map(csvEscape).join(','));
    }
  }

  return BOM + lines.join('\n');
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('、')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
