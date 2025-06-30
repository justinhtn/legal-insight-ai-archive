
import React from 'react';
import { FileExplorerProvider } from '@/contexts/FileExplorerContext';
import FileExplorerLayout from './explorer/FileExplorerLayout';

const FileExplorer: React.FC = () => {
  return (
    <FileExplorerProvider>
      <FileExplorerLayout />
    </FileExplorerProvider>
  );
};

export default FileExplorer;
