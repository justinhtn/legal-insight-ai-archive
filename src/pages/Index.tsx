
import { useState, useEffect } from "react";
import { Upload, Search, FolderOpen, FileText, Moon, Sun, Home, Users } from "lucide-react";
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
import { getClients, Client } from "@/services/clientService";
import { useToast } from "@/hooks/use-toast";

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
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

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

  const handleDocumentUpload = (files: File[]) => {
    console.log('Uploaded files:', files);
    toast({
      title: "Documents uploaded",
      description: `${files.length} document${files.length !== 1 ? 's' : ''} uploaded and processed successfully`,
    });
    // The FileExplorer will refresh automatically when files are uploaded
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

  const getSelectedClientName = () => {
    const client = clients.find(c => c.id === selectedClientId);
    return client ? client.name : 'All Clients';
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
        return (
          <FileExplorer 
            onUpload={() => setIsUploadOpen(true)}
            onNavigateToSearch={() => setViewMode('search')}
          />
        );
      
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
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setViewMode('explorer')}>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FolderOpen className="mr-2 h-5 w-5" />
                    Manage Files & Clients
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{clients.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Active client matters with organized documents
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar>
          <SidebarContent className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 
                  className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => setViewMode('home')}
                >
                  Legal Archive
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </div>
              
              <div className="space-y-2">
                <Button 
                  variant={viewMode === 'home' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setViewMode('home')}
                >
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
                <Button 
                  variant={viewMode === 'explorer' ? 'default' : 'ghost'}
                  className="w-full justify-start text-sm"
                  onClick={() => setViewMode('explorer')}
                  disabled={!user}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Manage Files & Clients
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm"
                  onClick={() => setIsUploadOpen(true)}
                  disabled={!user}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Documents
                </Button>
              </div>

              {user && clients.length > 0 && (
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-2">Quick Access</h3>
                  <div className="space-y-1">
                    {clients.slice(0, 3).map(client => (
                      <Button 
                        key={client.id}
                        variant="ghost" 
                        className="w-full justify-start text-sm"
                        onClick={() => {
                          setSelectedClientId(client.id);
                          setViewMode('explorer');
                        }}
                      >
                        📁 {client.name}
                      </Button>
                    ))}
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
