/* ==========================================================================
   AQUA INSIGHT FILE UTILITIES & SHEETJS INTEGRATION
   Handles: Native Excel (.xlsx) workbook exports, CSV fallbacks, and CSV parsers.
   ========================================================================== */

window.AquaFile = {
  // 1. Export Data to Native Excel Workbook (.xlsx)
  // sheets: Array of { name: String, data: Array of Objects or Array of Arrays }
  // filename: String (e.g., 'report.xlsx')
  exportToExcel: function(sheets, filename = "aqua_insight_export.xlsx") {
    // Check if SheetJS library is loaded from CDN
    if (typeof XLSX === "undefined") {
      console.warn("SheetJS (XLSX) tidak terdeteksi. Melakukan fallback ke unduhan CSV.");
      // Fallback: Export the first sheet as CSV
      if (sheets.length > 0) {
        this.exportToCSV(sheets[0].data, filename.replace(".xlsx", ".csv"));
      } else {
        alert("Tidak ada data untuk diekspor.");
      }
      return;
    }
    
    try {
      // Create new Workbook
      const wb = XLSX.utils.book_new();
      
      sheets.forEach(sheet => {
        let ws;
        // Check if data is array of arrays or array of objects
        if (Array.isArray(sheet.data[0])) {
          ws = XLSX.utils.aoa_to_sheet(sheet.data);
        } else {
          ws = XLSX.utils.json_to_sheet(sheet.data);
        }
        
        // Auto-fit column widths (premium aesthetic)
        const maxCols = this.getMaxColsCount(sheet.data);
        const colWidths = [];
        for (let i = 0; i < maxCols; i++) {
          colWidths.push({ wch: 15 }); // default width
        }
        ws['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31)); // xlsx sheet names are capped at 31 chars
      });
      
      // Write workbook to file
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error("Gagal melakukan ekspor Excel: ", err);
      alert("Gagal melakukan ekspor data ke Excel: " + err.message);
    }
  },
  
  // Helper to determine columns count
  getMaxColsCount: function(data) {
    if (data.length === 0) return 0;
    if (Array.isArray(data[0])) {
      return data[0].length;
    } else {
      return Object.keys(data[0]).length;
    }
  },
  
  // 2. Fallback CSV Exporter (Pure Vanilla JS)
  exportToCSV: function(data, filename = "data.csv") {
    if (data.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }
    
    let csvContent = "";
    
    // Check format
    if (Array.isArray(data[0])) {
      // Array of Arrays
      data.forEach(row => {
        const rowStr = row.map(val => {
          const str = String(val === null || val === undefined ? "" : val);
          return `"${str.replace(/"/g, '""')}"`;
        }).join(",");
        csvContent += rowStr + "\r\n";
      });
    } else {
      // Array of Objects
      const headers = Object.keys(data[0]);
      csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\r\n";
      
      data.forEach(row => {
        const rowStr = headers.map(h => {
          const val = row[h];
          const str = String(val === null || val === undefined ? "" : val);
          return `"${str.replace(/"/g, '""')}"`;
        }).join(",");
        csvContent += rowStr + "\r\n";
      });
    }
    
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" }); // UTF-8 BOM for Excel compatibility
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  
  // 3. Client-side CSV Parser with Double-quote handling
  parseCSV: function(text) {
    const lines = [];
    const pattern = new RegExp(
      "(\\,|\\r?\\n|\\r|^)" + // delimiter or new line
      "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" + // quoted fields
      "([^\"\\,\\r\\n]*))", // standard fields
      "gi"
    );
    
    let currentLine = [];
    let matches = null;
    
    // Check if text is empty
    if (text.trim() === "") return [];
    
    while ((matches = pattern.exec(text))) {
      const matchedDelimiter = matches[1];
      
      // If we matched a new line, push the current line array to lines
      if (matchedDelimiter.length && matchedDelimiter !== ",") {
        lines.push(currentLine);
        currentLine = [];
      }
      
      let matchedValue;
      if (matches[2] !== undefined) {
        // Quoted field: strip surrounding quotes and replace double quotes
        matchedValue = matches[2].replace(/\"\"/g, '"');
      } else {
        // Unquoted field
        matchedValue = matches[3];
      }
      
      currentLine.push(matchedValue.trim());
    }
    
    // Push final line
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    // Remove empty trailing lines
    return lines.filter(line => line.length > 0 && !(line.length === 1 && line[0] === ""));
  }
};
