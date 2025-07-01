import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface Highlight {
  text: string;
  page?: number;
  lines?: string;
}

interface DocumentViewerProps {
  documentTitle: string;
  documentContent: string;
  highlights: Highlight[];
  query: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentTitle,
  documentContent,
  highlights,
  query
}) => {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    // Debug what we're actually receiving
    console.log('=== DOCUMENT VIEWER DEBUG ===');
    console.log('Document Title:', documentTitle);
    console.log('Document Content Length:', documentContent?.length);
    console.log('Document Content Preview:', documentContent?.substring(0, 200));
    console.log('Highlights:', highlights);
    console.log('Query:', query);
    
    setDebugInfo({
      contentLength: documentContent?.length || 0,
      contentPreview: documentContent?.substring(0, 200) || 'NO CONTENT',
      highlightCount: highlights?.length || 0,
      contentType: typeof documentContent,
      hasContent: !!documentContent && documentContent.length > 0
    });
  }, [documentTitle, documentContent, highlights, query]);

  // Create some test content if documentContent is empty
  const testContent = `CONFIDENTIAL ATTORNEY-CLIENT PRIVILEGED

MEMORANDUM

TO:         File
FROM:       [Attorney Name]
DATE:       June 29, 2025
RE:         Justin Houghton - Breach of Contract Claim Against TechVentures LLC
CLIENT NO:  2025-8847

I. SUMMARY OF ISSUE

Our client, Justin Houghton, seeks legal counsel regarding a potential breach of contract claim against TechVentures LLC ("TechVentures"). Mr. Houghton entered into a Software Development Agreement dated January 15, 2025, wherein he was to develop a proprietary inventory management system for TechVentures in exchange for $125,000. TechVentures has refused to pay the final installment of $50,000, claiming the software does not meet specifications. This memorandum analyzes Mr. Houghton's legal options and likelihood of success.

II. STATEMENT OF FACTS

On January 15, 2025, Justin Houghton, an independent software developer, entered into a written Software Development Agreement with TechVentures LLC, a Delaware corporation with principal offices in Atlanta, Georgia.

Key contract terms include:
- Total compensation: $125,000
- Payment schedule: $25,000 upon signing, $50,000 at midpoint milestone, $50,000 upon delivery
- Delivery deadline: May 15, 2025
- Specifications: Detailed in Exhibit A (10 pages of technical requirements)
- Acceptance testing: 30-day period following delivery

Mr. Houghton completed the following:
- Received initial payment of $25,000 on January 16, 2025
- Achieved midpoint milestone on March 10, 2025
- Received midpoint payment of $50,000 on March 15, 2025
- Delivered completed software on May 14, 2025 (one day early)
- Provided 40 hours of training to TechVentures staff from May 20-24, 2025

This is a much longer document that should definitely require scrolling to see all the content. Let's test if this works properly with our scrolling implementation.

III. LEGAL ANALYSIS

The primary legal issue is whether TechVentures' refusal to pay the final installment constitutes a material breach of contract. Under Georgia law, a material breach occurs when the non-breaching party is deprived of the benefit which he reasonably expected to receive.

A. Contract Formation
The parties clearly entered into a valid contract with all essential elements: offer, acceptance, consideration, and mutual assent. The written agreement satisfies the statute of frauds requirements for contracts over $500.

B. Performance Analysis
Mr. Houghton appears to have substantially performed his obligations under the contract. The software was delivered on time and included all specified functionality. TechVentures' claims of non-conformity appear to be pretextual, as they continued to use the software for over 30 days without formal rejection.

C. Damages
If successful, Mr. Houghton would be entitled to:
1. The unpaid contract balance of $50,000
2. Interest from the date payment was due
3. Attorney's fees (if contract provides)
4. Costs of collection

IV. RECOMMENDATION

Based on the facts presented, Mr. Houghton has a strong breach of contract claim. I recommend sending a demand letter followed by litigation if payment is not received within 30 days.

V. NEXT STEPS

1. Review the complete contract and all project documentation
2. Gather evidence of software functionality and acceptance
3. Prepare formal demand letter
4. Consider alternative dispute resolution options
5. File suit if necessary to protect client's interests

This memorandum is confidential and protected by attorney-client privilege.`;

  const contentToShow = documentContent && documentContent.length > 0 ? documentContent : testContent;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'white',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Debug Header */}
      <div style={{
        padding: '16px',
        backgroundColor: '#f0f0f0',
        borderBottom: '2px solid #ccc',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        <strong>DEBUG INFO:</strong> Content Length: {debugInfo.contentLength} | 
        Has Content: {debugInfo.hasContent ? 'YES' : 'NO'} | 
        Type: {debugInfo.contentType} | 
        Highlights: {debugInfo.highlightCount}
        <br />
        <strong>Preview:</strong> {debugInfo.contentPreview}
      </div>

      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#fafafa',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 4px 0' }}>
              {documentTitle || 'DEBUG DOCUMENT'}
            </h1>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
              Query: "{query || 'debug query'}"
            </p>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => window.close()}
          >
            Close Debug
          </Button>
        </div>
      </div>

      {/* SCROLLABLE CONTENT AREA */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px',
        backgroundColor: '#fff',
        border: '3px solid red', // Visible border to see the container
        margin: '10px'
      }}>
        <div style={{
          backgroundColor: '#f9f9f9',
          padding: '20px',
          border: '2px dashed blue',
          minHeight: '2000px' // Force it to be tall enough to scroll
        }}>
          <div 
            style={{
              fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", monospace',
              fontSize: '14px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              color: '#333'
            }}
          >
            {contentToShow}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;