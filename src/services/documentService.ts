import { supabase } from '@/integrations/supabase/client';
import { processFile } from '@/utils/fileProcessor';

export interface DocumentUploadData {
  fileName: string;
  fileType: string;
  fileSize: number;
  content: string;
  title?: string;
  extractedData?: any;
  clientId?: string;
  folderId?: string;
}

export const uploadDocument = async (file: File, clientId?: string, folderId?: string) => {
  try {
    console.log('Starting document upload process for:', file.name, 'clientId:', clientId, 'folderId:', folderId);
    
    // Process the file to extract text content
    const { content, extractedData } = await processFile(file);
    
    if (!content || content.trim().length === 0) {
      throw new Error('No text content could be extracted from the file');
    }

    console.log(`Extracted ${content.length} characters from ${file.name}`);
    if (extractedData) {
      console.log(`PDF processing: ${extractedData.totalPages} pages, ${extractedData.pages?.length} page objects`);
    }

    const documentData: DocumentUploadData = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      content,
      title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
      extractedData, // Pass the extracted page/line data
      clientId: clientId || undefined,
      folderId: folderId || undefined
    };

    console.log('Calling process-document function with:', {
      fileName: documentData.fileName,
      clientId: documentData.clientId,
      folderId: documentData.folderId
    });

    const { data, error } = await supabase.functions.invoke('process-document', {
      body: documentData
    });

    if (error) {
      console.error('Supabase function error:', error);
      throw new Error(`Failed to process document: ${error.message}`);
    }

    if (!data?.success) {
      console.error('Process document function returned error:', data);
      throw new Error(data?.error || 'Unknown error processing document');
    }

    console.log('Document processing completed successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in uploadDocument:', error);
    throw error;
  }
};

export const getDocuments = async () => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return data;
};

export const deleteDocument = async (documentId: string) => {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
};
