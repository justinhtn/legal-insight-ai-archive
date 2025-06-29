
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Bot } from "lucide-react";
import { SearchResult } from "@/services/searchService";

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  isLoading: boolean;
  aiResponse?: string;
  message?: string;
}

const SearchResults = ({ results, query, isLoading, aiResponse, message }: SearchResultsProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="mb-4">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!query) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Search Results for "{query}"
        </h3>
        <Badge variant="secondary">
          {results.length} document result{results.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Show AI response if available */}
      {aiResponse && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base text-blue-800">
              <Bot className="mr-2 h-4 w-4" />
              AI Analysis
            </CardTitle>
            {message && (
              <p className="text-sm text-blue-600">{message}</p>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-wrap">
              {aiResponse}
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Show document results if available */}
      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((result, index) => (
            <Card key={`${result.document_id}-${result.chunk_index}`} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-base">
                  <FileText className="mr-2 h-4 w-4" />
                  {result.document_title}
                </CardTitle>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span>{result.document_file_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(result.similarity * 100)}% match
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {result.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Show message when no results found and no AI response */}
      {results.length === 0 && !aiResponse && (
        <div className="text-center py-8">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No results found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search query or upload more documents.
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
