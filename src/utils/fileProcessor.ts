
export const extractTextFromFile = async (file: File): Promise<string> => {
  const fileType = file.type;
  
  if (fileType === 'text/plain') {
    const text = await file.text();
    // Return the actual text content instead of a placeholder
    return text.trim().length > 0 ? text : `Text file: ${file.name}\n\nThis text file appears to be empty or contains only whitespace.`;
  }
  
  if (fileType === 'application/pdf') {
    // For PDF files, return a placeholder since we can't properly parse PDFs in the browser
    // In a production app, you'd want to use a proper PDF parsing library or handle this server-side
    return `PDF Document: ${file.name}\n\nThis is a PDF file that requires server-side processing for text extraction. The document has been uploaded and can be referenced by its filename.`;
  }
  
  if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // For DOCX files, return a placeholder since proper DOCX parsing requires specialized libraries
    return `DOCX Document: ${file.name}\n\nThis is a Word document that requires specialized processing for text extraction. The document has been uploaded and can be referenced by its filename.`;
  }
  
  // Try to read as text for any other file type
  try {
    const text = await file.text();
    if (text.trim().length > 0) {
      return text;
    }
  } catch (error) {
    console.log('Could not read file as text:', error);
  }
  
  throw new Error(`Unsupported file type: ${fileType}`);
};
