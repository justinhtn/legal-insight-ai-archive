
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ExtractedTextData {
  pages: Array<{
    pageNum: number;
    lines: string[];
    fullText: string;
  }>;
  totalPages: number;
  fullText: string;
}

export interface TextChunk {
  text: string;
  pageNumber: number;
  lineStart: number;
  lineEnd: number;
  index: number;
  metadata: {
    documentName: string;
    client?: string;
    matter?: string;
  };
}

export const extractTextFromPDF = async (file: File): Promise<ExtractedTextData> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const pages: Array<{pageNum: number; lines: string[]; fullText: string}> = [];
    let fullText = '';
    
    console.log(`Processing PDF with ${pdf.numPages} pages`);
    
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex);
      const textContent = await page.getTextContent();
      
      // Extract text items and group by lines
      const lines: string[] = [];
      let currentLine = '';
      let currentY = -1;
      
      textContent.items.forEach((item: any) => {
        if (item.str && item.str.trim()) {
          // Check if this is a new line based on Y position
          if (currentY === -1) {
            currentY = item.transform[5];
          }
          
          const yPos = item.transform[5];
          const yDiff = Math.abs(yPos - currentY);
          
          if (yDiff > 5) { // New line threshold
            if (currentLine.trim()) {
              lines.push(currentLine.trim());
            }
            currentLine = item.str;
            currentY = yPos;
          } else {
            currentLine += ' ' + item.str;
          }
        }
      });
      
      // Add the last line
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      
      const pageText = lines.join('\n');
      pages.push({
        pageNum: pageIndex,
        lines: lines,
        fullText: pageText
      });
      
      fullText += pageText + '\n\n';
    }
    
    console.log(`Successfully extracted text from ${pages.length} pages`);
    
    return {
      pages,
      totalPages: pdf.numPages,
      fullText: fullText.trim()
    };
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const createChunks = (extractedData: ExtractedTextData, options: {
  chunkSize: number;
  overlap: number;
  preserveContext: boolean;
}, documentName: string): TextChunk[] => {
  const { chunkSize, overlap, preserveContext } = options;
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;
  
  console.log(`Creating chunks with size ${chunkSize}, overlap ${overlap}`);
  
  for (const page of extractedData.pages) {
    const pageText = page.fullText;
    let startIndex = 0;
    
    while (startIndex < pageText.length) {
      let endIndex = Math.min(startIndex + chunkSize, pageText.length);
      
      // Try to break at sentence boundaries if preserveContext is true
      if (preserveContext && endIndex < pageText.length) {
        const lastPeriod = pageText.lastIndexOf('.', endIndex);
        const lastSpace = pageText.lastIndexOf(' ', endIndex);
        
        if (lastPeriod > startIndex + chunkSize * 0.8) {
          endIndex = lastPeriod + 1;
        } else if (lastSpace > startIndex + chunkSize * 0.8) {
          endIndex = lastSpace;
        }
      }
      
      const chunkText = pageText.slice(startIndex, endIndex).trim();
      
      if (chunkText.length > 50) { // Only include meaningful chunks
        // Calculate line numbers for this chunk
        const beforeChunk = pageText.slice(0, startIndex);
        const chunkLines = chunkText.split('\n').length;
        const lineStart = beforeChunk.split('\n').length;
        const lineEnd = lineStart + chunkLines - 1;
        
        chunks.push({
          text: chunkText,
          pageNumber: page.pageNum,
          lineStart,
          lineEnd,
          index: chunkIndex++,
          metadata: {
            documentName,
            client: extractClientFromFilename(documentName),
            matter: extractMatterFromFilename(documentName)
          }
        });
      }
      
      // Move to next chunk with overlap
      const nextStart = Math.max(startIndex + chunkSize - overlap, endIndex);
      if (nextStart <= startIndex) {
        break; // Prevent infinite loop
      }
      startIndex = nextStart;
    }
  }
  
  console.log(`Created ${chunks.length} chunks from document`);
  return chunks;
};

const extractClientFromFilename = (filename: string): string | undefined => {
  // Try to extract client name from filename patterns like "ClientName_DocumentType.pdf"
  const patterns = [
    /^([^_]+)_/,  // ClientName_DocumentType
    /^([^-]+)-/,  // ClientName-DocumentType
    /^([^\.]+)\./  // ClientName.DocumentType
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return match[1].replace(/[_-]/g, ' ').trim();
    }
  }
  
  return undefined;
};

const extractMatterFromFilename = (filename: string): string | undefined => {
  // Try to extract matter type from filename
  const matterTypes = ['divorce', 'custody', 'settlement', 'contract', 'agreement'];
  const lowerFilename = filename.toLowerCase();
  
  for (const matterType of matterTypes) {
    if (lowerFilename.includes(matterType)) {
      return matterType;
    }
  }
  
  return undefined;
};

export const processTextFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as string);
      } else {
        reject(new Error('Failed to read text file'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
  });
};

export const processFile = async (file: File): Promise<{ content: string; extractedData?: ExtractedTextData }> => {
  console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);
  
  if (file.type === 'application/pdf') {
    const extractedData = await extractTextFromPDF(file);
    return {
      content: extractedData.fullText,
      extractedData
    };
  } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    const content = await processTextFile(file);
    return { content };
  } else {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
};
