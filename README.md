# HealthEx Playwright automation

14 automated scenarios cover [the test plan](specs/healthex-test-plan.md): 12 record/wallet cases and 2 Sharing cases. All run together through the main configuration using page objects, typed fixtures, external test data, and regular Chrome. The Sharing creation test creates a uniquely named one-time link, verifies reload persistence, and explicitly deactivates it in teardown. Tests run serially with no automatic retries.

## Setup

Requires Node.js 22.13 or newer and installed Google Chrome.

```sh
npm ci
cp .env.example .env.local
```

The supplied task data has already been placed in this workspace's ignored `.env.local`. Configuration is read from there or CI environment variables; environment variables take precedence. Keep `.env.local`, `playwright/.auth`, reports, and downloaded health records private.

## Google authentication

```sh
npm run auth:open
# Complete Google sign-in in regular Chrome using the configured account.
npm run auth:save
```

`auth:open` starts the installed regular Chrome using `HEALTHEX_CHROME_PROFILE` (default `playwright/.auth/chrome-profile`), or reuses it if already running. Test startup uses the same configured profile and waits for the local debugging endpoint before workers connect. `auth:save` verifies HealthEx Login Methods against the configured Google email and saves only HealthEx-domain cookies/origins plus same-origin session storage to ignored files. It excludes Google and Kaiser cookies. Both setup commands preserve the ordinary Chrome window.

The local default is `HEALTHEX_AUTH_MODE=cdp`: global setup reopens the configured dedicated Chrome profile when needed, then authenticated tests reuse its verified context and create/close their own page for each test. Each test closes its own pages; global teardown closes the configured task Chrome instance after the entire run, including attached windows. The next run reopens the same profile automatically. An expired Google/HealthEx session still requires sign-in through `auth:open`; opening Chrome does not bypass authentication. Tests remain serial and establish their own data preconditions. This mode deliberately shares authenticated browser state; do not run another automation client against that profile concurrently.

`HEALTHEX_AUTH_MODE=state` uses isolated browser contexts with saved state. Use it only where the deployment permits restored/rotating device sessions; this production session did not restore reliably in a fresh context. CI requires an independently valid state bundle for its environment. Do not treat a failed session restore as a successful Google test.

Google can reject browsers launched under automation. Prepare the verified session in regular Chrome before running authenticated checks; MFA/device verification may require the owner. The retained public-entry test checks navigation to HealthEx login. Google sign-in, recovery, and account-switching tests were removed with the skipped scenarios.

## Run

```sh
npm run test:typecheck
npm run test:list
npm run test:readonly
npm run test:print
npm test
npm run test:report
```

Run all configured scenarios in visible Chrome with 500 ms between actions:

```sh
HEALTHEX_HEADLESS=false HEALTHEX_SLOW_MO=500 npx playwright test --project=chrome --headed
```

Slow motion also applies to the attached Chrome session. Authenticated checks require the prepared session and private record fixture.

The main config and `playwright.chrome.config.ts` both select regular Chrome. `HEALTHEX_HEADLESS=false` is the default; native print-preview tests require headed Chrome. On Linux, use `xvfb-run -a npm test` and install Chrome with `npx playwright install --with-deps chrome`.

`npm test` runs all 14 scenarios, including SHARING-01 and SHARING-02. The read-only command covers public entry, wallet titles, record views, Sharing inspection/form cancellation, and downloads. Print commands require headed Chrome and open/capture/cancel preview without sending a physical print job.

After a local terminal run finishes, global teardown closes the task Chrome instance and the HTML report opens in your default browser, whether the tests passed or failed. The report server keeps the terminal running; press Ctrl+C when finished viewing it. CI generates the report without opening a browser. Playwright suppresses automatic report opening in noninteractive or coding-agent runs; `npm run test:report` opens the saved report when needed.

## Private fixture data

Set `HEALTHEX_FIXTURE_FILE` to an ignored JSON file. This workspace has a private fixture derived from the authorized exploration; `test-data/fixtures.example.json` shows the public structure. Each representative record supplies:

```json
{
  "rowText": "exact accessible Timeline row text from your fixture",
  "kind": "visit",
  "detailMarkers": ["expected private detail text"],
  "documentButtonText": "actual document control label",
  "documentText": "complete expected rendered document text",
  "dateISO": "2026-01-01"
}
```

Include at least one visit and one imaging record. `summaryMarkers` and `exportMarkers` contain stable private expected text, never arbitrary values invented to make a test pass. Production record counts/dates evolve; update the fixture deliberately when the baseline changes. The retained authenticated scenarios use existing imported records. Assertions use generic messages and booleans to avoid dumping clinical text into reports.

## Downloads, print, and known issue

The full export opens a **new PDF tab**. The artifact helper then clicks **Download in that tab's Chrome PDF viewer**, rather than waiting indefinitely for a download on the original application page. Individual clinical documents may be valid HTML fragments. Tests parse HTML, compare full document text, and render every PDF page through PDF.js/native canvas before checking private content markers.

Native Chrome print preview is inspected through a scoped CDP connection. The helper reads only the current generated preview document, validates all pages, then cancels it and waits for the native preview component to disappear. Chrome can retain a blank `chrome://print` target after cancellation; that cached target is excluded from active-preview checks. `PRINT-02` checks the full exported PDF's print output against the export's page count and document content.

Known finding P-01: direct `Print Records` produced a Timeline listing missing document bodies. `HEALTHEX_KNOWN_PRINT_SCOPE_BUG=true` marks only the content assertion as an expected failure after preview infrastructure has succeeded. If the issue is fixed, an unexpected pass prompts removing the flag. A broken print-preview connection remains a real failure.

## Popup handling and CI

The fixture dismisses unexpected JavaScript dialogs and closes unexpected-origin popup windows. It preserves configured Google/Kaiser/Fasten and PDF/Chrome-preview windows. Customize `HEALTHEX_ALLOWED_POPUP_HOSTS` for an approved deployment; expected popups are explicitly awaited by the relevant flow.

Failed record/wallet tests capture screenshots with Playwright's `only-on-failure` setting. Sharing tests capture their own failed page with QR codes and bearer-value fields masked, rather than recording every page in the shared context. Screenshots are saved under the test's directory in `test-results/chrome` and attached to the HTML report. These local artifacts may include displayed health information; reports, screenshots, downloads, and auth state remain ignored. Traces, videos, and automatic page snapshots remain off. CI performs type checking and collection by default; live execution is manually triggered and needs private environment secrets and an approved authenticated-state/fixture bundle. Health-record artifacts are not uploaded automatically.

## Verification in this workspace

The 14-test main run completed in headed Chrome: 13 ordinary passes, 1 expected P-01 failure, 0 skipped, and 0 unexpected failures. SHARING-02 created one uniquely named one-time link, verified active reload, explicitly deactivated it, verified inactive reload/history, and preserved the original baseline. The private ledger confirms the owned link is inactive. Type checking and matching 14-test/14-scenario collection passed. Test Chrome closed and the HTML report opened. Private results are in `private-artifacts/main-sharing-verification.json` and `private-artifacts/main-sharing-summary.json`.

## Browser shutdown

`HEALTHEX_CLOSE_BROWSER_AFTER_RUN=true` is the default. Global teardown closes the configured local task Chrome instance after all workers finish, including CDP-attached Chrome; worker cleanup only disconnects so a failed worker cannot close Chrome before the remaining tests finish. Global setup reopens the same `HEALTHEX_CHROME_PROFILE` and waits for Chrome readiness on the next run. Setup via `npm run auth:open` / `npm run auth:save` keeps Chrome open until testing and is needed when authentication must be renewed. Set the close option to `false` only for an intentional debugging session.

The Create share link / deactivation scenarios now have runnable tests under `tests/sharing`, using `pages/SharingPage.ts` and the Sharing fixture. Deactivated links remain in Shared Links history, so the navigation test accepts populated active/inactive groups as well as the empty state.

New share links use `QA-<scenario ID>-<UUIDv4>`, generated by `createShareLinkName` in `tests/support/share-link-data.ts`. Generate once per test attempt and reuse the name during request recovery and deactivation. The name identifies the test scenario without personal data; the UUID distinguishes runs, workers, and retries. Link names exclude `cleanup`; existing inactive entries retain their historical names.

## Sharing tests

Both Sharing tests are part of `npm test`. To run only those tests:

```sh
npm run test:sharing -- --project=chrome --headed
```

SHARING-01 verifies defaults, Vitals selection, and cancellation without creating a link. SHARING-02 uses a unique `QA-SHARING-02-<UUIDv4>` name, selects one-time use with Vitals plus mandatory demographics/contact information, verifies active metadata and reload persistence, then deactivates the link and verifies inactive history. It never distributes or opens the active link.

The fixture records the initial baseline and owned identifiers in private mode-0600 ledgers under `playwright/.auth/sharing-ledgers`. Teardown recovers ambiguous submissions by unique name, explicitly deactivates owned links even after assertion failures, and preserves pre-existing links. An unresolved deactivation fails the test and retains the ledger for recovery.

No separate Sharing configuration, contract file, special mutation command, backend-clock driver, or delayed validation is required. `npm run test:readonly` remains available for runs without link creation.
