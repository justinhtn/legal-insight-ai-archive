import { useState, useEffect } from "react";
import { Upload, Search, FolderOpen, FileText, Moon, Sun, Home, Users, ChevronRight, ChevronDown, Folder, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar, SidebarContent, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import AuthButton from "@/components/AuthButton";
import SearchResults from "@/components/SearchResults";
import FileExplorer from "@/components/FileExplorer";
import DocumentUploadModal from "@/components/DocumentUploadModal";
import { searchDocuments, ConsolidatedDocument } from "@/services/searchService";
import { getClients, getFolders, Client } from "@/services/clientService";
import { useClientDocuments } from "@/hooks/useClientDocuments";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

type ViewMode = 'home' | 'search' | 'explorer';

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [clients, setClients] = useState<Client[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [consolidatedDocuments, setConsolidatedDocuments] = useState<ConsolidatedDocument[]>([]);
  const [aiResponse, setAiResponse] = useState<string>("");
  const [searchMessage, setSearchMessage] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [selectedExplorerClientId, setSelectedExplorerClientId] = useState<string>();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  // Fetch clients for explorer
  const { data: explorerClients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
    enabled: !!user,
  });

  // Fetch folders for expanded clients
  const { data: clientFolders = [] } = useQuery({
    queryKey: ['folders', selectedExplorerClientId],
    queryFn: () => selectedExplorerClientId ? getFolders(selectedExplorerClientId) : Promise.resolve([]),
    enabled: !!selectedExplorerClientId,
  });

  // Fetch documents for selected client using the correct hook
  const { data: clientDocuments = [], isLoading: documentsLoading } = useClientDocuments(selectedExplorerClientId);

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadClients();
    }
  }, [user]);

  const loadClients = async () => {
    try {
      const clientsData = await getClients();
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const toggleClientExpansion = (clientId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
      if (selectedExplorerClientId === clientId) {
        setSelectedExplorerClientId(undefined);
      }
    } else {
      newExpanded.add(clientId);
      setSelectedExplorerClientId(clientId);
    }
    setExpandedClients(newExpanded);
  };

  const handleDocumentUpload = (files: File[]) => {
    console.log('Uploaded files:', files);
    toast({
      title: "Documents uploaded",
      description: `${files.length} document${files.length !== 1 ? 's' : ''} uploaded and processed successfully`,
    });
    if (user) {
      loadClients();
    }
  };

  const handleAuthChange = () => {
    // This will trigger the useEffect to update the user state
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to search documents",
        variant: "destructive",
      });
      return;
    }

    if (!searchQuery.trim()) {
      return;
    }

    setIsSearching(true);
    setViewMode('search');

    try {
      const response = await searchDocuments(searchQuery.trim(), selectedClientId === "all" ? undefined : selectedClientId);
      setConsolidatedDocuments(response.consolidated_documents);
      setAiResponse(response.ai_response || "");
      setSearchMessage(response.message || "");
      
      if (response.consolidated_documents.length === 0 && !response.ai_response) {
        toast({
          title: "No results found",
          description: "Try adjusting your search query or upload more documents.",
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "An error occurred while searching",
        variant: "destructive",
      });
      setConsolidatedDocuments([]);
      setAiResponse("");
      setSearchMessage("");
    } finally {
      setIsSearching(false);
    }
  };

  const renderContent = () => {
    switch (viewMode) {
      case 'search':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button 
                variant="outline" 
                onClick={() => setViewMode('home')}
                className="flex items-center"
              >
                <Home className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
              <Button 
                onClick={() => setIsUploadOpen(true)}
                disabled={!user}
                title={!user ? "Please sign in to upload documents" : ""}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Documents
              </Button>
            </div>
            <SearchResults 
              consolidated_documents={consolidatedDocuments} 
              query={searchQuery} 
              isLoading={isSearching}
              aiResponse={aiResponse}
              message={searchMessage}
            />
          </div>
        );
      
      case 'explorer':
        return <FileExplorer />;
      
      default: // home
        return (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Legal Document Archive</h1>
                <p className="text-muted-foreground">
                  AI-powered search across all your legal documents and pleadings
                </p>
              </div>
              <Button 
                onClick={() => setIsUploadOpen(true)}
                disabled={!user}
                title={!user ? "Please sign in to upload documents" : ""}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Documents
              </Button>
            </div>

            {!user && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="pt-6">
                  <p className="text-yellow-800">
                    Please sign in to upload and manage your legal documents. Your documents are securely stored and only accessible to you.
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="mr-2 h-5 w-5" />
                    Active Clients
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{explorerClients.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Client matters with organized documents
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="mr-2 h-5 w-5" />
                    Total Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">247</div>
                  <p className="text-xs text-muted-foreground">
                    Processed and searchable
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Search className="mr-2 h-5 w-5" />
                    AI Searches Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">47</div>
                  <p className="text-xs text-muted-foreground">
                    Average response time: 2.3s
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent AI Searches</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-l-4 border-primary pl-4">
                    <p className="font-medium">
                      "What are the statute of limitations arguments in breach of contract cases?"
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Found 12 relevant passages across 5 documents
                    </p>
                  </div>
                  <div className="border-l-4 border-muted pl-4">
                    <p className="font-medium">
                      "Show me all discovery motions filed in the past 6 months"
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Found 8 documents with filing dates and case references
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        );
    }
  };

  // Group documents by folder for better organization
  const getDocumentsByFolder = (folderId?: string) => {
    return clientDocuments.filter(doc => doc.folder_id === folderId);
  };

  const getRootDocuments = () => {
    return clientDocuments.filter(doc => !doc.folder_id);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar className="w-80 bg-explorer-background border-r">
          <SidebarContent className="p-0">
            <div className="explorer-header">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Legal Archive</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="h-6 w-6"
                >
                  {theme === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {/* Navigation Buttons */}
              <div className="px-2 py-2 border-b border-border">
                <div className="space-y-1">
                  <button
                    onClick={() => setViewMode('home')}
                    className={`explorer-item w-full ${viewMode === 'home' ? 'selected' : ''}`}
                  >
                    <Home className="h-4 w-4" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    disabled={!user}
                    className="explorer-item w-full"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload Documents</span>
                  </button>
                </div>
              </div>

              {/* Legal Explorer Tree */}
              {user && (
                <div className="p-2">
                  <div className="explorer-section">
                    <div className="section-header">
                      <FolderOpen className="h-4 w-4" />
                      <span>Documents</span>
                    </div>
                    
                    <div className="section-items">
                      {explorerClients.map((client) => (
                        <div key={client.id} className="client-tree-item">
                          <button
                            onClick={() => toggleClientExpansion(client.id)}
                            className="explorer-item w-full"
                          >
                            {expandedClients.has(client.id) ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            <Folder className="h-4 w-4" />
                            <span className="truncate">{client.name}</span>
                          </button>
                          
                          {expandedClients.has(client.id) && (
                            <div className="client-tree-content">
                              {documentsLoading && selectedExplorerClientId === client.id && (
                                <div className="file-item">
                                  <div className="tree-indent"></div>
                                  <span className="text-muted-foreground text-sm">Loading documents...</span>
                                </div>
                              )}
                              
                              {/* Show folders with their documents */}
                              {clientFolders.map((folder) => {
                                const folderDocs = getDocumentsByFolder(folder.id);
                                return (
                                  <div key={folder.id}>
                                    <div className="folder-item">
                                      <div className="tree-indent"></div>
                                      <Folder className="h-4 w-4" />
                                      <span className="truncate">{folder.name}</span>
                                    </div>
                                    {/* Documents in this folder */}
                                    {folderDocs.map((doc) => (
                                      <div key={doc.id} className="file-item" style={{ paddingLeft: '32px' }}>
                                        <div className="tree-indent"></div>
                                        <File className="h-4 w-4" />
                                        <span className="truncate">{doc.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                              
                              {/* Show root-level documents (not in any folder) */}
                              {getRootDocuments().map((doc) => (
                                <div key={doc.id} className="file-item">
                                  <div className="tree-indent"></div>
                                  <File className="h-4 w-4" />
                                  <span className="truncate">{doc.name}</span>
                                </div>
                              ))}
                              
                              {/* Show message if no documents found */}
                              {!documentsLoading && selectedExplorerClientId === client.id && 
                               clientDocuments.length === 0 && (
                                <div className="file-item">
                                  <div className="tree-indent"></div>
                                  <span className="text-muted-foreground text-sm">No documents yet</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {explorerClients.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          No clients yet. Upload documents to get started.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4 lg:px-6">
              <SidebarTrigger />
              <div className="ml-auto flex items-center space-x-4">
                <form onSubmit={handleSearch} className="relative flex items-center space-x-2">
                  <div className="relative flex-1 max-w-lg">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder={`Search ${selectedClientId === "all" ? 'all documents' : 'within client'}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-full"
                      disabled={isSearching}
                    />
                  </div>
                  {user && clients.length > 0 && (
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All Clients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Clients</SelectItem>
                        {clients.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </form>
                <AuthButton user={user} onAuthChange={handleAuthChange} />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-hidden">
            {viewMode === 'explorer' ? (
              renderContent()
            ) : (
              <div className="p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                  {renderContent()}
                </div>
              </div>
            )}
          </main>
        </div>

        <DocumentUploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onUpload={handleDocumentUpload}
        />
      </div>
    </SidebarProvider>
  );
};

export default Index;
