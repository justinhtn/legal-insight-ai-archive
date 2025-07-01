
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Folder, File, Star, Users, Tag } from 'lucide-react';
import { getClients, getFolders } from '@/services/clientService';
import { useFileExplorer } from '@/contexts/FileExplorerContext';
import { useDocumentTabs } from '@/hooks/useDocumentTabs';
import { useClientDocuments } from '@/hooks/useClientDocuments';

interface UnifiedExplorerProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const UnifiedExplorer: React.FC<UnifiedExplorerProps> = ({ 
  collapsed = false, 
  onToggleCollapsed 
}) => {
  const { selectedClientId, setSelectedClientId, setSelectedFolderId } = useFileExplorer();
  const { handleFileClick } = useDocumentTabs();
  
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState({
    favorites: true,
    activeClients: true,
    pendingClients: false,
    closedClients: false,
    tags: false
  });

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  // Fetch folders for selected client
  const { data: folders = [] } = useQuery({
    queryKey: ['folders', selectedClientId],
    queryFn: () => selectedClientId ? getFolders(selectedClientId) : Promise.resolve([]),
    enabled: !!selectedClientId,
  });

  // Categorize clients
  const activeClients = clients.filter(client => 
    !client.matter_type || 
    !['closed', 'completed', 'settled'].some(status => 
      client.matter_type?.toLowerCase().includes(status)
    )
  );
  
  const pendingClients = clients.filter(client => 
    client.matter_type?.toLowerCase().includes('pending') || 
    client.matter_type?.toLowerCase().includes('review')
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
      setSelectedClientId(clientId);
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
    setSelectedFolderId(folderId);
  };

  const toggleGroup = (groupKey: keyof typeof expandedGroups) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const selectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedFolderId(undefined);
  };

  if (collapsed) {
    return (
      <div className="unified-explorer collapsed">
        <div className="explorer-header">
          <button className="collapse-btn" onClick={onToggleCollapsed}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="unified-explorer">
      <div className="explorer-header">
        <span className="explorer-title">LEGAL EXPLORER</span>
        <button className="collapse-btn" onClick={onToggleCollapsed}>
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>
      </div>
      
      <div className="explorer-content">
        {/* Favorites Section */}
        <div className="explorer-section">
          <div 
            className="section-header clickable"
            onClick={() => toggleGroup('favorites')}
          >
            {expandedGroups.favorites ? 
              <ChevronDown className="h-4 w-4 disclosure-icon" /> : 
              <ChevronRight className="h-4 w-4 disclosure-icon" />
            }
            <Star className="h-4 w-4 section-icon" />
            <span className="section-title">FAVORITES</span>
          </div>
          
          {expandedGroups.favorites && (
            <div className="section-items">
              <div className="explorer-item">
                <Star className="h-4 w-4 item-icon" />
                <span className="item-label">Recent Cases</span>
              </div>
              <div className="explorer-item">
                <File className="h-4 w-4 item-icon" />
                <span className="item-label">Pinned Documents</span>
              </div>
              <div className="explorer-item">
                <File className="h-4 w-4 item-icon" />
                <span className="item-label">Recent Searches</span>
              </div>
            </div>
          )}
        </div>

        {/* Clients Section */}
        <div className="explorer-section">
          <div 
            className="section-header clickable"
            onClick={() => toggleGroup('activeClients')}
          >
            {expandedGroups.activeClients ? 
              <ChevronDown className="h-4 w-4 disclosure-icon" /> : 
              <ChevronRight className="h-4 w-4 disclosure-icon" />
            }
            <Users className="h-4 w-4 section-icon" />
            <span className="section-title">CLIENTS</span>
          </div>
          
          {expandedGroups.activeClients && (
            <div className="section-items">
              {/* Active Cases */}
              <div className="client-group">
                <div className="group-header">
                  <ChevronDown className="h-4 w-4 disclosure-icon" />
                  <Folder className="h-4 w-4 group-icon" />
                  <span className="group-title">Active Cases</span>
                  <span className="group-count">({activeClients.length})</span>
                </div>
                
                <div className="group-items">
                  {activeClients.map((client) => (
                    <ClientExplorerItem 
                      key={client.id}
                      client={client}
                      folders={folders}
                      isExpanded={expandedClients[client.id]}
                      isSelected={selectedClientId === client.id}
                      onToggle={() => toggleClient(client.id)}
                      onFolderClick={toggleFolder}
                      onFileClick={handleFileClick}
                      expandedFolders={expandedFolders}
                    />
                  ))}
                </div>
              </div>
              
              {/* Pending Cases */}
              <div className="client-group">
                <div className="group-header">
                  <ChevronRight className="h-4 w-4 disclosure-icon" />
                  <Folder className="h-4 w-4 group-icon" />
                  <span className="group-title">Pending Cases</span>
                  <span className="group-count">({pendingClients.length})</span>
                </div>
              </div>
              
              {/* Closed Cases */}
              <div className="client-group">
                <div className="group-header">
                  <ChevronRight className="h-4 w-4 disclosure-icon" />
                  <Folder className="h-4 w-4 group-icon" />
                  <span className="group-title">Closed Cases</span>
                  <span className="group-count">({closedClients.length})</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div className="explorer-section">
          <div 
            className="section-header clickable"
            onClick={() => toggleGroup('tags')}
          >
            {expandedGroups.tags ? 
              <ChevronDown className="h-4 w-4 disclosure-icon" /> : 
              <ChevronRight className="h-4 w-4 disclosure-icon" />
            }
            <Tag className="h-4 w-4 section-icon" />
            <span className="section-title">TAGS</span>
          </div>
          
          {expandedGroups.tags && (
            <div className="section-items">
              <div className="explorer-item">
                <div className="tag-indicator urgent"></div>
                <span className="item-label">Urgent</span>
                <span className="item-count">(5)</span>
              </div>
              <div className="explorer-item">
                <div className="tag-indicator review"></div>
                <span className="item-label">Review Needed</span>
                <span className="item-count">(12)</span>
              </div>
              <div className="explorer-item">
                <div className="tag-indicator completed"></div>
                <span className="item-label">Completed</span>
                <span className="item-count">(45)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// New component to handle individual client items with real document data
interface ClientExplorerItemProps {
  client: any;
  folders: any[];
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onFolderClick: (folderId: string) => void;
  onFileClick: (file: any) => void;
  expandedFolders: Record<string, boolean>;
}

const ClientExplorerItem: React.FC<ClientExplorerItemProps> = ({
  client,
  folders,
  isExpanded,
  isSelected,
  onToggle,
  onFolderClick,
  onFileClick,
  expandedFolders
}) => {
  const { data: documents = [], isLoading } = useClientDocuments(client.id);
  
  // Get root-level documents (not in folders)
  const rootDocuments = documents.filter(doc => !doc.folder_id);
  
  return (
    <div className="client-entry">
      <div 
        className={`client-header ${isSelected ? 'selected' : ''}`}
        onClick={onToggle}
      >
        {isExpanded ? 
          <ChevronDown className="h-4 w-4 disclosure-icon" /> : 
          <ChevronRight className="h-4 w-4 disclosure-icon" />
        }
        <Users className="h-4 w-4 client-icon" />
        <span className="client-name">{client.name}</span>
      </div>
      
      {isExpanded && (
        <div className="client-files">
          {isLoading ? (
            <div className="file-item">
              <div className="file-indent"></div>
              <span className="file-name text-gray-500">Loading documents...</span>
            </div>
          ) : (
            <>
              {/* Show folders */}
              {folders
                .filter(folder => folder.client_id === client.id)
                .map((folder) => (
                  <div key={folder.id} className="folder-item" onClick={() => onFolderClick(folder.id)}>
                    {expandedFolders[folder.id] ? 
                      <ChevronDown className="h-4 w-4 disclosure-icon" /> : 
                      <ChevronRight className="h-4 w-4 disclosure-icon" />
                    }
                    <Folder className="h-4 w-4 folder-icon" />
                    <span className="file-name">{folder.name}</span>
                    <span className="file-count">(files)</span>
                  </div>
                ))
              }
              
              {/* Show root-level documents */}
              {rootDocuments.map((document) => (
                <div 
                  key={document.id}
                  className="file-item"
                  onClick={() => onFileClick({ 
                    id: document.id, 
                    name: document.name,
                    type: 'file'
                  })}
                >
                  <div className="file-indent"></div>
                  <File className="h-4 w-4 file-icon" />
                  <span className="file-name">{document.name}</span>
                </div>
              ))}
              
              {/* Show message if no documents */}
              {rootDocuments.length === 0 && folders.filter(f => f.client_id === client.id).length === 0 && (
                <div className="file-item">
                  <div className="file-indent"></div>
                  <span className="file-name text-gray-500">No documents</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedExplorer;
