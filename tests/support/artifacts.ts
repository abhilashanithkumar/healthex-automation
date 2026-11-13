import type { BrowserContext, Download, Page } from '@playwright/test';

export interface Artifact { path: string; bytes: number; format: 'pdf' | 'html' | 'other' }
export interface PdfValidation { pages: number; textPages: number; renderedPages: number; matchedMarkers: number; expectedMarkers: number }
export interface PrintPreviewResult { artifact: Artifact; pages: number }

export interface ArtifactTools {
  saveDownload(download: Download, label: string): Promise<Artifact>;
  validateHtml(artifact: Artifact, expectedText: string): Promise<void>;
  validatePdf(artifact: Artifact, expectedMarkers: string[]): Promise<PdfValidation>;
  downloadFullPdf(walletPage: Page): Promise<Artifact>;
  inspectPrintPreview(context: BrowserContext): Promise<PrintPreviewResult>;
  cancelPrintPreview(): Promise<void>;
}
