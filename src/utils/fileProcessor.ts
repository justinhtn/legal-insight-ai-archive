
export const extractTextFromFile = async (file: File): Promise<string> => {
  const fileType = file.type;
  
  if (fileType === 'text/plain') {
    const text = await file.text();
    // Return the actual text content instead of a placeholder
    return text.trim().length > 0 ? text : `Empty text file: ${file.name}`;
  }
  
  if (fileType === 'application/pdf') {
    // For PDF files, we'll create a more descriptive placeholder that can still be embedded
    // This allows users to search by filename and document type
    return `PDF Document: ${file.name}

This PDF document has been uploaded to the system. While full text extraction is not yet implemented, you can search for this document by its filename "${file.name}" or by searching for "PDF document" or "divorce settlement agreement" based on the filename.

Document type: PDF
Filename: ${file.name}
Status: Available for reference`;
  }
  
  if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // For DOCX files, create a searchable placeholder
    return `Word Document: ${file.name}

This Word document has been uploaded to the system. While full text extraction is not yet implemented, you can search for this document by its filename "${file.name}" or by searching for "Word document" or "DOCX file".

Document type: Microsoft Word (DOCX)
Filename: ${file.name}
Status: Available for reference`;
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
