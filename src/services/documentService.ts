
import { supabase } from '@/integrations/supabase/client';
import { processFile } from '@/utils/fileProcessor';

export interface Document {
  id: string;
  user_id: string;
  folder_id?: string;
  name: string;
  size?: number;
  uploaded_at: string;
  file_type: string;
  content?: string;
}

export const getDocuments = async (folderId: string): Promise<Document[]> => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('folder_id', folderId)
    .order('title');

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  // Map database fields to our interface
  return (data || []).map(doc => ({
    id: doc.id,
    user_id: doc.user_id,
    folder_id: doc.folder_id,
    name: doc.title || doc.file_name,
    size: doc.file_size,
    uploaded_at: doc.created_at,
    file_type: doc.file_type,
    content: doc.content
  }));
};

export const uploadDocument = async (
  file: File, 
  clientId?: string | null, 
  folderId?: string | null
): Promise<any> => {
  try {
    console.log('Processing file before upload:', file.name);
    
    // Process the file to extract content
    const { content, extractedData } = await processFile(file);
    
    // Prepare the JSON payload for the edge function
    const payload = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      content: content,
      title: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension for title
      extractedData: extractedData,
      clientId: clientId,
      folderId: folderId
    };

    console.log('Sending JSON payload to edge function:', {
      fileName: payload.fileName,
      fileType: payload.fileType,
      fileSize: payload.fileSize,
      contentLength: payload.content.length,
      hasExtractedData: !!payload.extractedData
    });

    // Call the Supabase Edge Function with JSON payload
    const { data, error } = await supabase.functions.invoke('process-document', {
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    console.log('Edge function response:', data);
    return data;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};
