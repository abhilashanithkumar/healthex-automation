import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadEnvironment } from '../tests/support/test-data';

async function versionAt(endpoint: URL): Promise<{ webSocketDebuggerUrl: string } | undefined> {
  const url = new URL('/json/version', endpoint);
  if (url.protocol === 'ws:') url.protocol = 'http:';
  if (url.protocol === 'wss:') url.protocol = 'https:';
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error('Chrome debugging endpoint returned an error');
    return await response.json() as { webSocketDebuggerUrl: string };
  } catch (error) {
    const cause = error instanceof Error ? error.cause as { code?: string } | undefined : undefined;
    if (cause?.code === 'ECONNREFUSED' || cause?.code === 'ECONNRESET') return undefined;
    throw new Error('Unable to inspect the configured task Chrome session');
  }
}

/** Reopen the dedicated regular-Chrome profile after the preceding run closed it. */
export async function ensureConfiguredChrome(): Promise<void> {
  loadEnvironment();
  const endpoint = new URL(process.env.HEALTHEX_CDP_ENDPOINT ?? 'http://127.0.0.1:19333');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw new Error('Browser startup requires a local task Chrome endpoint');
  if (await versionAt(endpoint)) return;
  if (endpoint.protocol !== 'http:' || !endpoint.port) throw new Error('Automatic Chrome startup requires an HTTP debugging endpoint with an explicit local port');
  const profile = path.resolve(process.env.HEALTHEX_CHROME_PROFILE ?? 'playwright/.auth/chrome-profile');
  await fs.mkdir(profile, { recursive: true, mode: 0o700 });
  await fs.chmod(profile, 0o700);
  const args = [
    `--user-data-dir=${profile}`, `--remote-debugging-port=${endpoint.port}`,
    '--remote-debugging-address=127.0.0.1', '--no-first-run', '--no-default-browser-check',
    `${process.env.HEALTHEX_BASE_URL ?? 'https://app.healthex.io'}/#/patient-records`,
  ];
  const executable = process.env.HEALTHEX_CHROME_EXECUTABLE;
  const binary = executable ?? (process.platform === 'win32'
    ? `${process.env.PROGRAMFILES ?? 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`
    : '/usr/bin/google-chrome');
  const child = process.platform === 'darwin' && !executable
    ? spawn('open', ['-n', '-a', 'Google Chrome', '--args', ...args], { detached: true, stdio: 'ignore' })
    : spawn(binary, args, { detached: true, stdio: 'ignore' });
  await new Promise<void>((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', () => reject(new Error('Unable to launch installed Google Chrome; check HEALTHEX_CHROME_EXECUTABLE')));
  });
  child.unref();
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await versionAt(endpoint)) return;
    await delay(200);
  }
  throw new Error('Task Chrome did not become ready; check the dedicated profile and local debugging port, or run npm run auth:open');
}

/** Close the configured task Chrome instance, including CDP-attached windows. */
export async function closeConfiguredChrome(): Promise<void> {
  loadEnvironment();
  if (process.env.HEALTHEX_AUTH_MODE !== 'cdp' || process.env.HEALTHEX_CLOSE_BROWSER_AFTER_RUN === 'false') return;
  const endpoint = new URL(process.env.HEALTHEX_CDP_ENDPOINT ?? 'http://127.0.0.1:19333');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw new Error('Browser cleanup requires the local task Chrome endpoint');
  const version = await versionAt(endpoint);
  if (!version) return;
  const websocket = new URL(version.webSocketDebuggerUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(websocket.hostname)) throw new Error('Unexpected browser cleanup endpoint');
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(websocket);
    let commandSent = false;
    const timer = setTimeout(() => { socket.close(); reject(new Error('Task Chrome shutdown timed out')); }, 10000);
    const disconnected = () => {
      clearTimeout(timer);
      // Chrome may exit without a WebSocket closing handshake. Confirm its
      // endpoint is down below instead of reporting that exit as a failure.
      if (commandSent) resolve();
      else reject(new Error('Task Chrome shutdown connection failed'));
    };
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
      commandSent = true;
    }, { once: true });
    socket.addEventListener('close', disconnected, { once: true });
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id === 1 && message.error) {
        clearTimeout(timer); socket.close(); reject(new Error('Chrome rejected the shutdown request'));
      }
    });
    socket.addEventListener('error', disconnected, { once: true });
  });
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!(await versionAt(endpoint))) return;
    await delay(100);
  }
  throw new Error('Task Chrome remained open after the run');
}
