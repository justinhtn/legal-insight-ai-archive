import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileText, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadDocument } from '@/services/documentService';
import { Client, Folder, getClients, getFolders, createClient, createFolder } from '@/services/clientService';

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
  currentClientId?: string;
  currentFolderId?: string;
}

const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({ 
  isOpen, 
  onClose, 
  onUpload,
  currentClientId,
  currentFolderId
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(currentClientId || '');
  const [selectedFolderId, setSelectedFolderId] = useState(currentFolderId || '');
  const [newClientName, setNewClientName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewClientInput, setShowNewClientInput] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadClients();
      if (currentClientId) {
        setSelectedClientId(currentClientId);
        loadFolders(currentClientId);
      }
      if (currentFolderId) {
        setSelectedFolderId(currentFolderId);
      }
    }
  }, [isOpen, currentClientId, currentFolderId]);

  useEffect(() => {
    if (selectedClientId) {
      loadFolders(selectedClientId);
    } else {
      setFolders([]);
      setSelectedFolderId('');
    }
  }, [selectedClientId]);

  const loadClients = async () => {
    try {
      const clientsData = await getClients();
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadFolders = async (clientId: string) => {
    try {
      const foldersData = await getFolders(clientId);
      setFolders(foldersData);
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;

    try {
      const newClient = await createClient({ name: newClientName.trim() });
      setClients([...clients, newClient]);
      setSelectedClientId(newClient.id);
      setNewClientName('');
      setShowNewClientInput(false);
      toast.success('Client created successfully');
    } catch (error) {
      console.error('Error creating client:', error);
      toast.error('Failed to create client');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !selectedClientId) return;

    try {
      const newFolder = await createFolder({
        client_id: selectedClientId,
        name: newFolderName.trim()
      });
      setFolders([...folders, newFolder]);
      setSelectedFolderId(newFolder.id);
      setNewFolderName('');
      setShowNewFolderInput(false);
      toast.success('Folder created successfully');
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
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
      // Update status to processing
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'processing', progress: 25 }
            : f
        )
      );

      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, progress: 50 }
            : f
        )
      );

      // Upload to backend with client and folder assignment
      await uploadDocumentWithAssignment(uploadFile.file);

      // Mark as completed
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'completed', progress: 100 }
            : f
        )
      );

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

  const uploadDocumentWithAssignment = async (file: File) => {
    const documentData = await uploadDocument(file);
    
    // Automatically assign to current client and folder if available
    const clientId = currentClientId || selectedClientId;
    const folderId = currentFolderId || selectedFolderId;
    
    if (clientId || folderId) {
      const { error } = await supabase
        .from('documents')
        .update({
          client_id: clientId || null,
          folder_id: folderId || null
        })
        .eq('id', documentData.id);

      if (error) {
        console.error('Assignment error:', error);
        throw new Error('Failed to assign document to client/folder');
      }
    }

    return documentData;
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

    // If we have current context, don't require manual selection
    if (!currentClientId && !selectedClientId) {
      toast.error('Please select a client for the documents.');
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Show current context if available */}
          {(currentClientId || currentFolderId) && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Documents will be uploaded to: 
                {currentClientId && <span className="font-medium"> Current Client</span>}
                {currentFolderId && <span className="font-medium"> → Current Folder</span>}
              </p>
            </div>
          )}

          {/* Only show client selection if no current context */}
          {!currentClientId && (
            <>
              {/* Client Selection */}
              <div className="space-y-2">
                <Label>Assign to Client *</Label>
                <div className="flex space-x-2">
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => setShowNewClientInput(true)}
                  >
                    + New Client
                  </Button>
                </div>

                {showNewClientInput && (
                  <div className="flex space-x-2 mt-2">
                    <Input
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Client name"
                      className="flex-1"
                    />
                    <Button onClick={handleCreateClient} size="sm">
                      Create
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setShowNewClientInput(false);
                        setNewClientName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {/* Folder Selection */}
              {selectedClientId && !currentFolderId && (
                <div className="space-y-2">
                  <Label>Document Type / Folder</Label>
                  <div className="flex space-x-2">
                    <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a folder (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {folders.map(folder => (
                          <SelectItem key={folder.id} value={folder.id}>
                            {folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={() => setShowNewFolderInput(true)}
                      disabled={!selectedClientId}
                    >
                      + New Folder
                    </Button>
                  </div>

                  {showNewFolderInput && (
                    <div className="flex space-x-2 mt-2">
                      <Input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder name"
                        className="flex-1"
                      />
                      <Button onClick={handleCreateFolder} size="sm">
                        Create
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setShowNewFolderInput(false);
                          setNewFolderName('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* File Drop Zone */}
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

          {/* File List */}
          {uploadedFiles.length > 0 && (
            <div>
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

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadedFiles.length === 0 || !uploadedFiles.some(f => f.status === 'completed') || (!currentClientId && !selectedClientId)}
            >
              Complete Upload ({uploadedFiles.filter(f => f.status === 'completed').length} processed)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentUploadModal;
