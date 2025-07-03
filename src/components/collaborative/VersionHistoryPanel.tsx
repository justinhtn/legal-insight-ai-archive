import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { 
  History, 
  Camera, 
  Download, 
  Eye, 
  GitCompare, 
  RotateCcw, 
  Lock, 
  Unlock,
  FileText,
  Clock,
  User,
  Tag,
  GitBranch
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import VersionComparison from './VersionComparison';

interface DocumentVersion {
  id: string;
  versionNumber: number;
  content: string;
  createdAt: string;
  createdBy: string;
  changeSummary?: string;
  isAutoSave: boolean;
  metadata: any;
  createdByUser?: { email: string };
}

interface DocumentSnapshot {
  id: string;
  label: string;
  description?: string;
  createdAt: string;
  createdBy: string;
  versionId: string;
  isLocked: boolean;
  version: { versionNumber: number };
  createdByUser?: { email: string };
}

interface VersionHistoryPanelProps {
  documentId: string;
  currentUserId: string;
  onVersionRestore: (content: string) => void;
  onSnapshotCreate: (label: string, description?: string) => void;
}

const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  documentId,
  currentUserId,
  onVersionRestore,
  onSnapshotCreate
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [snapshots, setSnapshots] = useState<DocumentSnapshot[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<[string?, string?]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showCreateSnapshot, setShowCreateSnapshot] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [snapshotDescription, setSnapshotDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();

  // Load versions and snapshots
  useEffect(() => {
    loadVersionHistory();
  }, [documentId]);

  const loadVersionHistory = async () => {
    setIsLoading(true);
    try {
      // Load versions
      const { data: versionsData, error: versionsError } = await supabase
        .from('document_versions')
        .select(`
          *,
          createdByUser:created_by(email)
        `)
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })
        .limit(50);

      if (versionsError) throw versionsError;
      setVersions(versionsData || []);

      // Load snapshots
      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from('document_snapshots')
        .select(`
          *,
          createdByUser:created_by(email),
          version:document_versions!version_id(version_number)
        `)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (snapshotsError) throw snapshotsError;
      setSnapshots(snapshotsData || []);

    } catch (error) {
      console.error('Error loading version history:', error);
      toast({
        title: "Error",
        description: "Failed to load version history",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!snapshotLabel.trim()) {
      toast({
        title: "Error",
        description: "Snapshot label is required",
        variant: "destructive"
      });
      return;
    }

    try {
      onSnapshotCreate(snapshotLabel.trim(), snapshotDescription.trim() || undefined);
      setSnapshotLabel('');
      setSnapshotDescription('');
      setShowCreateSnapshot(false);
      await loadVersionHistory();
    } catch (error) {
      console.error('Error creating snapshot:', error);
    }
  };

  const handleVersionSelect = (versionId: string) => {
    if (selectedVersions[0] === versionId) {
      setSelectedVersions([]);
    } else if (!selectedVersions[0]) {
      setSelectedVersions([versionId]);
    } else if (selectedVersions[1] === versionId) {
      setSelectedVersions([selectedVersions[0]]);
    } else {
      setSelectedVersions([selectedVersions[0], versionId]);
    }
  };

  const handleCompareVersions = () => {
    if (selectedVersions[0] && selectedVersions[1]) {
      setShowComparison(true);
    }
  };

  const handleRestoreVersion = async (version: DocumentVersion) => {
    const confirmed = window.confirm(
      `Are you sure you want to restore to Version ${version.versionNumber}? This will create a new version with the restored content.`
    );
    
    if (confirmed) {
      try {
        onVersionRestore(version.content);
        toast({
          title: "Version Restored",
          description: `Restored to Version ${version.versionNumber}`,
        });
      } catch (error) {
        console.error('Error restoring version:', error);
        toast({
          title: "Error",
          description: "Failed to restore version",
          variant: "destructive"
        });
      }
    }
  };

  const toggleSnapshotLock = async (snapshot: DocumentSnapshot) => {
    try {
      const { error } = await supabase
        .from('document_snapshots')
        .update({ is_locked: !snapshot.isLocked })
        .eq('id', snapshot.id);

      if (error) throw error;

      toast({
        title: snapshot.isLocked ? "Snapshot Unlocked" : "Snapshot Locked",
        description: `"${snapshot.label}" is now ${snapshot.isLocked ? 'unlocked' : 'locked'}`,
      });

      await loadVersionHistory();
    } catch (error) {
      console.error('Error toggling snapshot lock:', error);
      toast({
        title: "Error",
        description: "Failed to update snapshot lock",
        variant: "destructive"
      });
    }
  };

  const exportSnapshotAsPDF = async (snapshot: DocumentSnapshot) => {
    // This would integrate with jsPDF to export the snapshot
    toast({
      title: "Export Started",
      description: `Exporting "${snapshot.label}" as PDF`,
    });
    
    // Implementation would go here
    // const content = await getSnapshotContent(snapshot.versionId);
    // await generatePDF(content, snapshot.label);
  };

  return (
    <div className="w-80 border-l bg-gray-50 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center">
            <History className="h-4 w-4 mr-2" />
            Version History
          </h3>
          <Dialog open={showCreateSnapshot} onOpenChange={setShowCreateSnapshot}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Camera className="h-3 w-3 mr-1" />
                Snapshot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Snapshot</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Label *</label>
                  <Input
                    placeholder="e.g., Draft for client review"
                    value={snapshotLabel}
                    onChange={(e) => setSnapshotLabel(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Optional description..."
                    value={snapshotDescription}
                    onChange={(e) => setSnapshotDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateSnapshot} disabled={!snapshotLabel.trim()}>
                    Create Snapshot
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateSnapshot(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Comparison controls */}
        {selectedVersions.filter(Boolean).length === 2 && (
          <div className="space-y-2">
            <Button 
              size="sm" 
              className="w-full" 
              onClick={handleCompareVersions}
            >
              <GitCompare className="h-3 w-3 mr-1" />
              Compare Selected Versions
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="w-full"
              onClick={() => setSelectedVersions([])}
            >
              Clear Selection
            </Button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        {/* Snapshots Section */}
        <div className="p-4 border-b">
          <h4 className="font-medium text-sm text-gray-700 mb-3 flex items-center">
            <Tag className="h-3 w-3 mr-1" />
            Snapshots ({snapshots.length})
          </h4>
          <div className="space-y-2">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="p-3 bg-white rounded-lg border shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{snapshot.label}</div>
                    <div className="text-xs text-gray-500 flex items-center mt-1">
                      <GitBranch className="h-3 w-3 mr-1" />
                      Version {snapshot.version?.versionNumber}
                      <span className="mx-1">•</span>
                      {format(new Date(snapshot.createdAt), 'MMM d, HH:mm')}
                    </div>
                  </div>
                  {snapshot.isLocked && (
                    <Lock className="h-3 w-3 text-red-500 flex-shrink-0" />
                  )}
                </div>
                
                {snapshot.description && (
                  <p className="text-xs text-gray-600 mb-2">{snapshot.description}</p>
                )}
                
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>by {snapshot.createdByUser?.email || 'Unknown'}</span>
                  <span>{formatDistanceToNow(new Date(snapshot.createdAt), { addSuffix: true })}</span>
                </div>

                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-6 text-xs flex-1">
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-6 text-xs"
                    onClick={() => exportSnapshotAsPDF(snapshot)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-6 text-xs"
                    onClick={() => toggleSnapshotLock(snapshot)}
                  >
                    {snapshot.isLocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Versions Section */}
        <div className="p-4">
          <h4 className="font-medium text-sm text-gray-700 mb-3 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            All Versions ({versions.length})
          </h4>
          <div className="space-y-2">
            {versions.map((version) => (
              <div 
                key={version.id} 
                className={`p-3 bg-white rounded border cursor-pointer transition-colors ${
                  selectedVersions.includes(version.id)
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleVersionSelect(version.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center">
                      Version {version.versionNumber}
                      {selectedVersions.includes(version.id) && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Selected
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      {format(new Date(version.createdAt), 'MMM d, HH:mm:ss')}
                    </div>
                  </div>
                  <Badge variant={version.isAutoSave ? "secondary" : "default"} className="text-xs">
                    {version.isAutoSave ? "Auto" : "Manual"}
                  </Badge>
                </div>
                
                {version.changeSummary && (
                  <p className="text-xs text-gray-600 mb-2">{version.changeSummary}</p>
                )}
                
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span className="flex items-center">
                    <User className="h-3 w-3 mr-1" />
                    {version.createdByUser?.email || 'Unknown'}
                  </span>
                  <span>{formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}</span>
                </div>

                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-6 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestoreVersion(version);
                    }}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restore
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Version Comparison Modal */}
      {showComparison && selectedVersions[0] && selectedVersions[1] && (
        <VersionComparison
          version1Id={selectedVersions[0]}
          version2Id={selectedVersions[1]}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
};

export default VersionHistoryPanel;