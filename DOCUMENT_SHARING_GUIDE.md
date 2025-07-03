# Document Sharing Guide

## How Two Different Users Can Access the Same Document

The collaborative editing system now supports multiple ways for different users to access and collaborate on the same document. Here are the methods:

### 🔗 Method 1: Direct User Sharing (Recommended for Law Firms)

**Step 1: Share with Specific Users**
1. Open any document in your application
2. Click the **"Share"** button in the document toolbar
3. Enter the email address of the person you want to share with
4. Select their permission level:
   - **Can view**: Read-only access
   - **Can comment**: View and add comments
   - **Can edit**: Full editing capabilities
   - **Full access**: Admin rights including sharing
5. Click **"Share"**

**Step 2: The Other User Accesses the Document**
- The shared user will see the document in their "Shared with Me" section
- They can open it and collaborate in real-time
- Both users can edit simultaneously with live cursors

### 🌐 Method 2: Shareable Links

**Step 1: Create a Share Link**
1. Open the document and click **"Share"**
2. Click **"Create Link"** in the sharing modal
3. Configure the link:
   - **Permission Level**: View, Comment, or Edit
   - **Requires Authentication**: Toggle on/off
   - **Expiration Date**: Optional
4. Click **"Create Link"**
5. Copy the generated link

**Step 2: Share the Link**
- Send the link via email, Slack, or any communication method
- Recipients can access the document directly via the link
- If authentication is required, they'll need to sign in

### 👥 Method 3: Team/Organization Access

**For Law Firms with Multiple Attorneys:**
- Set up team membership in the `team_members` table
- All team members automatically get access to shared documents
- Useful for firm-wide document access

## Permission Levels Explained

### 📖 **Can View (Read)**
- View document content
- See version history
- Export snapshots as PDF
- Cannot edit or comment

### 💬 **Can Comment** 
- Everything in "Can View"
- Add comments to documents
- Participate in discussions
- Cannot edit document content

### ✏️ **Can Edit**
- Everything in "Can Comment" 
- Real-time collaborative editing
- Create new versions
- Make document snapshots
- Cannot share with others

### 🛡️ **Full Access (Admin)**
- Everything in "Can Edit"
- Share document with others
- Manage permissions
- Delete document
- Lock/unlock document

## Real-time Collaboration Features

When multiple users have edit access:

### 🎯 **Live Cursors**
- See exactly where other users are typing
- Each user has a unique color
- User names appear next to cursors

### ⚡ **Real-time Sync**
- Changes appear instantly for all users
- Conflict-free collaborative editing with YJS
- Auto-save every 30 seconds

### 👥 **User Presence**
- See who's currently viewing/editing
- Active user count in the toolbar
- User avatars with names

### 🔒 **Document Locking**
- Lock documents for exclusive editing
- Prevents conflicts during critical changes
- Automatic expiry after 2 hours

## Setting Up Document Sharing

### Database Setup Required

You need to apply the sharing migration first:

```sql
-- Apply the sharing schema migration
-- This creates the sharing tables and updates permissions
```

### Enable Sharing in Your App

Update your document tabs to include sharing:

```typescript
<DocumentTab
  documentTitle={doc.title}
  documentContent={doc.content}
  highlights={highlights}
  query={query}
  onClose={onClose}
  documentId={doc.id}           // Required for sharing
  enableCollaborative={true}    // Enable all collaborative features
/>
```

## Example Workflows

### 📋 **Client Review Workflow**
1. Attorney creates document
2. Creates snapshot labeled "Draft for client review"
3. Shares with client using "Can comment" permission
4. Client reviews and adds comments
5. Attorney incorporates feedback
6. Creates final snapshot "Final version"
7. Exports as PDF for client signature

### ⚖️ **Multi-Attorney Collaboration**
1. Senior attorney creates document
2. Shares with junior attorney using "Can edit" permission
3. Both attorneys collaborate in real-time
4. Senior attorney creates snapshots at key milestones
5. Version history tracks all contributions
6. Final document is locked and exported

### 🔗 **External Counsel Sharing**
1. Create shareable link with "Can view" permission
2. Set expiration date for security
3. Send link to external counsel
4. They can access without creating account
5. Revoke link when collaboration is complete

## Security Features

### 🔐 **Row Level Security (RLS)**
- Users can only access documents they own or are shared with
- Sharing permissions are enforced at the database level
- No risk of unauthorized access

### 📊 **Audit Trail**
- Every share is logged with timestamp and user
- Track who accessed what and when
- Export audit reports for compliance

### ⏰ **Link Expiration**
- Set expiration dates on shareable links
- Automatic cleanup of expired links
- Usage limits to prevent abuse

### 🚫 **Revocation**
- Remove user access instantly
- Deactivate share links immediately
- Lock documents to prevent further editing

## Managing Shared Documents

### 📱 **Shared with Me**
Users can see all documents shared with them:

```typescript
import { documentSharingService } from '@/services/documentSharingService';

// Get documents shared with current user
const sharedDocs = await documentSharingService.getSharedWithMeDocuments();
```

### 📤 **Shared by Me**
Track documents you've shared:

```typescript
// Get documents shared by current user
const sharedByMe = await documentSharingService.getSharedByMeDocuments();
```

### 🔍 **Access Check**
Verify user permissions:

```typescript
// Check if user has access to document
const hasAccess = await documentSharingService.hasDocumentAccess(
  documentId, 
  'edit' // required permission level
);
```

## Troubleshooting

### Common Issues

**"User not found with that email address"**
- The user must have an account in your system
- Check the email spelling
- User might need to sign up first

**"Document is already shared with this user"**
- User already has access
- Update their permission level instead
- Check existing shares first

**"Share link has expired"**
- Create a new share link
- Set longer expiration date
- Use permanent links (no expiration)

### Best Practices

1. **Use specific permissions**: Give users the minimum access they need
2. **Set expiration dates**: For external sharing, always use expiration
3. **Regular audit**: Review who has access to sensitive documents
4. **Lock critical documents**: Use document locking during important edits
5. **Create snapshots**: Before major changes, create named snapshots

## API Reference

### Key Functions

```typescript
// Share with user
await documentSharingService.shareDocumentWithUser(
  documentId, 
  email, 
  'edit'
);

// Create share link
const { shareToken } = await documentSharingService.createShareLink(
  documentId,
  'read',
  { 
    requiresAuth: true,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  }
);

// Access via link
const result = await documentSharingService.accessDocumentViaLink(shareToken);
```

## Next Steps

1. **Apply the sharing migration** to your database
2. **Test sharing** between two different user accounts
3. **Try real-time collaboration** by editing the same document
4. **Create share links** and test external access
5. **Set up team structure** for your law firm

The document sharing system is now fully integrated with the collaborative editing features. Users can seamlessly share documents, collaborate in real-time, and maintain complete audit trails for legal compliance!