
import React, { useState } from 'react';
import { Client, Folder } from '@/services/clientService';

interface VSCodeExplorerProps {
  clients: Client[];
  folders: Folder[];
  selectedClientId?: string;
  selectedFolderId?: string;
  onClientSelect: (clientId: string) => void;
  onFolderClick: (folderId: string) => void;
  onFileClick: (file: any) => void;
  onNewClient: () => void;
  isLoading?: boolean;
}

const VSCodeExplorer: React.FC<VSCodeExplorerProps> = ({
  clients,
  folders,
  selectedClientId,
  selectedFolderId,
  onClientSelect,
  onFolderClick,
  onFileClick,
  onNewClient,
  isLoading = false
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Categorize clients
  const activeClients = clients.filter(client => 
    !client.matter_type || 
    !['closed', 'completed', 'settled'].some(status => 
      client.matter_type?.toLowerCase().includes(status)
    )
  );
  
  const closedClients = clients.filter(client => 
    client.matter_type && 
    ['closed', 'completed', 'settled'].some(status => 
      client.matter_type?.toLowerCase().includes(status)
    )
  );

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
    
    if (!expandedClients[clientId]) {
      onClientSelect(clientId);
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
    onFolderClick(folderId);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
      case 'txt': return '📄';
      case 'xlsx':
      case 'xls': return '📊';
      default: return '📄';
    }
  };

  const getCaseTypeIcon = (matterType?: string) => {
    if (!matterType) return '⚖️';
    const type = matterType.toLowerCase();
    if (type.includes('divorce')) return '💔';
    if (type.includes('contract')) return '📋';
    if (type.includes('criminal')) return '🚔';
    if (type.includes('personal injury')) return '🏥';
    return '⚖️';
  };

  if (isLoading) {
    return (
      <div className={`explorer-panel ${collapsed ? 'collapsed' : ''}`}>
        <div className="explorer-header">
          <span className="explorer-title">📁 LEGAL EXPLORER</span>
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '⟩' : '⟨'}
          </button>
        </div>
        <div className="p-4 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="explorer-panel collapsed">
        <div className="explorer-header">
          <button className="collapse-btn" onClick={() => setCollapsed(false)}>
            ⟩
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="explorer-panel">
      <div className="explorer-header">
        <span className="explorer-title">📁 LEGAL EXPLORER</span>
        <button className="collapse-btn" onClick={() => setCollapsed(true)}>
          ⟨
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Active Cases Section */}
        <div className="section-header">
          <span className="section-icon">👥</span>
          <span className="section-title">CLIENTS</span>
          <span className="section-count">({activeClients.length} active)</span>
        </div>

        {activeClients.map((client) => {
          const isExpanded = expandedClients[client.id];
          const isSelected = selectedClientId === client.id;
          const clientFolders = folders.filter(f => f.client_id === client.id && !f.parent_folder_id);
          
          return (
            <div key={client.id} className="client-entry">
              <div 
                className={`client-header ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleClient(client.id)}
              >
                <span className={`disclosure ${isExpanded ? 'expanded' : ''}`}>▶</span>
                <span className="client-icon">{getCaseTypeIcon(client.matter_type)}</span>
                <div className="client-info">
                  <div className="client-name">{client.name}</div>
                  <div className="client-meta">
                    {client.matter_type || 'General'} 
                    {client.case_number && ` • Case #${client.case_number}`}
                    • Active
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="client-files">
                  {clientFolders.map((folder) => (
                    <div 
                      key={folder.id}
                      className="folder-item"
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <span className="file-icon">📁</span>
                      <span className="file-name">{folder.name}</span>
                    </div>
                  ))}
                  
                  {/* Sample files for demo - replace with actual file loading */}
                  {client.id === selectedClientId && (
                    <>
                      <div 
                        className="file-item"
                        onClick={() => onFileClick({
                          id: 'sample-1',
                          name: 'sample-divorce-petition.txt',
                          type: 'file'
                        })}
                      >
                        <span className="file-icon">📄</span>
                        <span className="file-name">sample-divorce-petition.txt</span>
                      </div>
                      <div 
                        className="file-item"
                        onClick={() => onFileClick({
                          id: 'sample-2', 
                          name: 'financial-summary.pdf',
                          type: 'file'
                        })}
                      >
                        <span className="file-icon">📄</span>
                        <span className="file-name">financial-summary.pdf</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Closed Cases Section */}
        {closedClients.length > 0 && (
          <>
            <div className="section-header">
              <span className="section-icon">📁</span>
              <span className="section-title">CLOSED CASES</span>
              <span className="section-count">({closedClients.length})</span>
            </div>

            {closedClients.map((client) => (
              <div key={client.id} className="client-entry">
                <div 
                  className="client-header"
                  onClick={() => toggleClient(client.id)}
                >
                  <span className="disclosure">▶</span>
                  <span className="client-icon">📁</span>
                  <div className="client-info">
                    <div className="client-name">{client.name}</div>
                    <div className="client-meta">
                      {client.matter_type || 'General'} • Closed
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {clients.length === 0 && (
          <div className="p-4 text-center">
            <div className="welcome-content">
              <div className="text-2xl mb-2">👥</div>
              <div className="text-sm text-gray-600">No clients yet</div>
              <button 
                onClick={onNewClient}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800"
              >
                Create your first client
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VSCodeExplorer;
