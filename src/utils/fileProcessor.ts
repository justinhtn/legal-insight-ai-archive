
export const extractTextFromFile = async (file: File): Promise<string> => {
  const fileType = file.type;
  
  if (fileType === 'text/plain') {
    return await file.text();
  }
  
  if (fileType === 'application/pdf') {
    // For PDF files, we'll need a simple text extraction
    // This is a basic implementation - in production you might want to use a proper PDF parser
    try {
      const arrayBuffer = await file.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      // Very basic PDF text extraction - in reality you'd want a proper PDF parser like pdf-parse
      return extractPdfText(text);
    } catch (error) {
      throw new Error('Failed to extract text from PDF');
    }
  }
  
  if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // For DOCX files, this is a simplified extraction
    // In production, you'd want to use a proper DOCX parser
    try {
      const text = await file.text();
      return extractDocxText(text);
    } catch (error) {
      throw new Error('Failed to extract text from DOCX');
    }
  }
  
  throw new Error(`Unsupported file type: ${fileType}`);
};

const extractPdfText = (pdfContent: string): string => {
  // Very basic PDF text extraction - this is simplified
  // In production, use a proper PDF parser library
  const textMatches = pdfContent.match(/\((.*?)\)/g);
  if (textMatches) {
    return textMatches
      .map(match => match.slice(1, -1))
      .join(' ')
      .replace(/\\[nr]/g, '\n');
  }
  return 'PDF content could not be extracted';
};

const extractDocxText = (docxContent: string): string => {
  // Very basic DOCX text extraction - this is simplified
  // In production, use a proper DOCX parser library
  try {
    // Remove XML tags and extract text content
    const textContent = docxContent.replace(/<[^>]*>/g, ' ');
    return textContent.replace(/\s+/g, ' ').trim();
  } catch (error) {
    return 'DOCX content could not be extracted';
  }
};
