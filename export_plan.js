import fs from 'fs';
import * as XLSX from 'xlsx';
import path from 'path';

const inputFile = 'docx/前端工作汇报规划_2026.03-10.md';
const outputFile = 'docx/前端工作汇报规划_2026.03-10.xlsx';

try {
    const mdContent = fs.readFileSync(inputFile, 'utf-8');
    const lines = mdContent.split('\n');

    const data = [];
    let currentPhase = '';

    // Regex for table row: starts and ends with |, has 3 parts inside
    // Note: This regex is simple and assumes no escaped pipes inside cells, which holds for the target file.
    const rowRegex = /^\|(.*?)\|(.*?)\|(.*?)\|$/;
    const separatorRegex = /^\|[:\-\s]+\|[:\-\s]+\|[:\-\s]+\|$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check for Phase header (e.g., ### 第一阶段...)
        if (line.startsWith('### ')) {
            currentPhase = line.replace('### ', '').trim();
            continue;
        }

        if (line.startsWith('|')) {
            // Skip separator lines
            if (separatorRegex.test(line)) continue;
            
            const match = line.match(rowRegex);
            if (match) {
                let time = match[1].trim();
                let task = match[2].trim();
                let deliverable = match[3].trim();
                
                // Skip header row
                if (time.includes('时间周期')) continue;

                // Clean up Markdown
                // 1. Replace <br> with newline
                const clean = (text) => {
                    return text
                        .replace(/<br>/g, '\n')
                        .replace(/\*\*/g, '') // Remove bold
                        .replace(/`/g, '')    // Remove code ticks
                        .trim();
                };

                data.push({
                    '阶段 (Phase)': currentPhase,
                    '时间周期 (Time)': clean(time),
                    '细分任务 (Task)': clean(task),
                    '关键产出 (Deliverable)': clean(deliverable)
                });
            }
        }
    }

    if (data.length === 0) {
        console.error("No data found to export.");
        process.exit(1);
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Style/Widths
    ws['!cols'] = [
        { wch: 40 }, // Phase
        { wch: 20 }, // Time
        { wch: 60 }, // Task
        { wch: 60 }  // Deliverable
    ];

    // Enable text wrapping (Note: xlsx basic write doesn't fully support styling without Pro version or additional complexity, 
    // but line breaks \n work in Excel if "Wrap Text" is enabled. We can't set "Wrap Text" property easily with basic xlsx lib 
    // without using cell styles which might not be supported in the open source version write. 
    // However, the content will be there.)
    
    XLSX.utils.book_append_sheet(wb, ws, "工作规划");

    XLSX.writeFile(wb, outputFile);
    console.log(`Successfully created ${outputFile}`);

} catch (err) {
    console.error("Error:", err);
    process.exit(1);
}
