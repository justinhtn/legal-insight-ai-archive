import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Bot, Copy, ExternalLink } from "lucide-react";
import { SearchResult } from "@/services/searchService";
import { useToast } from "@/hooks/use-toast";

interface SearchResult {
  document_id: string;
  document_title: string;
  document_file_name: string;
  content: string;
  similarity: number;
  chunk_index: number;
  page_number?: number;
  line_start?: number;
  line_end?: number;
  client?: string;
  matter?: string;
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  isLoading: boolean;
  aiResponse?: string;
  message?: string;
}

const SearchResults = ({ results, query, isLoading, aiResponse, message }: SearchResultsProps) => {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Text has been copied to your clipboard",
    });
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
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="border-l-4 border-gray-200 pl-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded"></div>
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
          {results.length} source document{results.length !== 1 ? 's' : ''}
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
      {results.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-lg text-gray-900">
              <span className="text-xl mr-2">📚</span>
              Key Sources
            </CardTitle>
            <p className="text-sm text-gray-600">
              Document excerpts that informed the AI analysis above
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {results.map((result, index) => (
                <div key={`${result.document_id}-${result.chunk_index}`} 
                     className="border-l-4 border-indigo-300 pl-6 space-y-3">
                  
                  {/* Document Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <h4 className="font-semibold text-gray-900 text-base">
                          {result.document_title}
                        </h4>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                        <span className="font-medium">{result.document_file_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(result.similarity * 100)}% match
                        </Badge>
                        {result.page_number && (
                          <span>Page {result.page_number}</span>
                        )}
                        {result.line_start && result.line_end && (
                          <span>Lines {result.line_start}-{result.line_end}</span>
                        )}
                        {!result.page_number && (
                          <span>Chunk {result.chunk_index + 1}</span>
                        )}
                      </div>
                      {/* Client and Matter Info */}
                      {(result.client || result.matter) && (
                        <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                          {result.client && (
                            <span className="bg-gray-100 px-2 py-1 rounded">
                              Client: {result.client}
                            </span>
                          )}
                          {result.matter && (
                            <span className="bg-gray-100 px-2 py-1 rounded">
                              Matter: {result.matter}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content Quote */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Content:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(result.content)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <blockquote className="text-sm text-gray-800 leading-relaxed italic">
                      "{result.content}"
                    </blockquote>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View Document
                    </Button>
                    {result.page_number && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-600 hover:text-gray-800"
                      >
                        Go to Page {result.page_number}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results State */}
      {results.length === 0 && !aiResponse && (
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
