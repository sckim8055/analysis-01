import * as XLSX from 'xlsx';

export const exportHtmlTableToExcel = (title: string, filename: string, tableIds: string[], appendTexts: string[] = []) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([[title]]);
    
    let currentRow = 2; // Start after title and a blank row
    
    tableIds.forEach(id => {
        const table = document.getElementById(id) as HTMLTableElement;
        if (table) {
            const tempWs = XLSX.utils.table_to_sheet(table, { raw: true });
            const ref = tempWs['!ref'];
            if (ref) {
                const range = XLSX.utils.decode_range(ref);
                const aoa = XLSX.utils.sheet_to_json(tempWs, {header: 1, defval: ''}) as any[][];
                
                // Append aoa to ws at currentRow
                XLSX.utils.sheet_add_aoa(ws, aoa, {origin: `A${currentRow}`});
                
                // Copy merges if any
                if (tempWs['!merges']) {
                    if (!ws['!merges']) ws['!merges'] = [];
                    tempWs['!merges'].forEach(m => {
                        ws['!merges']!.push({
                            s: { r: m.s.r + currentRow - 1, c: m.s.c },
                            e: { r: m.e.r + currentRow - 1, c: m.e.c }
                        });
                    });
                }
                currentRow += (range.e.r - range.s.r + 3); // add gap between tables
            }
        }
    });
    
    // Add appendTexts if provided
    if (appendTexts && appendTexts.length > 0) {
        const textAoa = appendTexts.map(text => [text]);
        XLSX.utils.sheet_add_aoa(ws, textAoa, {origin: `A${currentRow}`});
        currentRow += appendTexts.length + 1;
    }
    
    // Auto-size columns slightly
    if (ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        const colWidths: { wch: number }[] = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
            colWidths[C] = { wch: 12 }; // Default width
        }
        ws['!cols'] = colWidths;
    }

    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
};
