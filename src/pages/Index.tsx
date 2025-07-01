import { useState, useEffect } from "react";
import { Upload, Search, FolderOpen, FileText, Moon, Sun, Home, Users, Star, Tag, ChevronRight, ChevronDown, Folder, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar, SidebarContent, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import AuthButton from "@/components/AuthButton";
import SearchResults from "@/components/SearchResults";
import FileExplorer from "@/components/FileExplorer";
import DocumentUploadModal from "@/components/DocumentUploadModal";
import { searchDocuments, ConsolidatedDocument } from "@/services/searchService";
import { getClients, getFolders, Client } from "@/services/clientService";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useClientDocuments } from "@/hooks/useClientDocuments";

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
  const [expandedSections, setExpandedSections] = useState({
    favorites: true,
    activeClients: true,
    pendingClients: false,
    closedClients: false,
    tags: false
  });
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  // Fetch clients for the sidebar
  const { data: allClients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
    enabled: !!user,
  });

  // Fetch folders for selected client
  const { data: folders = [] } = useQuery({
    queryKey: ['folders', selectedClientId],
    queryFn: () => selectedClientId && selectedClientId !== "all" ? getFolders(selectedClientId) : Promise.resolve([]),
    enabled: !!selectedClientId && selectedClientId !== "all",
  });

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

  // Categorize clients
  const activeClients = allClients.filter(client => 
    !client.matter_type || 
    !['closed', 'completed', 'settled'].some(status => 
      client.matter_type?.toLowerCase().includes(status)
    )
  );
  
  const pendingClients = allClients.filter(client => 
    client.matter_type?.toLowerCase().includes('pending') || 
    client.matter_type?.toLowerCase().includes('review')
  );
  
  const closedClients = allClients.filter(client => 
    client.matter_type && 
    ['closed', 'completed', 'settled'].some(status => 
      client.matter_type?.toLowerCase().includes(status)
    )
  );

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  };

  const selectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setViewMode('explorer');
  };

  const handleDocumentUpload = (files: File[]) => {
    console.log('Uploaded files:', files);
    toast({
      title: "Documents uploaded",
      description: `${files.length} document${files.length !== 1 ? 's' : ''} uploaded and processed successfully`,
    });
    // Refresh clients data in case new documents were added
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
              
              {/* Main Navigation */}
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
                  variant="ghost" 
                  className="w-full justify-start text-sm"
                  onClick={() => setIsUploadOpen(true)}
                  disabled={!user}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Documents
                </Button>
              </div>

              {/* Legal Explorer Sections */}
              {user && (
                <div className="pt-4 border-t space-y-2">
                  {/* Favorites Section */}
                  <Collapsible 
                    open={expandedSections.favorites} 
                    onOpenChange={() => toggleSection('favorites')}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center px-2 py-1 text-sm font-medium hover:bg-accent rounded-md">
                        {expandedSections.favorites ? 
                          <ChevronDown className="h-4 w-4 mr-2" /> : 
                          <ChevronRight className="h-4 w-4 mr-2" />
                        }
                        <Star className="h-4 w-4 mr-2" />
                        <span className="flex-1 text-left">FAVORITES</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-8 space-y-1 text-sm">
                        <div className="flex items-center py-1 text-muted-foreground">
                          <Star className="h-3 w-3 mr-2" />
                          Recent Cases
                        </div>
                        <div className="flex items-center py-1 text-muted-foreground">
                          <File className="h-3 w-3 mr-2" />
                          Pinned Documents
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Active Clients Section */}
                  <Collapsible 
                    open={expandedSections.activeClients} 
                    onOpenChange={() => toggleSection('activeClients')}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center px-2 py-1 text-sm font-medium hover:bg-accent rounded-md">
                        {expandedSections.activeClients ? 
                          <ChevronDown className="h-4 w-4 mr-2" /> : 
                          <ChevronRight className="h-4 w-4 mr-2" />
                        }
                        <Users className="h-4 w-4 mr-2" />
                        <span className="flex-1 text-left">ACTIVE CLIENTS</span>
                        <span className="text-xs text-muted-foreground">({activeClients.length})</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-8 space-y-1">
                        {activeClients.map((client) => (
                          <ClientItem 
                            key={client.id}
                            client={client}
                            isExpanded={expandedClients[client.id]}
                            onToggle={() => toggleClient(client.id)}
                            onSelect={() => selectClient(client.id)}
                            folders={folders.filter(f => f.client_id === client.id)}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Pending Clients Section */}
                  <Collapsible 
                    open={expandedSections.pendingClients} 
                    onOpenChange={() => toggleSection('pendingClients')}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center px-2 py-1 text-sm font-medium hover:bg-accent rounded-md">
                        {expandedSections.pendingClients ? 
                          <ChevronDown className="h-4 w-4 mr-2" /> : 
                          <ChevronRight className="h-4 w-4 mr-2" />
                        }
                        <Folder className="h-4 w-4 mr-2" />
                        <span className="flex-1 text-left">PENDING CLIENTS</span>
                        <span className="text-xs text-muted-foreground">({pendingClients.length})</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-8 space-y-1">
                        {pendingClients.map((client) => (
                          <div 
                            key={client.id}
                            className="flex items-center py-1 text-sm cursor-pointer hover:bg-accent rounded-md px-2"
                            onClick={() => selectClient(client.id)}
                          >
                            <Users className="h-3 w-3 mr-2" />
                            {client.name}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Closed Clients Section */}
                  <Collapsible 
                    open={expandedSections.closedClients} 
                    onOpenChange={() => toggleSection('closedClients')}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center px-2 py-1 text-sm font-medium hover:bg-accent rounded-md">
                        {expandedSections.closedClients ? 
                          <ChevronDown className="h-4 w-4 mr-2" /> : 
                          <ChevronRight className="h-4 w-4 mr-2" />
                        }
                        <Folder className="h-4 w-4 mr-2" />
                        <span className="flex-1 text-left">CLOSED CLIENTS</span>
                        <span className="text-xs text-muted-foreground">({closedClients.length})</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-8 space-y-1">
                        {closedClients.map((client) => (
                          <div 
                            key={client.id}
                            className="flex items-center py-1 text-sm cursor-pointer hover:bg-accent rounded-md px-2"
                            onClick={() => selectClient(client.id)}
                          >
                            <Users className="h-3 w-3 mr-2" />
                            {client.name}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Tags Section */}
                  <Collapsible 
                    open={expandedSections.tags} 
                    onOpenChange={() => toggleSection('tags')}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center px-2 py-1 text-sm font-medium hover:bg-accent rounded-md">
                        {expandedSections.tags ? 
                          <ChevronDown className="h-4 w-4 mr-2" /> : 
                          <ChevronRight className="h-4 w-4 mr-2" />
                        }
                        <Tag className="h-4 w-4 mr-2" />
                        <span className="flex-1 text-left">TAGS</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-8 space-y-1 text-sm">
                        <div className="flex items-center py-1 text-muted-foreground">
                          <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                          Urgent <span className="ml-auto text-xs">(5)</span>
                        </div>
                        <div className="flex items-center py-1 text-muted-foreground">
                          <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div>
                          Review Needed <span className="ml-auto text-xs">(12)</span>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
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

// Client Item Component for the sidebar
interface ClientItemProps {
  client: Client;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  folders: any[];
}

const ClientItem: React.FC<ClientItemProps> = ({ client, isExpanded, onToggle, onSelect, folders }) => {
  const { data: documents = [] } = useClientDocuments(client.id);
  
  return (
    <div className="space-y-1">
      <div className="flex items-center text-sm">
        <button
          onClick={onToggle}
          className="flex items-center flex-1 py-1 hover:bg-accent rounded-md px-2"
        >
          {isExpanded ? 
            <ChevronDown className="h-3 w-3 mr-2" /> : 
            <ChevronRight className="h-3 w-3 mr-2" />
          }
          <Users className="h-3 w-3 mr-2" />
          <span className="truncate">{client.name}</span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSelect}
          className="ml-2 h-6 text-xs"
        >
          Open
        </Button>
      </div>
      
      {isExpanded && (
        <div className="pl-8 space-y-1">
          {folders.map((folder) => (
            <div key={folder.id} className="flex items-center py-1 text-xs text-muted-foreground">
              <Folder className="h-3 w-3 mr-2" />
              {folder.name}
            </div>
          ))}
          {documents.slice(0, 3).map((doc) => (
            <div key={doc.id} className="flex items-center py-1 text-xs text-muted-foreground">
              <File className="h-3 w-3 mr-2" />
              <span className="truncate">{doc.name}</span>
            </div>
          ))}
          {documents.length > 3 && (
            <div className="text-xs text-muted-foreground pl-5">
              +{documents.length - 3} more files
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Index;
