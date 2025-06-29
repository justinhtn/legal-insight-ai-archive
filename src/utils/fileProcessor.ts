
export const extractTextFromFile = async (file: File): Promise<string> => {
  const fileType = file.type;
  
  if (fileType === 'text/plain') {
    return await file.text();
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
  
  throw new Error(`Unsupported file type: ${fileType}`);
};
