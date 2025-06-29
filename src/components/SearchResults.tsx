
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Copy, ExternalLink, FolderOpen } from "lucide-react";
import { ConsolidatedDocument } from "@/services/searchService";
import { useToast } from "@/hooks/use-toast";

interface SearchResultsProps {
  consolidated_documents: ConsolidatedDocument[];
  query: string;
  isLoading: boolean;
  aiResponse?: string;
  message?: string;
}

const SearchResults = ({ consolidated_documents, query, isLoading, aiResponse, message }: SearchResultsProps) => {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Text has been copied to your clipboard",
    });
  };

  const viewDocument = (documentId: string) => {
    // TODO: Implement navigation to document viewer
    toast({
      title: "View Document",
      description: "Document viewer will be implemented soon",
    });
  };

  const openInFileManager = (documentId: string) => {
    // TODO: Implement file manager navigation
    toast({
      title: "File Manager",
      description: "File manager integration will be implemented soon",
    });
  };

  const getRelevanceBadgeVariant = (relevance: string) => {
    switch (relevance) {
      case 'High': return 'default';
      case 'Medium': return 'secondary';
      case 'Low': return 'outline';
      default: return 'secondary';
    }
  };

  const getRelevanceColor = (relevance: string) => {
    switch (relevance) {
      case 'High': return 'text-green-700 bg-green-50 border-green-200';
      case 'Medium': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'Low': return 'text-gray-700 bg-gray-50 border-gray-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
          
          {/* AI Response Loading */}
          <Card className="border-blue-200 bg-blue-50 mb-6">
            <CardHeader className="pb-3">
              <div className="h-5 bg-blue-200 rounded w-1/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 bg-blue-200 rounded"></div>
                <div className="h-4 bg-blue-200 rounded w-5/6"></div>
                <div className="h-4 bg-blue-200 rounded w-4/5"></div>
              </div>
            </CardContent>
          </Card>

          {/* Sources Loading */}
          <Card>
            <CardHeader>
              <div className="h-5 bg-gray-200 rounded w-1/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-4/5"></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!query) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">
          Search Results for "{query}"
        </h3>
        <Badge variant="secondary" className="text-sm">
          {consolidated_documents.length} document{consolidated_documents.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* AI Analysis Section */}
      {aiResponse && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between text-lg text-blue-900">
              <div className="flex items-center">
                <span className="text-xl mr-2">📝</span>
                AI Analysis
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(aiResponse)}
                className="text-blue-700 border-blue-300 hover:bg-blue-100"
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </CardTitle>
            {message && (
              <p className="text-sm text-blue-700 font-medium">{message}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="prose prose-blue max-w-none">
              <p className="text-blue-900 leading-relaxed whitespace-pre-wrap text-base">
                {aiResponse}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Key Sources Section */}
      {consolidated_documents.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-lg text-gray-900">
              <span className="text-xl mr-2">📚</span>
              Key Sources
            </CardTitle>
            <p className="text-sm text-gray-600">
              Documents used to answer your question
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {consolidated_documents.map((doc) => (
                <div key={doc.document_id} 
                     className="border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                  
                  {/* Document Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <h4 className="font-semibold text-gray-900 text-lg">
                          {doc.document_file_name}
                        </h4>
                      </div>
                      
                      {/* Document Metadata */}
                      <div className="flex items-center space-x-4 text-sm mb-3">
                        {doc.client !== 'Unknown' && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                            Client: {doc.client}
                          </span>
                        )}
                        {doc.matter !== 'Unknown' && (
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                            Matter: {doc.matter}
                          </span>
                        )}
                        <Badge 
                          variant={getRelevanceBadgeVariant(doc.relevance)}
                          className={`text-xs ${getRelevanceColor(doc.relevance)}`}
                        >
                          Relevance: {doc.relevance}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Relevant Excerpts */}
                  {doc.excerpts.length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-medium text-gray-900 mb-3 text-sm">Relevant Excerpts:</h5>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <ul className="space-y-2">
                          {doc.excerpts.map((excerpt, idx) => (
                            <li key={idx} className="flex items-start space-x-2 text-sm">
                              <span className="text-gray-400 mt-1">•</span>
                              <div className="flex-1">
                                {excerpt.page && (
                                  <span className="font-medium text-blue-700">Page {excerpt.page}: </span>
                                )}
                                <span className="text-gray-800 italic">"{excerpt.text}"</span>
                                {excerpt.lines && (
                                  <span className="text-gray-500 text-xs ml-2">({excerpt.lines})</span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => viewDocument(doc.document_id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Document
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openInFileManager(doc.document_id)}
                      className="text-gray-700 border-gray-300 hover:bg-gray-50"
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Open in File Manager
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results State */}
      {consolidated_documents.length === 0 && !aiResponse && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            I couldn't find any documents matching your query about "{query}". 
            Try rephrasing your question or check if relevant documents have been uploaded.
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
