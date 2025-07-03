import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  ArrowRight, 
  Download, 
  Copy,
  FileText,
  Calendar,
  User
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as Diff from 'diff';

interface DocumentVersion {
  id: string;
  versionNumber: number;
  content: string;
  createdAt: string;
  changeSummary?: string;
  isAutoSave: boolean;
  createdByUser?: { email: string };
}

interface VersionComparisonProps {
  version1Id: string;
  version2Id: string;
  onClose: () => void;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber?: number;
}

const VersionComparison: React.FC<VersionComparisonProps> = ({
  version1Id,
  version2Id,
  onClose
}) => {
  const [version1, setVersion1] = useState<DocumentVersion | null>(null);
  const [version2, setVersion2] = useState<DocumentVersion | null>(null);
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const [viewMode, setViewMode] = useState<'unified' | 'side-by-side'>('unified');
  const [isLoading, setIsLoading] = useState(true);
  
  const { toast } = useToast();

  useEffect(() => {
    loadVersionsAndCompare();
  }, [version1Id, version2Id]);

  const loadVersionsAndCompare = async () => {
    setIsLoading(true);
    try {
      // Load both versions
      const [{ data: v1, error: e1 }, { data: v2, error: e2 }] = await Promise.all([
        supabase
          .from('document_versions')
          .select('*, createdByUser:created_by(email)')
          .eq('id', version1Id)
          .single(),
        supabase
          .from('document_versions')
          .select('*, createdByUser:created_by(email)')
          .eq('id', version2Id)
          .single()
      ]);

      if (e1 || e2) throw e1 || e2;
      
      setVersion1(v1);
      setVersion2(v2);

      // Generate diff
      generateDiff(v1.content, v2.content);
      
    } catch (error) {
      console.error('Error loading versions:', error);
      toast({
        title: "Error",
        description: "Failed to load versions for comparison",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateDiff = (content1: string, content2: string) => {
    const diff = Diff.diffLines(content1, content2);
    const lines: DiffLine[] = [];
    
    diff.forEach((part) => {
      const type = part.added ? 'added' : part.removed ? 'removed' : 'unchanged';
      const contentLines = part.value.split('\n');
      
      contentLines.forEach((line, index) => {
        // Skip empty lines at the end
        if (index === contentLines.length - 1 && line === '') return;
        
        lines.push({
          type,
          content: line,
        });
      });
    });
    
    setDiffLines(lines);
  };

  const copyDiffToClipboard = async () => {
    const diffText = diffLines
      .map(line => {
        const prefix = line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  ';
        return prefix + line.content;
      })
      .join('\n');

    try {
      await navigator.clipboard.writeText(diffText);
      toast({
        title: "Copied to Clipboard",
        description: "Diff has been copied to clipboard",
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "Error",
        description: "Failed to copy diff to clipboard",
        variant: "destructive"
      });
    }
  };

  const exportDiffAsText = () => {
    const diffText = diffLines
      .map(line => {
        const prefix = line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  ';
        return prefix + line.content;
      })
      .join('\n');

    const blob = new Blob([diffText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `version-comparison-${version1?.versionNumber}-${version2?.versionNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[80vh]">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3">Loading comparison...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!version1 || !version2) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[80vh]">
          <div className="flex items-center justify-center p-8 text-red-500">
            Error loading versions for comparison
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Ensure version1 is older than version2 for logical comparison
  const [olderVersion, newerVersion] = version1.versionNumber < version2.versionNumber 
    ? [version1, version2] 
    : [version2, version1];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Version Comparison
          </DialogTitle>
        </DialogHeader>

        {/* Comparison Header */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <Badge variant="outline" className="mb-1">Version {olderVersion.versionNumber}</Badge>
                <div className="text-sm text-gray-600 flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(olderVersion.createdAt), 'MMM d, HH:mm')}
                </div>
                <div className="text-xs text-gray-500 flex items-center mt-1">
                  <User className="h-3 w-3 mr-1" />
                  {olderVersion.createdByUser?.email || 'Unknown'}
                </div>
              </div>
              
              <ArrowRight className="h-4 w-4 text-gray-400" />
              
              <div className="text-center">
                <Badge variant="default" className="mb-1">Version {newerVersion.versionNumber}</Badge>
                <div className="text-sm text-gray-600 flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(newerVersion.createdAt), 'MMM d, HH:mm')}
                </div>
                <div className="text-xs text-gray-500 flex items-center mt-1">
                  <User className="h-3 w-3 mr-1" />
                  {newerVersion.createdByUser?.email || 'Unknown'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'unified' ? 'side-by-side' : 'unified')}
            >
              {viewMode === 'unified' ? 'Side by Side' : 'Unified'}
            </Button>
            <Button variant="outline" size="sm" onClick={copyDiffToClipboard}>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={exportDiffAsText}>
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Diff Statistics */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
            <span>{diffLines.filter(l => l.type === 'added').length} additions</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
            <span>{diffLines.filter(l => l.type === 'removed').length} deletions</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-300 rounded mr-2"></div>
            <span>{diffLines.filter(l => l.type === 'unchanged').length} unchanged</span>
          </div>
        </div>

        <Separator />

        {/* Diff Content */}
        <ScrollArea className="flex-1">
          {viewMode === 'unified' ? (
            <div className="font-mono text-sm">
              {diffLines.map((line, index) => (
                <div
                  key={index}
                  className={`px-4 py-1 whitespace-pre-wrap ${
                    line.type === 'added'
                      ? 'bg-green-50 border-l-4 border-green-500 text-green-800'
                      : line.type === 'removed'
                      ? 'bg-red-50 border-l-4 border-red-500 text-red-800'
                      : 'bg-white'
                  }`}
                >
                  <span className="inline-block w-6 text-gray-400 select-none">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  {line.content}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {/* Version 1 (Left) */}
              <div>
                <h4 className="font-medium text-sm mb-2 p-2 bg-gray-100">
                  Version {olderVersion.versionNumber}
                </h4>
                <div className="font-mono text-sm">
                  {olderVersion.content.split('\n').map((line, index) => (
                    <div key={index} className="px-2 py-1 whitespace-pre-wrap">
                      <span className="inline-block w-6 text-gray-400 text-xs">
                        {index + 1}
                      </span>
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              {/* Version 2 (Right) */}
              <div>
                <h4 className="font-medium text-sm mb-2 p-2 bg-gray-100">
                  Version {newerVersion.versionNumber}
                </h4>
                <div className="font-mono text-sm">
                  {newerVersion.content.split('\n').map((line, index) => (
                    <div key={index} className="px-2 py-1 whitespace-pre-wrap">
                      <span className="inline-block w-6 text-gray-400 text-xs">
                        {index + 1}
                      </span>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VersionComparison;