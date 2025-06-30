
export interface DocumentHighlight {
  text: string;
  page?: number;
  lines?: string;
}

export const openDocumentWithHighlights = (
  documentTitle: string,
  documentContent: string,
  highlights: DocumentHighlight[],
  query: string
) => {
  // Create a new window/tab
  const newWindow = window.open('', '_blank');
  
  if (!newWindow) {
    console.error('Failed to open new window - popup blocked?');
    return;
  }

  // Helper function to highlight content
  function highlightContent(content: string, highlights: DocumentHighlight[]) {
    let result = content;
    highlights.forEach((highlight, index) => {
      const regex = new RegExp(highlight.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      result = result.replace(regex, `<span id="highlight-${index}" class="highlight">${highlight.text}</span>`);
    });
    return result;
  }

  // Generate the HTML content for the document viewer
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${documentTitle} - Document Viewer</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .header { padding: 1rem; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
        .title { font-size: 1.25rem; font-weight: 600; color: #111827; margin-bottom: 0.25rem; }
        .query { font-size: 0.875rem; color: #6b7280; }
        .controls { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; }
        .btn { padding: 0.5rem 1rem; border: 1px solid #d1d5db; background: white; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; }
        .btn:hover { background: #f3f4f6; }
        .content { padding: 1.5rem; font-family: monospace; font-size: 0.875rem; line-height: 1.6; white-space: pre-wrap; }
        .highlight { background: #fef3c7; padding: 0.125rem 0.25rem; border-radius: 0.25rem; }
        .current-highlight { background: #fbbf24; }
        .sidebar { position: fixed; right: 0; top: 0; width: 300px; height: 100vh; background: #f9fafb; border-left: 1px solid #e5e7eb; overflow-y: auto; }
        .sidebar-header { padding: 1rem; border-bottom: 1px solid #e5e7eb; font-weight: 600; }
        .highlight-item { padding: 0.75rem; border-bottom: 1px solid #e5e7eb; cursor: pointer; }
        .highlight-item:hover { background: #f3f4f6; }
        .highlight-meta { font-weight: 500; margin-bottom: 0.25rem; color: #374151; }
        .highlight-text { color: #6b7280; font-size: 0.875rem; }
        .main-content { margin-right: 300px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${documentTitle}</div>
        <div class="query">Query: "${query}"</div>
        <div class="controls">
          <span id="highlight-counter">Highlight 1 of ${highlights.length}</span>
          <button class="btn" onclick="prevHighlight()">Previous</button>
          <button class="btn" onclick="nextHighlight()">Next</button>
          <button class="btn" onclick="toggleSidebar()">Toggle Highlights</button>
          <button class="btn" onclick="window.close()">Close</button>
        </div>
      </div>
      
      <div class="main-content">
        <div class="content" id="document-content">${highlightContent(documentContent, highlights)}</div>
      </div>
      
      <div class="sidebar" id="sidebar">
        <div class="sidebar-header">Highlights (${highlights.length})</div>
        ${highlights.map((highlight, index) => `
          <div class="highlight-item" onclick="scrollToHighlight(${index})">
            <div class="highlight-meta">
              ${highlight.page ? `Page ${highlight.page}` : ''}
              ${highlight.lines ? ` • ${highlight.lines}` : ''}
            </div>
            <div class="highlight-text">"${highlight.text.substring(0, 100)}${highlight.text.length > 100 ? '...' : ''}"</div>
          </div>
        `).join('')}
      </div>

      <script>
        let currentHighlight = 0;
        const totalHighlights = ${highlights.length};
        
        function scrollToHighlight(index) {
          const element = document.getElementById('highlight-' + index);
          if (element) {
            // Remove current highlight
            document.querySelectorAll('.current-highlight').forEach(el => el.classList.remove('current-highlight'));
            // Add current highlight
            element.classList.add('current-highlight');
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            currentHighlight = index;
            updateCounter();
          }
        }
        
        function nextHighlight() {
          const next = (currentHighlight + 1) % totalHighlights;
          scrollToHighlight(next);
        }
        
        function prevHighlight() {
          const prev = currentHighlight === 0 ? totalHighlights - 1 : currentHighlight - 1;
          scrollToHighlight(prev);
        }
        
        function toggleSidebar() {
          const sidebar = document.getElementById('sidebar');
          const mainContent = document.querySelector('.main-content');
          if (sidebar.style.display === 'none') {
            sidebar.style.display = 'block';
            mainContent.style.marginRight = '300px';
          } else {
            sidebar.style.display = 'none';
            mainContent.style.marginRight = '0';
          }
        }
        
        function updateCounter() {
          document.getElementById('highlight-counter').textContent = 'Highlight ' + (currentHighlight + 1) + ' of ' + totalHighlights;
        }
        
        // Initialize first highlight
        setTimeout(() => scrollToHighlight(0), 100);
      </script>
    </body>
    </html>
  `;

  // Write the HTML content to the new window
  newWindow.document.write(htmlContent);
  newWindow.document.close();
};
