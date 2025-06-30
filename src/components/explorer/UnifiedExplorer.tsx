
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Folder, File, Star, Users, Tag } from 'lucide-react';
import { getClients, getFolders } from '@/services/clientService';
import { getDocuments } from '@/services/documentService';
import { useFileExplorer } from '@/contexts/FileExplorerContext';
import { useDocumentTabs } from '@/hooks/useDocumentTabs';

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
                    <div key={client.id} className="client-entry">
                      <div 
                        className={`client-header ${selectedClientId === client.id ? 'selected' : ''}`}
                        onClick={() => toggleClient(client.id)}
                      >
                        {expandedClients[client.id] ? 
                          <ChevronDown className="h-4 w-4 disclosure-icon" /> : 
                          <ChevronRight className="h-4 w-4 disclosure-icon" />
                        }
                        <Users className="h-4 w-4 client-icon" />
                        <span className="client-name">{client.name}</span>
                      </div>
                      
                      {expandedClients[client.id] && (
                        <div className="client-files">
                          {folders
                            .filter(folder => folder.client_id === client.id)
                            .map((folder) => (
                              <div key={folder.id} className="folder-item" onClick={() => toggleFolder(folder.id)}>
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
                          
                          {/* Sample files - replace with actual file data */}
                          <div 
                            className="file-item"
                            onClick={() => handleFileClick({ 
                              id: `${client.id}-sample`, 
                              name: 'sample-divorce-petition.txt',
                              type: 'file'
                            })}
                          >
                            <div className="file-indent"></div>
                            <File className="h-4 w-4 file-icon" />
                            <span className="file-name">sample-divorce-petition.txt</span>
                          </div>
                        </div>
                      )}
                    </div>
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

export default UnifiedExplorer;
