import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';

interface DocumentSnapshot {
  id: string;
  label: string;
  description?: string;
  createdAt: string;
  content: string;
  documentTitle: string;
  version: { versionNumber: number };
  createdByUser?: { email: string };
}

interface ExportOptions {
  includeMetadata?: boolean;
  includeHeader?: boolean;
  includeFooter?: boolean;
  fontSize?: number;
  lineHeight?: number;
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  watermark?: string;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeMetadata: true,
  includeHeader: true,
  includeFooter: true,
  fontSize: 10,
  lineHeight: 1.2,
  margins: {
    top: 20,
    bottom: 20,
    left: 20,
    right: 20
  }
};

export class PDFExportService {
  private static instance: PDFExportService;
  
  public static getInstance(): PDFExportService {
    if (!PDFExportService.instance) {
      PDFExportService.instance = new PDFExportService();
    }
    return PDFExportService.instance;
  }

  /**
   * Export a document snapshot as PDF
   */
  public async exportSnapshotAsPDF(
    snapshot: DocumentSnapshot,
    options: Partial<ExportOptions> = {}
  ): Promise<Blob> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Create new PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - opts.margins!.left - opts.margins!.right;
    const contentHeight = pageHeight - opts.margins!.top - opts.margins!.bottom;

    let yPosition = opts.margins!.top;

    // Add header
    if (opts.includeHeader) {
      yPosition = this.addHeader(pdf, snapshot, opts, yPosition);
    }

    // Add metadata
    if (opts.includeMetadata) {
      yPosition = this.addMetadata(pdf, snapshot, opts, yPosition);
      yPosition += 10; // Add space after metadata
    }

    // Add content
    yPosition = await this.addContent(pdf, snapshot.content, opts, yPosition);

    // Add footer to all pages
    if (opts.includeFooter) {
      this.addFooterToAllPages(pdf, snapshot, opts);
    }

    // Add watermark if specified
    if (opts.watermark) {
      this.addWatermarkToAllPages(pdf, opts.watermark);
    }

    return pdf.output('blob');
  }

  /**
   * Export multiple snapshots as a single PDF with comparison
   */
  public async exportSnapshotComparison(
    snapshots: DocumentSnapshot[],
    options: Partial<ExportOptions> = {}
  ): Promise<Blob> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Add title page
    this.addComparisonTitlePage(pdf, snapshots, opts);

    // Add each snapshot
    for (let i = 0; i < snapshots.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }
      
      let yPosition = opts.margins!.top;
      
      // Add section header
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Version ${snapshots[i].version.versionNumber}: ${snapshots[i].label}`, opts.margins!.left, yPosition);
      yPosition += 10;

      // Add metadata
      yPosition = this.addMetadata(pdf, snapshots[i], opts, yPosition);
      yPosition += 5;

      // Add content
      await this.addContent(pdf, snapshots[i].content, opts, yPosition);
    }

    return pdf.output('blob');
  }

  /**
   * Export audit trail as PDF
   */
  public async exportAuditTrail(
    documentId: string,
    changes: any[],
    options: Partial<ExportOptions> = {}
  ): Promise<Blob> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let yPosition = opts.margins!.top;

    // Add title
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Document Audit Trail', opts.margins!.left, yPosition);
    yPosition += 15;

    // Add document info
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Document ID: ${documentId}`, opts.margins!.left, yPosition);
    yPosition += 5;
    pdf.text(`Generated: ${format(new Date(), 'PPpp')}`, opts.margins!.left, yPosition);
    yPosition += 15;

    // Add changes table
    const tableHeaders = ['Timestamp', 'User', 'Change Type', 'Summary'];
    const tableData = changes.map(change => [
      format(new Date(change.timestamp), 'MMM d, HH:mm:ss'),
      change.user?.email || 'Unknown',
      change.change_type,
      change.change_summary || 'No summary'
    ]);

    // Simple table implementation
    this.addTable(pdf, tableHeaders, tableData, opts.margins!.left, yPosition);

    return pdf.output('blob');
  }

  private addHeader(
    pdf: jsPDF,
    snapshot: DocumentSnapshot,
    options: ExportOptions,
    yPosition: number
  ): number {
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Add document title
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(snapshot.documentTitle, options.margins!.left, yPosition);
    yPosition += 8;

    // Add snapshot label
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Snapshot: ${snapshot.label}`, options.margins!.left, yPosition);
    yPosition += 6;

    // Add separator line
    pdf.setLineWidth(0.5);
    pdf.line(options.margins!.left, yPosition, pageWidth - options.margins!.right, yPosition);
    yPosition += 5;

    return yPosition;
  }

  private addMetadata(
    pdf: jsPDF,
    snapshot: DocumentSnapshot,
    options: ExportOptions,
    yPosition: number
  ): number {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);

    const metadata = [
      `Version: ${snapshot.version.versionNumber}`,
      `Created: ${format(new Date(snapshot.createdAt), 'PPpp')}`,
      `Author: ${snapshot.createdByUser?.email || 'Unknown'}`,
      ...(snapshot.description ? [`Description: ${snapshot.description}`] : [])
    ];

    metadata.forEach(line => {
      pdf.text(line, options.margins!.left, yPosition);
      yPosition += 4;
    });

    pdf.setTextColor(0, 0, 0); // Reset text color
    return yPosition;
  }

  private async addContent(
    pdf: jsPDF,
    content: string,
    options: ExportOptions,
    yPosition: number
  ): Promise<number> {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - options.margins!.left - options.margins!.right;
    const lineHeight = options.fontSize! * options.lineHeight!;

    pdf.setFontSize(options.fontSize!);
    pdf.setFont('courier', 'normal'); // Use monospace font for legal documents

    const lines = content.split('\n');
    
    for (const line of lines) {
      // Check if we need a new page
      if (yPosition + lineHeight > pageHeight - options.margins!.bottom) {
        pdf.addPage();
        yPosition = options.margins!.top;
      }

      // Split long lines
      const splitLines = pdf.splitTextToSize(line || ' ', contentWidth);
      
      for (const splitLine of splitLines) {
        if (yPosition + lineHeight > pageHeight - options.margins!.bottom) {
          pdf.addPage();
          yPosition = options.margins!.top;
        }
        
        pdf.text(splitLine, options.margins!.left, yPosition);
        yPosition += lineHeight;
      }
    }

    return yPosition;
  }

  private addFooterToAllPages(
    pdf: jsPDF,
    snapshot: DocumentSnapshot,
    options: ExportOptions
  ): void {
    const pageCount = pdf.getNumberOfPages();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();

    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);

      // Left footer: Snapshot info
      pdf.text(
        `${snapshot.label} - Version ${snapshot.version.versionNumber}`,
        options.margins!.left,
        pageHeight - 10
      );

      // Right footer: Page number
      pdf.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - options.margins!.right - 20,
        pageHeight - 10
      );

      // Center footer: Export timestamp
      const timestamp = format(new Date(), 'MMM d, yyyy HH:mm');
      const textWidth = pdf.getTextWidth(timestamp);
      pdf.text(
        timestamp,
        (pageWidth - textWidth) / 2,
        pageHeight - 10
      );
    }

    pdf.setTextColor(0, 0, 0); // Reset text color
  }

  private addWatermarkToAllPages(pdf: jsPDF, watermark: string): void {
    const pageCount = pdf.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      
      // Save current state
      pdf.saveGraphicsState();
      
      // Set watermark properties
      pdf.setTextColor(200, 200, 200);
      pdf.setFontSize(48);
      pdf.setFont('helvetica', 'bold');
      
      // Rotate and center the watermark
      const textWidth = pdf.getTextWidth(watermark);
      const x = pageWidth / 2;
      const y = pageHeight / 2;
      
      pdf.text(watermark, x, y, {
        angle: 45,
        align: 'center',
        baseline: 'middle'
      });
      
      // Restore state
      pdf.restoreGraphicsState();
    }
  }

  private addComparisonTitlePage(
    pdf: jsPDF,
    snapshots: DocumentSnapshot[],
    options: ExportOptions
  ): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPosition = options.margins!.top + 40;

    // Title
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    const title = 'Document Version Comparison';
    const titleWidth = pdf.getTextWidth(title);
    pdf.text(title, (pageWidth - titleWidth) / 2, yPosition);
    yPosition += 20;

    // Document title
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    const docTitle = snapshots[0]?.documentTitle || 'Unknown Document';
    const docTitleWidth = pdf.getTextWidth(docTitle);
    pdf.text(docTitle, (pageWidth - docTitleWidth) / 2, yPosition);
    yPosition += 20;

    // Comparison details
    pdf.setFontSize(10);
    yPosition += 10;
    
    snapshots.forEach((snapshot, index) => {
      pdf.text(
        `Version ${snapshot.version.versionNumber}: ${snapshot.label}`,
        options.margins!.left,
        yPosition
      );
      pdf.text(
        format(new Date(snapshot.createdAt), 'PPp'),
        pageWidth - options.margins!.right - 50,
        yPosition
      );
      yPosition += 6;
    });

    // Generation info
    yPosition += 20;
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Generated: ${format(new Date(), 'PPpp')}`, options.margins!.left, yPosition);
    pdf.setTextColor(0, 0, 0);

    pdf.addPage();
  }

  private addTable(
    pdf: jsPDF,
    headers: string[],
    data: string[][],
    x: number,
    y: number
  ): void {
    const rowHeight = 6;
    const colWidths = [40, 40, 30, 60]; // Adjust based on your needs
    
    // Headers
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    
    headers.forEach((header, i) => {
      pdf.text(header, x + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y);
    });
    
    y += rowHeight;
    
    // Data rows
    pdf.setFont('helvetica', 'normal');
    
    data.forEach(row => {
      row.forEach((cell, i) => {
        const cellX = x + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        const splitCell = pdf.splitTextToSize(cell, colWidths[i] - 2);
        pdf.text(splitCell[0] || '', cellX, y);
      });
      y += rowHeight;
    });
  }
}

// Export default instance
export const pdfExportService = PDFExportService.getInstance();

// Utility functions
export const downloadPDF = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const generateSnapshotFilename = (snapshot: DocumentSnapshot): string => {
  const date = format(new Date(snapshot.createdAt), 'yyyy-MM-dd');
  const safeName = snapshot.documentTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const safeLabel = snapshot.label.replace(/[^a-zA-Z0-9]/g, '_');
  return `${safeName}_${safeLabel}_v${snapshot.version.versionNumber}_${date}.pdf`;
};