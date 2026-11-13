import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { createCanvas } from '@napi-rs/canvas';
import { expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import type { Artifact, ArtifactTools, PdfValidation } from './artifacts';
import { cancelPreview, previewStatus, previewTargets, readPreviewPdf } from './native-print';

export function normalizeText(value: string): string { return value.normalize('NFKC').replace(/\s+/gu, '').toLowerCase(); }

/** Preserve every letter/number; a PDF font's unmapped NUL may represent punctuation. */
export function containsPdfText(text: string, expected: string): boolean {
  const actual = normalizeText(text);
  const marker = normalizeText(expected);
  if (actual.includes(marker)) return true;
  if (!actual.includes('\u0000')) return false;
  const escaped = (character: string) => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = Array.from(marker).map(character => /[\p{L}\p{N}]/u.test(character) ? escaped(character) : `(?:${escaped(character)}|\\u0000)`).join('');
  return new RegExp(pattern, 'u').test(actual);
}

export function createArtifactTools(context: BrowserContext, info: TestInfo, timeout: number): ArtifactTools {
  const parsed = new Map<string, { validation: PdfValidation; text: string }>();
  let sequence = 0;
  const privatePath = async (label: string, extension: string): Promise<string> => {
    const safe = label.replace(/[^a-z0-9_-]/gi, '-').slice(0, 60);
    const filename = info.outputPath(`${++sequence}-${safe}${extension}`);
    await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
    await fs.chmod(path.dirname(filename), 0o700);
    return filename;
  };
  const artifactAt = async (filename: string): Promise<Artifact> => {
    const bytes = await fs.readFile(filename);
    expect(bytes.length > 0, 'Downloaded artifact must not be empty').toBe(true);
    const start = bytes.subarray(0, 100).toString('utf8').trimStart();
    // A valid clinical HTML fragment can begin with plain text before its first br.
    const markup = /<(?:!doctype\s+html|html\b|body\b|div\b|p[\s>]|br[\s/>]|table\b|span\b|pre\b)/i.test(bytes.toString('utf8'));
    const format = start.startsWith('%PDF-') ? 'pdf' : markup ? 'html' : 'other';
    return { path: filename, bytes: bytes.length, format };
  };
  const validatePdf = async (artifact: Artifact, markers: string[]): Promise<PdfValidation> => {
    expect(artifact.format === 'pdf', 'Artifact must be a genuine PDF').toBe(true);
    let cached = parsed.get(artifact.path);
    if (!cached) {
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const task = getDocument({ data: new Uint8Array(await fs.readFile(artifact.path)), useSystemFonts: true, verbosity: 0 });
      const document = await task.promise;
      try {
        expect(document.numPages > 0, 'PDF must have pages').toBe(true);
        let text = ''; let textPages = 0; let renderedPages = 0;
        for (let index = 1; index <= document.numPages; index++) {
          const page = await document.getPage(index);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => 'str' in item ? item.str : '').join(' ');
          if (pageText.trim()) textPages++;
          text += pageText + '\n';
          const viewport = page.getViewport({ scale: 0.2 });
          const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
          await page.render({ canvas: canvas as any, canvasContext: canvas.getContext('2d') as any, viewport }).promise;
          renderedPages++;
          page.cleanup();
        }
        cached = { text, validation: { pages: document.numPages, textPages, renderedPages, matchedMarkers: 0, expectedMarkers: 0 } };
        parsed.set(artifact.path, cached);
      } finally { await task.destroy(); }
    }
    const matchedMarkers = markers.filter(marker => containsPdfText(cached!.text, marker)).length;
    expect(matchedMarkers === markers.length, 'PDF must include every expected private content marker').toBe(true);
    return { ...cached.validation, matchedMarkers, expectedMarkers: markers.length };
  };

  return {
    async saveDownload(download, label) {
      expect(await download.failure(), 'Browser download must complete').toBeNull();
      const extension = path.extname(download.suggestedFilename()).toLowerCase();
      const filename = await privatePath(label, /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : '.bin');
      await download.saveAs(filename); await fs.chmod(filename, 0o600);
      return artifactAt(filename);
    },
    async validateHtml(artifact, expectedText) {
      expect(artifact.format === 'html', 'Expected an HTML clinical document').toBe(true);
      const $ = load(await fs.readFile(artifact.path, 'utf8'));
      $('script,style,head,noscript').remove();
      const text = $('body').text();
      expect(normalizeText(text).length > 0, 'Document must contain readable content').toBe(true);
      expect(normalizeText(text) === normalizeText(expectedText), 'Downloaded document must match its expected private content').toBe(true);
    },
    validatePdf,
    async downloadFullPdf(walletPage: Page) {
      await walletPage.getByRole('heading', { name: 'Your HealthEx', exact: true }).waitFor();
      await walletPage.getByRole('button', { name: 'More options', exact: true }).click();
      const popup = walletPage.waitForEvent('popup', { timeout });
      await walletPage.getByRole('button', { name: 'Download as PDF', exact: true }).click();
      const pdf = await popup;
      await pdf.waitForURL(url => url.pathname.endsWith('.pdf') || url.protocol === 'blob:', { timeout });
      await pdf.bringToFront();
      const browser = context.browser();
      if (!browser) throw new Error('Chrome browser connection required');
      const session = await browser.newBrowserCDPSession();
      const directory = path.dirname(await privatePath('download', '.pdf'));
      const pageSession = await context.newCDPSession(walletPage);
      const { targetInfo } = await pageSession.send('Target.getTargetInfo');
      await pageSession.detach();
      await session.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: directory, eventsEnabled: true, browserContextId: targetInfo.browserContextId });
      let timer: NodeJS.Timeout;
      const completed = new Promise<string>((resolve, reject) => {
        let guid: string;
        session.on('Browser.downloadWillBegin', event => { guid = event.guid; });
        session.on('Browser.downloadProgress', event => {
          if (event.guid !== guid) return;
          if (event.state === 'completed') resolve(guid);
          if (event.state === 'canceled') reject(new Error('PDF download was canceled'));
        });
        timer = setTimeout(() => reject(new Error('PDF viewer download timed out')), timeout);
      });
      // Register rejection handling immediately even if viewer readiness fails.
      void completed.catch(() => {});
      try {
        await expect.poll(() => pdf.frames().some(frame => frame.url().startsWith('chrome-extension://')), { timeout }).toBe(true);
        const viewer = pdf.frames().find(frame => frame.url().startsWith('chrome-extension://'))!;
        await viewer.getByRole('button', { name: 'Download', exact: true }).click();
        const guid = await completed;
        const filename = await privatePath('full-record', '.pdf');
        await fs.rename(path.join(directory, guid), filename); await fs.chmod(filename, 0o600);
        return artifactAt(filename);
      } finally {
        clearTimeout(timer!);
        await session.detach();
        // The override belongs only to this isolated context, which teardown disposes.
      }
    },
    async inspectPrintPreview() {
      const browser = context.browser();
      if (!browser) throw new Error('Chrome browser connection required');
      await expect.poll(async () => { const status = await previewStatus(browser); return status.ready && status.pages > 0; }, { timeout }).toBe(true);
      // Chrome can enable Save before the PDF plugin's document target attaches.
      await expect.poll(async () => (await previewTargets(browser)).filter(target => target.type === 'iframe' && target.url.startsWith('chrome-untrusted://print/')).length,
        { timeout, message: 'Current print-preview document is attached and unambiguous' }).toBe(1);
      const status = await previewStatus(browser);
      const filename = await privatePath('print-preview', '.pdf');
      await fs.writeFile(filename, await readPreviewPdf(browser), { mode: 0o600 });
      const artifact = await artifactAt(filename);
      const validation = await validatePdf(artifact, []);
      expect(validation.pages, 'Captured print output must contain every preview page').toBe(status.pages);
      return { artifact, pages: status.pages };
    },
    async cancelPrintPreview() {
      const browser = context.browser();
      if (browser) await cancelPreview(browser);
    },
  };
}
