
import React from 'react';
import { FileText, Users, Folder } from 'lucide-react';
import { useFileExplorer } from '@/contexts/FileExplorerContext';
import { useDocumentTabs } from '@/hooks/useDocumentTabs';
import { useQuery } from '@tanstack/react-query';
import { getClients } from '@/services/clientService';
import TabbedDocumentViewer from './TabbedDocumentViewer';

const DocumentContent: React.FC = () => {
  const { selectedClientId } = useFileExplorer();
  const { openTabs, activeTabId, showOverview } = useDocumentTabs();

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  const selectedClient = clients.find(c => c.id === selectedClientId);

  console.log('DocumentContent render:', {
    openTabsCount: openTabs.length,
    activeTabId,
    showOverview,
    selectedClientId
  });

  // Show document viewer if there are open tabs and we're not showing overview
  if (openTabs.length > 0 && !showOverview) {
    console.log('Rendering TabbedDocumentViewer with tabs:', openTabs.length);
    return (
      <TabbedDocumentViewer
        tabs={openTabs}
        activeTabId={activeTabId}
        onTabChange={() => {}} // Handled by context
        onTabClose={() => {}} // Handled by context
        onShowOverview={() => {}} // Handled by context
        showOverview={showOverview}
        showTabsOnly={false}
      />
    );
  }

  // Show client overview if client is selected
  if (selectedClient) {
    console.log('Rendering client overview for:', selectedClient.name);
    return (
      <div className="document-content">
        <div className="content-header">
          <div className="client-overview">
            <div className="client-avatar">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <div className="client-details">
              <h1 className="client-name">{selectedClient.name}</h1>
              <div className="client-meta">
                <span className="case-type">{selectedClient.matter_type || 'General Case'}</span>
                <span className="case-number">Case #{selectedClient.case_number || 'N/A'}</span>
                <span className="case-status">Active</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="content-body">
          <div className="overview-grid">
            <div className="overview-card">
              <div className="card-header">
                <Folder className="h-5 w-5 text-blue-600" />
                <h3>Document Summary</h3>
              </div>
              <div className="card-content">
                <div className="stat">
                  <span className="stat-number">24</span>
                  <span className="stat-label">Total Documents</span>
                </div>
                <div className="stat">
                  <span className="stat-number">6</span>
                  <span className="stat-label">Folders</span>
                </div>
                <div className="stat">
                  <span className="stat-number">2.4 MB</span>
                  <span className="stat-label">Total Size</span>
                </div>
              </div>
            </div>
            
            <div className="overview-card">
              <div className="card-header">
                <FileText className="h-5 w-5 text-green-600" />
                <h3>Recent Activity</h3>
              </div>
              <div className="card-content">
                <div className="activity-item">
                  <span className="activity-file">petition.pdf</span>
                  <span className="activity-action">uploaded</span>
                  <span className="activity-time">2 hours ago</span>
                </div>
                <div className="activity-item">
                  <span className="activity-file">response.docx</span>
                  <span className="activity-action">modified</span>
                  <span className="activity-time">1 day ago</span>
                </div>
              </div>
            </div>
            
            <div className="overview-card">
              <div className="card-header">
                <span className="h-5 w-5 text-orange-600">⚖️</span>
                <h3>Case Details</h3>
              </div>
              <div className="card-content">
                <div className="detail-row">
                  <span className="detail-label">Court:</span>
                  <span className="detail-value">Superior Court</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Judge:</span>
                  <span className="detail-value">Hon. Smith</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Next Hearing:</span>
                  <span className="detail-value">Dec 15, 2024</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show welcome screen if nothing is selected
  console.log('Rendering welcome screen');
  return (
    <div className="document-content welcome-screen">
      <div className="welcome-content">
        <FileText className="h-16 w-16 text-gray-400 mb-4" />
        <h2 className="welcome-title">Welcome to Legal Document Manager</h2>
        <p className="welcome-subtitle">
          Select a client or document from the explorer panel to get started
        </p>
        <div className="welcome-features">
          <div className="feature-item">
            <Users className="h-5 w-5 text-blue-600" />
            <span>Organize clients and cases</span>
          </div>
          <div className="feature-item">
            <Folder className="h-5 w-5 text-green-600" />
            <span>Manage documents efficiently</span>
          </div>
          <div className="feature-item">
            <FileText className="h-5 w-5 text-purple-600" />
            <span>Quick document access</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentContent;
