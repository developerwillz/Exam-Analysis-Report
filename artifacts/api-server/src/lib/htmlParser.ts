/**
 * Parse the teacher management page HTML to extract student exam results.
 * The page is from veritas.xiaosaas.com - a Chinese teacher management SPA.
 * 
 * The HTML contains Vue.js rendered content with student names and exam data.
 * We look for patterns in the rendered HTML for wrong question data.
 */

export interface StudentResult {
  studentName: string;
  wrongQuestions: number[];
  totalQuestions?: number;
  score?: string;
}

export interface ParsedExamData {
  examTitle?: string;
  students: StudentResult[];
  totalStudents: number;
}

/**
 * Try to extract student wrong answers from the HTML.
 * 
 * The page structure typically contains:
 * - Student names in various elements
 * - Score tables with question-level results
 * - Error markers in table cells
 */
export function parseExamHtml(html: string): ParsedExamData {
  const students: StudentResult[] = [];
  let examTitle: string | undefined;

  // Try to find exam title
  const titlePatterns = [
    /class="x-margin-bottom-10">([^<]+?(?:真题|模考|Module|SAT|托福|TOEFL)[^<]*)</i,
    /class="[^"]*title[^"]*">([^<]{5,80}(?:真题|模考|Module|SAT))/i,
    /<p[^>]*>([^<]*(?:真题|模考|Module 1|Module 2|SAT|TOEFL)[^<]*)<\/p>/i,
  ];

  for (const pattern of titlePatterns) {
    const match = html.match(pattern);
    if (match) {
      examTitle = match[1].trim();
      break;
    }
  }

  // Strategy 1: Look for score tables with row data
  // The page has tables with student rows showing per-question scores
  // Typically: student name in first cell, then question cells marked correct/wrong
  
  // Look for table rows with student score data
  // Pattern: rows where we can identify student name + wrong question markers
  const scoreTablePattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(scoreTablePattern) || [];
  
  const studentMap = new Map<string, StudentResult>();

  for (const row of rows) {
    // Check if this row has score data (wrong answer indicators)
    // Common patterns: color red, class wrong, ✗, ×, 0分, class="error"
    const hasScoreData = /color:\s*red|class="[^"]*wrong|class="[^"]*error|✗|×|0分|答错/i.test(row);
    
    if (!hasScoreData) continue;

    // Try to extract student name from the row
    const nameMatch = row.match(/<td[^>]*>\s*([^\s<]{2,10}(?:[A-Za-z ]+)?)\s*<\/td>/);
    if (!nameMatch) continue;

    const rawName = nameMatch[1].trim();
    // Filter out obvious non-names (numbers, short codes, etc.)
    if (!/[\u4e00-\u9fff]/.test(rawName) && !/[A-Z][a-z]/.test(rawName)) continue;
    if (rawName.length < 2 || rawName.length > 20) continue;
    
    // Count wrong questions by finding "0分" or wrong markers in question cells
    const questionCells = row.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
    const wrongQuestions: number[] = [];
    
    questionCells.forEach((cell, index) => {
      if (index === 0) return; // Skip name cell
      const isWrong = /color:\s*red|class="[^"]*wrong|0分|答错|✗|×/.test(cell);
      if (isWrong) {
        wrongQuestions.push(index);
      }
    });

    if (wrongQuestions.length > 0 && !studentMap.has(rawName)) {
      studentMap.set(rawName, {
        studentName: rawName,
        wrongQuestions,
        totalQuestions: questionCells.length - 1,
      });
    }
  }

  // Strategy 2: Look for explicit wrong answer data in JSON-like structures
  // Some pages embed data as JS objects or Vue data
  const jsonDataPattern = /"(?:wrongQuestions|errorQuestions|wrongList)":\s*\[([^\]]*)\]/g;
  let jsonMatch;
  while ((jsonMatch = jsonDataPattern.exec(html)) !== null) {
    try {
      const nums = JSON.parse(`[${jsonMatch[1]}]`);
      if (Array.isArray(nums) && nums.every(n => typeof n === 'number')) {
        // We found some wrong question data but need to associate with a student
        // This is a fallback - hard to associate without context
      }
    } catch {}
  }

  // Strategy 3: Parse structured score data
  // Look for patterns like "第X题" (question X) near wrong markers
  const questionPattern = /第(\d+)题[\s\S]{0,200}?(?:答错|错误|wrong)/gi;
  
  // Strategy 4: Look for student+answer patterns
  // Pattern: student name followed by answer sequence (like ABCDA where wrong = specific chars)
  const answerLinePattern = /([^\n<]{2,15})\s*[：:]\s*([A-Da-d,\s]{3,})/g;
  let answerMatch;
  while ((answerMatch = answerLinePattern.exec(html)) !== null) {
    const name = answerMatch[1].trim();
    if (!/[\u4e00-\u9fff]/.test(name) && !/[A-Z]/.test(name)) continue;
    if (name.length < 2 || name.length > 20) continue;
    // Could process answer strings here
  }

  // Strategy 5: Look for the specific score report table format
  // These pages often have a ranking/score table with per-student per-question data
  // Format: student row with colored cells (red = wrong, green = correct)
  
  // Look for table with question headers (数字 columns)
  const tablePattern = /<table[\s\S]*?<\/table>/gi;
  const tables = html.match(tablePattern) || [];
  
  for (const table of tables) {
    // Check if this looks like a score table (has multiple number-like headers)
    const headers = table.match(/<th[^>]*>[\s\S]*?<\/th>/g) || [];
    const numericHeaders = headers.filter(h => />\s*\d+\s*<\/th>/.test(h));
    
    if (numericHeaders.length < 3) continue; // Not a question table
    
    // Get question numbers from headers
    const questionNumbers: number[] = [];
    numericHeaders.forEach(h => {
      const numMatch = h.match(/>\s*(\d+)\s*<\/th>/);
      if (numMatch) questionNumbers.push(parseInt(numMatch[1]));
    });
    
    // Parse student rows
    const tableRows = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    tableRows.forEach(row => {
      const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
      if (cells.length < 3) return;
      
      // First cell is usually student name
      const nameCell = cells[0];
      const nameText = nameCell.replace(/<[^>]+>/g, '').trim();
      if (!nameText || nameText.length < 2 || nameText.length > 25) return;
      if (!/[\u4e00-\u9fff]/.test(nameText) && !/[A-Z][a-z]/.test(nameText)) return;
      
      const wrongQs: number[] = [];
      cells.slice(1).forEach((cell, i) => {
        const isWrong = /color:\s*(?:red|#[Ff][0-9a-fA-F]{4})|class="[^"]*(?:wrong|error|red)|background[^:]*:\s*(?:red|#[Ff][0-9a-fA-F]{4})|✗|×/.test(cell);
        const isEmpty = />\s*[—\-×✗]\s*</.test(cell);
        if ((isWrong || isEmpty) && questionNumbers[i] !== undefined) {
          wrongQs.push(questionNumbers[i]);
        }
      });
      
      if (!studentMap.has(nameText)) {
        studentMap.set(nameText, {
          studentName: nameText,
          wrongQuestions: wrongQs,
          totalQuestions: questionNumbers.length,
        });
      }
    });
  }

  students.push(...studentMap.values());

  // Strategy 6: If no structured data found, look for simple name + question number patterns
  // This handles copy-pasted text or simplified HTML
  if (students.length === 0) {
    // Try to find text like "张三 错题: 1, 5, 10" or similar
    const simplePattern = /([^\n<]{2,15})\s*(?:错题|错误|wrong)[^\d]*([,\d\s]+)/gi;
    let simpleMatch;
    while ((simpleMatch = simplePattern.exec(html)) !== null) {
      const name = simpleMatch[1].trim();
      if (!/[\u4e00-\u9fff]/.test(name) && !/[A-Z][a-z]/.test(name)) continue;
      
      const nums = simpleMatch[2].match(/\d+/g)?.map(Number) || [];
      if (nums.length > 0 && !studentMap.has(name)) {
        studentMap.set(name, {
          studentName: name,
          wrongQuestions: nums,
        });
        students.push(studentMap.get(name)!);
      }
    }
  }

  return {
    examTitle,
    students,
    totalStudents: students.length,
  };
}
