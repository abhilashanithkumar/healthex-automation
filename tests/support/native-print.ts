import type { Browser, CDPSession } from '@playwright/test';
import { setTimeout as delay } from 'node:timers/promises';

/** A scoped CDP target connection; it works with Chrome's pipe transport too. */
class TargetClient {
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private constructor(private root: CDPSession, private sessionId: string) {
    root.on('Target.receivedMessageFromTarget', event => {
      if (event.sessionId !== sessionId) return;
      const message = JSON.parse(event.message);
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error('Chrome preview command failed'));
      else request.resolve(message.result);
    });
  }
  static async attach(browser: Browser, targetId: string): Promise<TargetClient> {
    const root = await browser.newBrowserCDPSession();
    const { sessionId } = await root.send('Target.attachToTarget', { targetId, flatten: false });
    return new TargetClient(root, sessionId);
  }
  async send(method: string, params: object = {}): Promise<any> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Chrome preview command timed out')); }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      void this.root.send('Target.sendMessageToTarget', { sessionId: this.sessionId, message: JSON.stringify({ id, method, params }) }).catch(() => {
        clearTimeout(timer); this.pending.delete(id); reject(new Error('Chrome preview connection closed'));
      });
    });
  }
  async close(): Promise<void> {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Preview connection closed')); }
    this.pending.clear();
    await this.root.send('Target.detachFromTarget', { sessionId: this.sessionId }).catch(() => {});
    await this.root.detach().catch(() => {});
  }
}

const walk = `const all = []; function walk(root) { for (const element of root.querySelectorAll('*')) { all.push(element); if (element.shadowRoot) walk(element.shadowRoot); } } walk(document);`;

export async function previewTargets(browser: Browser) {
  const session = await browser.newBrowserCDPSession();
  try { return (await session.send('Target.getTargets')).targetInfos; }
  finally { await session.detach(); }
}

export async function previewStatus(browser: Browser): Promise<{ pages: number; ready: boolean }> {
  const targets = await previewTargets(browser);
  const previews = targets.filter(target => target.type === 'page' && target.url.startsWith('chrome://print'));
  const active: { pages: number; ready: boolean }[] = [];
  for (const info of previews) {
    const target = await TargetClient.attach(browser, info.targetId);
    try {
      const response = await target.send('Runtime.evaluate', { expression: `(() => { ${walk}
        const sidebar = all.find(element => element.tagName === 'PRINT-PREVIEW-SIDEBAR');
        const label = all.find(element => element.children.length === 0 && /^[\\d,]+\\s+pages?$/.test((element.innerText || '').trim()));
        const pages = sidebar?.pageCount ?? Number((label?.innerText || '').replace(/[^0-9]/g, ''));
        const ready = all.some(element => element.tagName === 'CR-BUTTON' && /^(Save|Print)$/.test((element.innerText || '').trim()) && !element.disabled);
        return { active: Boolean(sidebar), pages, ready };
      })()`, returnByValue: true });
      if (response.exceptionDetails) throw new Error('Cannot inspect native print preview');
      const state = response.result.value;
      // Chrome can retain a blank chrome://print target after Cancel. It is no
      // longer an open preview once the native preview component is removed.
      if (state.active) active.push({ pages: state.pages, ready: state.ready });
    } finally { await target.close(); }
  }
  if (active.length > 1) throw new Error('Multiple print previews are open; refusing ambiguous access');
  return active[0] ?? { pages: 0, ready: false };
}

export async function readPreviewPdf(browser: Browser): Promise<Buffer> {
  const targets = await previewTargets(browser);
  const frames = targets.filter(target => target.type === 'iframe' && target.url.startsWith('chrome-untrusted://print/'));
  if (frames.length !== 1) throw new Error('Expected one current print-preview document');
  const target = await TargetClient.attach(browser, frames[0].targetId);
  try {
    await target.send('Page.enable');
    const tree = await target.send('Page.getResourceTree');
    // Chrome's current preview ID is retained; -1 is its complete document index.
    const complete = tree.frameTree.frame.url.replace(/\/\d+\/print\.pdf$/, '/-1/print.pdf');
    const response = await target.send('Runtime.evaluate', {
      expression: `(async () => {
        const response = await fetch(${JSON.stringify(complete)});
        if (!response.ok) throw new Error('Preview document unavailable');
        const bytes = new Uint8Array(await response.arrayBuffer()); let binary = '';
        for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
        return btoa(binary);
      })()`, awaitPromise: true, returnByValue: true,
    });
    if (response.exceptionDetails || typeof response.result.value !== 'string') throw new Error('Cannot read generated print content');
    return Buffer.from(response.result.value, 'base64');
  } finally { await target.close(); }
}

export async function cancelPreview(browser: Browser): Promise<void> {
  const deadline = Date.now() + 15000;
  const requested = new Set<string>();
  while (Date.now() < deadline) {
    const targets = (await previewTargets(browser)).filter(target => target.type === 'page' && target.url.startsWith('chrome://print'));
    if (!targets.length) return;
    let open = false;
    for (const info of targets) {
      let target: TargetClient | undefined;
      try {
        target = await TargetClient.attach(browser, info.targetId);
        const response = await target.send('Runtime.evaluate', { expression: `(() => { ${walk}
          if (!all.some(element => element.tagName === 'PRINT-PREVIEW-APP')) return { closed: true };
          if (${requested.has(info.targetId)}) return { closed: false };
          const button = all.find(element => element.tagName === 'CR-BUTTON'
            && (element.innerText || '').trim() === 'Cancel'
            && element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible'
            && !element.disabled);
          if (!button) return { closed: false };
          setTimeout(() => button.click(), 0); return { closed: false, requested: true };
        })()`, returnByValue: true });
        if (response.exceptionDetails) throw new Error('Cannot inspect print-preview cancellation');
        if (!response.result.value.closed) open = true;
        if (response.result.value.requested) requested.add(info.targetId);
      } catch (error) {
        // A preview can finish closing between discovery and the CDP command.
        if ((await previewTargets(browser)).some(item => item.targetId === info.targetId)) throw error;
      } finally { await target?.close(); }
    }
    if (!open) return;
    // Wait for the native component to disappear. CDP may retain its blank target
    // after the dialog closes, so target destruction alone is not a valid signal.
    await delay(100);
  }
  throw new Error('Print preview did not close after cancellation');
}
