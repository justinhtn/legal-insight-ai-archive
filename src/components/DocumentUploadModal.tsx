import React, { useState, useRef } from 'react';
import { Upload, X, FileText, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { uploadDocument } from '@/services/documentService';
import { getClients, Client, getFolders, Folder } from '@/services/clientService';

interface UploadedFile {
  file: File;
  id: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
}

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => void;
  selectedClientId?: string;
  selectedFolderId?: string;
}

const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({ 
  isOpen, 
  onClose, 
  onUpload, 
  selectedClientId,
  selectedFolderId 
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentClientId, setCurrentClientId] = useState<string>(selectedClientId || 'none');
  const [currentFolderId, setCurrentFolderId] = useState<string>(selectedFolderId || 'none');
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      loadClients();
      if (selectedClientId) {
        setCurrentClientId(selectedClientId);
        loadFolders(selectedClientId);
      }
      if (selectedFolderId) {
        setCurrentFolderId(selectedFolderId);
      }
    }
  }, [isOpen, selectedClientId, selectedFolderId]);

  React.useEffect(() => {
    if (currentClientId && currentClientId !== 'none') {
      loadFolders(currentClientId);
      if (currentClientId !== selectedClientId) {
        setCurrentFolderId('none');
      }
    } else {
      setFolders([]);
      setCurrentFolderId('none');
    }
  }, [currentClientId]);

  const loadClients = async () => {
    setIsLoadingClients(true);
    try {
      const clientsData = await getClients();
      setClients(clientsData);
      console.log('Loaded clients:', clientsData.length);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setIsLoadingClients(false);
    }
  };

  const loadFolders = async (clientId: string) => {
    if (!clientId || clientId === 'none') {
      setFolders([]);
      return;
    }
    
    setIsLoadingFolders(true);
    try {
      const foldersData = await getFolders(clientId);
      setFolders(foldersData);
      console.log('Loaded folders for client', clientId, ':', foldersData.length);
    } catch (error) {
      console.error('Error loading folders:', error);
      toast.error('Failed to load folders');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter(file => {
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      const maxSize = 100 * 1024 * 1024; // 100MB
      
      if (!validTypes.includes(file.type)) {
        toast.error(`${file.name} is not a supported file type. Please upload PDF, DOCX, or TXT files.`);
        return false;
      }
      
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large. Maximum file size is 100MB.`);
        return false;
      }
      
      return true;
    });

    const newFiles = validFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    // Process each file
    newFiles.forEach(processFile);
  };

  const processFile = async (uploadFile: UploadedFile) => {
    try {
      console.log('Processing file:', uploadFile.file.name);
      console.log('Current client ID:', currentClientId);
      console.log('Current folder ID:', currentFolderId);
      
      // Update status to processing
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'processing', progress: 25 }
            : f
        )
      );

      // Convert special values to null for API
      const clientIdToUse = currentClientId === 'none' ? null : currentClientId;
      const folderIdToUse = currentFolderId === 'none' ? null : currentFolderId;
      
      console.log('Uploading with assignments:', { clientIdToUse, folderIdToUse });
      
      // Update progress during processing
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, progress: 75 }
            : f
        )
      );
      
      const result = await uploadDocument(
        uploadFile.file, 
        clientIdToUse, 
        folderIdToUse
      );

      console.log('Upload result:', result);

      // Mark as completed
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'completed', progress: 100 }
            : f
        )
      );

      toast.success(`Successfully processed ${uploadFile.file.name}`);

    } catch (error) {
      console.error('Error processing file:', error);
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'error', progress: 0 }
            : f
        )
      );
      toast.error(`Failed to process ${uploadFile.file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUpload = () => {
    const completedFiles = uploadedFiles.filter(f => f.status === 'completed');
    if (completedFiles.length === 0) {
      toast.error('No successfully processed files to confirm.');
      return;
    }
    
    onUpload(completedFiles.map(f => f.file));
    toast.success(`Successfully processed ${completedFiles.length} document(s) with AI embeddings`);
    setUploadedFiles([]);
    onClose();
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
    if (fileType.includes('word')) return <FileText className="h-4 w-4 text-blue-500" />;
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'processing': return 'bg-yellow-500';
      default: return 'bg-primary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Processed';
      case 'error': return 'Error';
      case 'processing': return 'Processing...';
      default: return 'Uploading...';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Upload Documents</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Client Selection */}
          <div className="space-y-4 mb-6">
            <div>
              <Label htmlFor="client-select">Client (Optional)</Label>
              <Select 
                value={currentClientId} 
                onValueChange={setCurrentClientId}
                disabled={isLoadingClients}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingClients ? "Loading clients..." : "Select a client"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Client (General Upload)</SelectItem>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentClientId && currentClientId !== 'none' && (
              <div>
                <Label htmlFor="folder-select">Folder (Optional)</Label>
                <Select 
                  value={currentFolderId} 
                  onValueChange={setCurrentFolderId}
                  disabled={isLoadingFolders}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingFolders ? "Loading folders..." : "Select a folder"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Client Root (No Folder)</SelectItem>
                    {folders.map(folder => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Drop files here or click to browse</p>
            <p className="text-sm text-muted-foreground mb-4">
              Supports PDF, DOCX, and TXT files up to 100MB each. Files will be processed with AI for intelligent search.
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
            >
              Select Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
          </div>

          {uploadedFiles.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium mb-3">Processing Files</h3>
              <div className="space-y-2 max-h-40 overflow-auto">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    {getFileIcon(file.file.type)}
                    <div className="flex-1">
                      <p className="text-sm font-medium truncate">{file.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.file.size / 1024 / 1024).toFixed(1)} MB • {getStatusText(file.status)}
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                        <div
                          className={`h-1 rounded-full transition-all ${getStatusColor(file.status)}`}
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(file.id)}
                      className="h-8 w-8"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadedFiles.length === 0 || !uploadedFiles.some(f => f.status === 'completed')}
            >
              Complete Upload ({uploadedFiles.filter(f => f.status === 'completed').length} processed)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentUploadModal;
