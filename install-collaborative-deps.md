# Collaborative Editing Dependencies Installation

Run these commands to install the required packages for collaborative editing:

```bash
# Core collaborative editing dependencies
npm install yjs y-websocket y-monaco monaco-editor @monaco-editor/react

# Real-time communication
npm install socket.io-client ws

# Version management and diff utilities
npm install diff2html diff jsondiffpatch

# PDF generation for exports
npm install jspdf html2canvas

# Date utilities for version history
npm install date-fns

# WebRTC for direct peer-to-peer collaboration (optional)
npm install simple-peer

# Development dependencies
npm install --save-dev @types/ws @types/diff
```

After installation, run:
```bash
npm run dev
```