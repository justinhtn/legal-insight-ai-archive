# Collaborative Document Editing Setup Guide

This guide will help you set up real-time collaborative document editing with comprehensive version history for your legal document management application.

## Overview

The collaborative editing system includes:
- **Real-time collaborative editing** with Monaco Editor and YJS
- **Continuous version history** with automatic and manual saves
- **Named snapshots** for important document milestones
- **Version comparison** with side-by-side diff viewing
- **PDF export** from any snapshot version
- **Complete audit trail** for legal compliance
- **User presence indicators** and live cursors
- **Document locking** to prevent conflicts

## Prerequisites

- Node.js 18+ 
- Supabase project with authentication enabled
- Existing legal document management application

## Installation Steps

### 1. Install Dependencies

Dependencies have already been installed. If you need to reinstall:

```bash
npm install yjs y-websocket y-monaco monaco-editor @monaco-editor/react socket.io-client diff2html diff jsondiffpatch jspdf html2canvas date-fns
```

### 2. Database Setup

Apply the migration to create the collaborative editing schema:

```bash
npx supabase migration up
```

This creates the following tables:
- `document_versions` - Continuous version history
- `document_snapshots` - Named save points
- `document_changes` - Detailed audit trail
- `collaborative_sessions` - Active editing sessions
- `document_locks` - Conflict prevention
- `version_exports` - Export tracking

### 3. Deploy Edge Functions

Deploy the YJS WebSocket handler:

```bash
npx supabase functions deploy yjs-websocket
```

### 4. Configure Real-time Features

Enable real-time subscriptions in your Supabase project:

1. Go to Database → Replication
2. Enable replication for these tables:
   - `documents`
   - `document_versions` 
   - `document_snapshots`
   - `collaborative_sessions`

### 5. Update Document Components

Update your document tab components to enable collaborative editing:

```typescript
// In your document tab rendering code
<DocumentTab
  documentTitle={doc.title}
  documentContent={doc.content}
  highlights={highlights}
  query={query}
  onClose={onClose}
  documentId={doc.id} // Add document ID
  enableCollaborative={true} // Enable collaborative features
/>
```

### 6. Environment Variables

Ensure these environment variables are set:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Usage Guide

### Accessing Collaborative Features

1. **Open a Document**: Click on any document to open it in a tab
2. **Switch to Edit Mode**: Click the "Edit" button to enable collaborative editing
3. **Real-time Editing**: Multiple users can edit simultaneously with live cursors
4. **Create Snapshots**: Use the "Snapshot" button to create named save points
5. **View History**: Click "History" to see all versions and snapshots
6. **Compare Versions**: Select two versions to see a side-by-side comparison
7. **Export PDFs**: Export any snapshot as a professionally formatted PDF

### Key Features

#### Real-time Collaboration
- **Live Cursors**: See where other users are typing
- **Automatic Sync**: Changes are synchronized in real-time
- **Conflict Resolution**: YJS handles merge conflicts automatically
- **User Presence**: See who's currently editing the document

#### Version Management
- **Auto-save**: Documents are automatically saved every 30 seconds
- **Manual Save**: Create versions with custom descriptions
- **Snapshots**: Named save points for important milestones
- **History Timeline**: Complete chronological view of all changes

#### Document Security
- **Document Locking**: Lock documents for exclusive editing
- **Audit Trail**: Complete log of who changed what and when
- **Access Control**: Row-level security ensures users only see their documents
- **Export Tracking**: Track who exported what and when

#### Legal Workflow Features
- **Snapshot Labels**: "Draft for client review", "Court filing", etc.
- **PDF Export**: Professional formatting with headers, footers, and metadata
- **Version Comparison**: Highlight exactly what changed between versions
- **Audit Reports**: Export complete change history for compliance

## API Reference

### Key Services

#### `CollaborativeDocumentEditor`
Main editing component with real-time collaboration.

```typescript
<CollaborativeDocumentEditor
  documentId={string}
  documentTitle={string}
  initialContent={string}
  currentUser={User}
  onVersionHistoryToggle={() => void}
  showVersionHistory={boolean}
/>
```

#### `VersionHistoryPanel`
Sidebar component for managing versions and snapshots.

```typescript
<VersionHistoryPanel
  documentId={string}
  currentUserId={string}
  onVersionRestore={(content: string) => void}
  onSnapshotCreate={(label: string, description?: string) => void}
/>
```

#### `PDFExportService`
Service for exporting documents and snapshots as PDFs.

```typescript
import { pdfExportService, downloadPDF, generateSnapshotFilename } from '@/services/pdfExportService';

// Export a snapshot
const blob = await pdfExportService.exportSnapshotAsPDF(snapshot, options);
downloadPDF(blob, generateSnapshotFilename(snapshot));
```

### Database Functions

#### Get Document with Latest Version
```sql
SELECT * FROM get_document_with_latest_version('document-id');
```

#### Cleanup Inactive Sessions
```sql
SELECT cleanup_inactive_sessions();
```

## Security Considerations

### Row Level Security (RLS)
All tables have RLS policies ensuring users can only access their own documents.

### Document Locking
Prevents editing conflicts during critical operations:
- **Exclusive Lock**: Only the locking user can edit
- **Time-based Expiry**: Locks automatically expire after 2 hours
- **Manual Release**: Users can manually unlock their own locks

### Audit Trail
Complete audit trail for legal compliance:
- Every change is logged with user, timestamp, and content
- Export capabilities for legal discovery
- Immutable history (versions cannot be deleted)

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Ensure YJS WebSocket function is deployed
   - Check Supabase edge function logs
   - Verify authentication tokens

2. **Version History Not Loading**
   - Check RLS policies are correctly applied
   - Verify user authentication
   - Check table permissions

3. **PDF Export Errors**
   - Ensure jsPDF dependencies are installed
   - Check browser support for File API
   - Verify content doesn't exceed PDF limits

4. **Real-time Updates Not Working**
   - Enable real-time replication in Supabase
   - Check WebSocket connection status
   - Verify user permissions

### Debug Mode

Enable debug logging:

```typescript
// Add to your main.tsx or App.tsx
if (import.meta.env.DEV) {
  window.YJS_DEBUG = true;
  window.COLLABORATIVE_DEBUG = true;
}
```

## Performance Considerations

### Optimization Tips

1. **Large Documents**: Consider document size limits (recommended max 1MB)
2. **Version Cleanup**: Implement periodic cleanup of old versions
3. **Concurrent Users**: Test with expected number of simultaneous users
4. **Network Latency**: Optimize for your users' network conditions

### Monitoring

Monitor these metrics:
- WebSocket connection count
- Version creation rate
- Export frequency
- Storage usage growth

## Legal Compliance Features

### Audit Trail Export
Export complete audit trail for legal discovery:

```typescript
import { pdfExportService } from '@/services/pdfExportService';

const auditBlob = await pdfExportService.exportAuditTrail(
  documentId,
  changes,
  { includeMetadata: true, watermark: 'CONFIDENTIAL' }
);
```

### Document Integrity
- Immutable version history
- Cryptographic hashes for version verification
- Complete change attribution
- Timestamps with timezone information

### Export Controls
- Track all document exports
- Watermark sensitive documents
- Control export permissions
- Generate export reports

## Next Steps

1. **Test the System**: Create test documents and try collaborative editing
2. **Train Users**: Provide training on collaborative features
3. **Monitor Usage**: Set up monitoring for system health
4. **Backup Strategy**: Implement regular backups of version data
5. **Legal Review**: Have legal team review audit trail capabilities

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase edge function logs
3. Check browser console for client-side errors
4. Verify database permissions and RLS policies

The collaborative editing system is now ready for use in your legal document management application!