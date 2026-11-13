# HealthEx Wallet test plan

**Browser explored:** Regular installed Google Chrome 157.0.8103.52 (`com.google.Chrome`).  
**Account:** `abhilash.cae@gmail.com`, confirmed in HealthEx → Login Methods → Google.  
**Application:** <https://healthex.io> → <https://app.healthex.io/#/login-patients>  
**Scenario file:** `specs/healthex-test-plan.md`  
**Repository seed:** `tests/seed.spec.ts`  
**Chrome configuration:** `playwright.chrome.config.ts`

This plan contains 14 automated scenarios: 12 record/wallet scenarios plus SHARING-01 form/cancellation and SHARING-02 one-time link creation, reload verification, and explicit deactivation. All 14 run through the main Chrome configuration and `npm test`.

Results below describe exploration unless explicitly identified as automated-test execution. The Sharing creation test uses a unique QA name, includes Vitals plus mandatory demographics/contact information, and deactivates its owned link in teardown. It does not distribute or open the active link.

## 1. Verified results and finding

| Area | Observed result | Status |
| --- | --- | --- |
| Google sign-in | Selected `abhilash.cae@gmail.com` in Google's normal account chooser; HealthEx Login Methods confirmed that exact Google identity. | Passed |
| Browser | Used the installed regular Chrome app with a dedicated local profile. Completed Google verification there and attached Playwright to the same session. | Passed |
| Initial wallet | Initially empty: `Looks like you haven't synced any records yet.` and `Find my Records`. This describes the state before import, not the current wallet. | Empty-state branch verified |
| Manual search | `Find my Records` → Manual Search → `Search for my providers You'll need your patient portal logins.` → required consent → exact Kaiser search. | Passed |
| Required consent | Owner explicitly approved ongoing HealthEx record access and electronic typed-name consent. Submitted the required checkbox and displayed name through `Consent & confirm access`. | Passed with approval |
| Provider selection | Selected `Kaiser Permanente - Northern California`, distinct from the other Kaiser regions. | Passed |
| Kaiser login | Genuine Kaiser User ID / Password login accepted the supplied credentials on the first submission. No Kaiser OTP was required. | Passed |
| Connector authorization | Owner approved Fasten Connect's introduction, then explicitly approved the 19 already selected data categories for exactly 1 hour. Submitted once and returned to HealthEx. | Passed for approved scope |
| Import | Exactly one connected source: `Northern California Region (Kaiser Permanente - Northern California)`. Observed 23 physicians, 56 visits, and 48 diagnostics. These are dated observations, not permanent test assertions. | Passed |
| Refresh | Source details → More options → `Refresh Source Recommended` → `Refresh these records` → `Refresh Successful` → Continue. Final check still showed one connected Kaiser source and usable records. | Passed |
| Timeline / record details | Observed 100 loaded Timeline entries, opened distinct visit and imaging records, and verified different readable details. Reload preserved records. Loaded entries are not an asserted total record count. | Passed for representative records |
| Summary | Populated conditions, medications, and vitals content. Nine distinct substantial displayed data lines were also present in the full-record PDF. | Passed for representative consistency |
| Sources | One Kaiser card, connected status, source details, aggregate counts, and refresh controls remained usable after refresh. | Passed |
| Records / Sharing navigation | Correct titles; Connections and Shared Links loaded. Existing inactive history was preserved. The creation scenario adds one inactive history entry after deactivation; tests use the current baseline rather than a fixed count. | Passed |
| Share-link preferences / cancellation | Observed dated default name, one-time use, all-records/selected-type options, nine optional types, mandatory demographics/contact information, Clear/Select all, and Cancel. Cancel preserved the inactive-link baseline; reopening restored defaults. | Passed form checks |
| One-time share-link creation / cleanup | The main-suite test created exactly one uniquely named link with one-time use, all-records disabled, and exactly `DEMOGRAPHICS`, `CONTACT_INFO`, `CLINICAL_VITALS`. Active reload, explicit deactivation, inactive reload/history, and baseline preservation passed. No active test-owned link remains. | Passed automated SHARING-02 |
| Individual documents | Clinical-note HTML: 9,218 bytes. Imaging-report HTML: 399 bytes. Both were readable, distinct, and their normalized downloaded text exactly matched the embedded viewers. | Passed |
| Full-record download | Global `Download as PDF` opened a new PDF tab. Clicked **Download again in that tab's Chrome PDF toolbar**. Saved a genuine 1,774,573-byte PDF; all 106 pages opened and rendered with text. Full text of both checked individual documents was present. | Passed file and representative scope checks |
| Direct `Print Records` | Opened a 10-page print preview containing the Timeline listing. Neither checked document's full text was present, although both were present in the full-record export. | **Failed requested full-record content check; see P-01** |
| Printing the exported PDF | Chrome PDF viewer → Print opened a 106-page preview. Captured its generated PDF locally; all 106 pages rendered and all four content checks passed, including both complete checked documents. Canceled preview without a physical print job. | Passed preview/content checks |

### P-01 — Direct Records printing omits document contents

**Starting state:** Correct Google wallet; Kaiser connected; imported records present; record-detail overlays closed; global Records controls visible.

1. Open Records → Timeline.
2. Select More options → `Print Records`.
3. Inspect the generated print preview and compare it with the full-record PDF and the two individually verified documents.

**Expected:** Printing the entire record includes the expected clinical document content and record scope.

**Observed:** The direct action generated a readable 10-page Timeline listing. Both checked document bodies were absent. The full-record export had 106 pages and contained both complete documents. The discrepancy is based on content comparison, not merely different page counts.

**Verified alternative:** Records → More options → `Download as PDF` → new PDF tab → Print. This produced a complete 106-page print preview containing both checked documents. This alternative does not pass the direct `Print Records` scenario.

### Execution limits

- File checks cover all PDF pages for opening/rendering and representative record/document correspondence. An exhaustive reconciliation of every exported clinical fact against Kaiser was not performed.
- No physical printer job, invitation, source hiding/deletion, or account-recovery settings change was performed. One explicitly approved temporary share link was created and deactivated on November 13; its one-time type and exact approved scopes were confirmed from creation metadata and inactive owner details. It was never sent to anyone or opened while active. The original inactive link was preserved.
- The earlier exploration confirmed explicit deactivation and inactive reload. Automated creation/reload/cleanup evidence is recorded separately below.
- The one-hour Kaiser grant was submitted November 12 at approximately **7:58:23 PM PST**, with a nominal boundary of **8:58:23 PM PST**. A later source refresh may require reauthorization. Previously imported wallet records are a separate stored-data check.

## 2. Test data, fixtures, and execution setup

### Secure test inputs

| Reference | Input | Rule |
| --- | --- | --- |
| `GOOGLE_EMAIL` | `abhilash.cae@gmail.com` | Verify this exact Google method in HealthEx before record actions. |
| `KAISER_PROVIDER` | `Kaiser Permanente - Northern California` | Confirm region before authorization. |
| `RECORDS_TITLE` | `HealthEx \| Patient Records` | Exact title for Records. |
| `SHARING_TITLE` | `HealthEx \| Patient Sharing` | Exact title for Sharing. |
| `SHARE_TEST_NAME` | `QA-<scenario ID>-<UUIDv4>`, e.g. `QA-SHARING-02-550e8400-e29b-41d4-a716-446655440000` | Generate with `createShareLinkName` once per test attempt; reuse during submission recovery and deactivation. No personal data or action words in names. Record before submission; never identify resources by position alone. |
| Share-link ledger | Private identifiers, selected scope/type, and creation/deactivation state | Mode 0600 outside shared source/artifacts; do not log bearer URLs or QR payloads. |
| `SYNC_TIMEOUT`, `EXPORT_TIMEOUT` | Product-agreed limits | Do not invent a production SLA from an exploratory wait. |
| Expected record data | Private fixture manifest: identifiers, dates, types, source, and representative document text | Keep clinical values and downloaded files outside shared source/artifacts. |

### Independent starting fixtures

Every scenario establishes its own browser/account/data fixture; it must not depend on a preceding scenario passing. A fresh test state does not authorize deleting production records.

New share-link names use `createShareLinkName('SHARING-02')` from `tests/support/share-link-data.ts`, passing the current scenario ID. The fixed QA prefix identifies test-owned data, the scenario ID enables tracing, and a full cryptographically generated UUIDv4 minimizes name collisions across runs, workers, and test retries. Generate a new name for each test attempt, keep it stable while recovering an ambiguous submission within that attempt, and retain the returned server identifier for deactivation. Names must not contain `cleanup`, credentials, or clinical information. This convention applies to new test resources; historical inactive entries retain their original names.

- **F0:** Signed out of HealthEx. Google may be signed out or have explicitly prepared sessions, as stated by the case.
- **F1:** Correct Google identity authenticated; wallet identity confirmed.
- **F4:** Exactly one existing Northern California Kaiser connection with a known imported-record baseline.
- **F5:** Imported Kaiser records, including at least a visit and imaging record with available documents. Preserve stable expected identifiers/content privately.
- **F6:** Fresh Sharing owner page, correct configured Google identity, no open form, and an independently captured link baseline. Preserve every pre-existing link. SHARING-01 cancels without creation. SHARING-02 creates one uniquely named one-time link containing Vitals plus mandatory demographics/contact information, records its returned identifier privately, and explicitly deactivates it even when an assertion fails.

The historical exploration moved from empty to populated state, then refreshed the existing source. The retained authenticated tests use the populated wallet and verify its imported records without adding or refreshing a source.

### Browser and authorization setup

1. Use installed regular Chrome. The successful exploration used an owner-verified regular-Chrome session, then local Playwright attachment to its existing default context. Do not create a new context and assume that it inherits the login.
2. `playwright.chrome.config.ts` re-exports the default regular-Chrome configuration: `channel: 'chrome'`, headed mode by default, one worker, no retries/traces/video, and screenshots only on failure. With `HEALTHEX_AUTH_MODE=cdp`, global setup starts the configured dedicated `HEALTHEX_CHROME_PROFILE` if its local endpoint is stopped and waits until ready; the authenticated fixture then attaches to that context. Other modes use isolated contexts. Global teardown closes the task Chrome instance; after a local interactive run, the HTML report opens in the default browser. CI generates the report without opening it. This does not guarantee Google permits an automated fresh login.
3. Initial automated Chromium sign-in was rejected by Google. Prepare the authenticated session through the supported regular-browser verification path. Google's [supported-browser guidance](https://support.google.com/accounts/answer/7675428?hl=en) explains this restriction.
4. Use a dedicated local Chrome profile for debugging; preserve the user's usual profile. Keep the debugging endpoint local and keep all session state private.
5. Run the retained suite serially with a verified authenticated session and existing imported records. The suite does not submit provider grants, consent, or source refreshes.
6. Close record/document overlays before global Timeline, export, and print controls. An overlay-hidden list is a locator/readiness issue, not evidence that imported records disappeared.
7. Observe navigation, popup, and download events before the triggering action. A PDF popup is a valid export surface; a missing download on the original app tab alone is not a failure.
8. Sharing navigation/form/cancellation does not submit. SHARING-02 runs with the main suite: create one uniquely named one-time Vitals-plus-mandatory-demographics/contact link, verify active reload, and explicitly deactivate it. Capture the baseline and private ownership ledger before submission; recover ambiguous submissions by that unique name before retrying. Never distribute/open the active link or mutate a pre-existing link.
9. Inspect/capture print preview in headed Chrome without submitting to a physical printer. Close the task-owned Chrome session at suite teardown as described in the README; preserve unrelated Chrome profiles.

## 3. Detailed scenarios

### AUTH-01 — Reach the genuine HealthEx login

**Start:** F0, regular Chrome. **Priority:** P0. **Observed:** Passed navigation.

1. Open `https://healthex.io` and follow `Sign in`.
2. Confirm the public redirect to `www.healthex.io`, then the application login at `app.healthex.io/#/login-patients`.
3. Check `Welcome to HealthEx` and `Continue with Google`.

**Expected/pass:** Correct hosts, usable Google entry, application login title `HealthEx`. Public marketing title is `HealthEx | Get All Your Medical Records in One Place`.
**Fail:** Broken navigation, wrong host, blank/error page, or missing login action.

### WALLET-01 — Verify titles and active wallet across views

**Start:** F1. **Priority:** P0. **Observed:** Passed.

1. Open Records; check `HealthEx | Patient Records` and visible `Your HealthEx` / `Wallet` heading.
2. Open Sharing; check `HealthEx | Patient Sharing` and `Share your Records`.
3. Return to Records and reload. Confirm the expected title and the same authorized wallet.

**Expected/pass:** Correct per-view titles/headings and identity, without stale login/provider headings or `undefined`/`null`.
**Fail:** Wrong owner, wrong route title, or inconsistent state. The document title intentionally differs between Records and Sharing.

### RECORDS-01 — Verify records arrive and persist

**Start:** F4 with a known source-data fixture. **Priority:** P0. **Observed:** Passed for imported records and post-refresh persistence.

1. Observe import/sync status within `SYNC_TIMEOUT`.
2. Open Timeline and verify actual entries associated with the selected Kaiser source.
3. Compare representative expected identifiers/dates/types with the private fixture and open their details.
4. Revisit Sources, then reload Records and verify persistence.

**Expected/pass:** Known available records become usable and belong to the correct source/wallet.
**Fail:** Completed sync omits known data, duplicates records, changes owner/source, or loses data on reload. No known baseline means exhaustive import completeness is inconclusive; an empty result alone does not prove successful import.

### RECORDS-02 — Check Timeline content, ordering, loading, and navigation

**Start:** F5. **Priority:** P0. **Observed:** Passed representative entries and navigation; 100 loaded entries observed.

1. Select Timeline and establish its actual sort direction and filters.
2. Compare representative dates/types/source labels with expected records and ordering rules.
3. Exercise available incremental loading/pagination with a known manifest.
4. Open one entry, close its overlay, then open a different entry.

**Expected/pass:** Current data, correct order, distinct details, usable navigation. A loaded subset is not asserted as the total record count.
**Fail:** Stale/repeated content, wrong date/source, inaccessible records, or genuine failed loading. Close overlays before diagnosing missing rows.

### RECORDS-03 — Check populated Summary against underlying data

**Start:** F5 with expected data for the sections actually present. **Priority:** P0. **Observed:** Populated conditions/medications/vitals; nine substantial displayed data lines also found in the full PDF.

1. Select Summary and wait for loading to resolve.
2. Identify actual sections and compare representative facts, dates, and units to source records/export data.
3. Test any available drill-down links and verify they resolve to the corresponding record.
4. Check missing-data sections show clear absence rather than stale or invented content.

**Expected/pass:** Supported consistent data and usable navigation. This verifies data correspondence, not medical interpretation.
**Fail:** Contradictory facts/source/date, broken drill-down, or another wallet's data. Unavailable categories/drill-down controls remain untested variants.

### RECORDS-04 — Check Sources, details, counts, and status

**Start:** F4, with F5 for populated content. **Priority:** P0. **Observed:** Passed, including final one-source persistence.

1. Select Sources and verify the Northern California Kaiser card appears once.
2. Check Connected status, last-refresh display, and source details.
3. Compare counts only when their scopes are equivalent; the observed 43 routine + 13 specialist visits equaled 56 visits.
4. Navigate back to Timeline/Summary and verify usable corresponding records.

**Expected/pass:** Correct region, accurate status, coherent scope/counts, no duplicate source.
**Fail:** Wrong/duplicate provider, contradictory totals for the same scope, lost details, or unrelated records. Short loading states and date-only labels are handled explicitly.

### RECORDS-05 — Open distinct records and verify document rendering

**Start:** F5 with a visit, an imaging record, and available documents. **Priority:** P0. **Observed:** Passed two distinct detail/document views.

1. Open a representative visit; compare metadata with its selected entry, then open its clinical-note document.
2. Scroll through the readable viewer and compare its content with the private fixture.
3. Close document and record overlays; open a distinct imaging record and its document.
4. Verify different content, correct metadata/source, readable full content, and usable viewer/back controls. Exercise multipage/zoom controls when available.

**Expected/pass:** Selected records show their own complete readable content without stale detail reuse.
**Fail:** Blank/error viewer, wrong patient/source/record, clipped/missing content, or stale prior document. Absent formats/multipage fixtures remain untested variants.

### DOWNLOAD-01 — Download and open individual documents

**Start:** F5 with the representative document fixtures. **Priority:** P0. **Observed:** Passed clinical-note and imaging-report HTML downloads.

1. Open a selected record/document and begin listening for download before clicking its `Download` action.
2. Save privately, check completion and nonzero bytes, and identify the real format.
3. Parse/open in an appropriate reader and compare full readable content with the selected viewer.
4. Repeat for a distinct document and each available fixture format.

**Expected/pass:** Genuine usable format, correct record correspondence, complete content. Actual downloads here are valid HTML fragments; requiring PDF or full html/body wrappers would be an incorrect assertion.
**Fail:** Empty/corrupt file, wrong record, incomplete content, or a login/error response presented as a document. A click or HTTP 200 alone is insufficient.

### NAV-01 — Check Records and Sharing content across navigation

**Start:** F1; F5 for populated Records. **Priority:** P0. **Observed:** Passed empty and populated navigation; Connections and Shared Links inspected.

1. Note the wallet identity in Records; open Sharing and verify its correct title/heading.
2. Open Connections and wait for settled content; inspect existing authorized entries or `No Connections`.
3. Open Shared Links and wait for `Loading...` to resolve. Accept the genuine empty state (`No links yet`) or existing active/inactive groups with their counts; verify `Create share link` is present. Expand existing inactive history only for inspection and preserve it. The November 13 baseline displayed `Inactive links (1)`; after the approved temporary-link cleanup it displayed `Inactive links (2)`. Do not require an empty list.
4. Return to Records and confirm title, records, and active identity. Exercise Back/Forward/reload with an approved fixture.

**Expected/pass:** Correct scoped content and navigation, no stale account data. No new share or invitation is required.
**Fail:** Wrong wallet/recipient content, broken loading/navigation, or lost session. Browser Back/Forward variants were not exhaustively executed in this exploration.

### DOWNLOAD-02 — Download the entire record through the PDF tab

**Start:** F5; known expected export scope and private record markers. **Priority:** P0. **Observed:** Passed genuine 106-page export and representative content checks.

1. Close all detail overlays and ensure the global Records heading is visible.
2. Start listening for a **new tab/popup**, then More options → `Download as PDF`.
3. Wait for the new PDF tab and its Chrome PDF viewer to load. Opening this tab is not yet a saved download.
4. In the **new tab**, click the PDF toolbar's exact `Download` control. Do not click Save to Google Drive or Summarize.
5. Capture the actual download from the PDF tab/viewer; use Chrome download events if the app-tab download event does not receive it. Save privately and verify completion, signature/MIME, nonzero bytes, readable pages, and no locked/corrupt pages.
6. Compare the exported scope with the fixture manifest and representative records/documents. In this run both individually checked document bodies were included in full.

**Expected/pass:** Full requested scope produces a usable PDF. All 106 observed pages rendered and had text; four source/document/representative content checks passed. The observed page count is evidence, not a permanent production constant.
**Fail:** Wrong/subset record, missing expected content, corrupt/empty artifact, or incomplete job. A timeout waiting on the original app tab alone is not an export failure when a PDF popup exists. Full record-by-record reconciliation requires a complete fixture manifest.

### PRINT-01 — Print the entire record using the direct Records action

**Start:** F5, global Records controls visible, detail overlays closed. **Priority:** P0. **Observed:** **Failed full-record content expectation; P-01.**

1. Open Records → Timeline → More options → `Print Records`.
2. Verify Chrome print preview opens and inspect its generated pages/content.
3. Compare complete expected clinical document content and scope with the full-record fixture/export; do not infer completeness from opening a print dialog.
4. Inspect layout/readability/page breaks and cancel preview. Confirm the wallet remains usable.

**Expected/pass:** The entire requested record scope is readable in print output.
**Actual:** A readable 10-page Timeline listing omitted both checked document bodies. Different page counts alone are not the failure; missing content is.
**Fail:** Missing/wrong content, clipped/unreadable pages, broken preview, or unusable app after cancel. A `window.print()` interception does not validate output.

### PRINT-02 — Verify complete printing from the exported PDF

**Start:** F5 and its completed full-record PDF tab, established independently through DOWNLOAD-02's popup flow. **Priority:** P0. **Observed:** Passed 106-page generated preview/content checks.

1. In the full PDF tab, click Chrome PDF toolbar `Print`.
2. Wait for preview readiness, select/check Save as PDF as the inspection destination, and verify all pages are included.
3. Inspect the generated preview PDF with a format-aware reader and compare full document text/representative scope with the downloaded full PDF.
4. Cancel without submitting to a physical printer; return to the wallet.

**Expected/pass:** Complete readable print output and safe return. All 106 generated pages rendered, contained text, and passed the four private content checks in this run.
**Fail:** Truncated/subset output, missing expected documents, wrong record, or broken return. This verified alternative is tracked separately from the direct PRINT-01 failure.

### SHARING-01 — Inspect defaults, select preferences, and cancel without creating a link

**Start:** Fresh F6 owner page with no open form; establish the current active/inactive-link baseline independently. **Priority:** P0. **Observed:** Passed November 13, 2026; no link submitted.

1. Verify the configured Google identity in Login Methods. Open Sharing → Shared Links and wait for settled content.
2. Record the initial link identifiers/counts privately. Open `Create share link`.
3. Verify `Link name` is prefilled with a dated name and explains that the name is visible only to the owner. Verify `One-time use` and `All health records` are selected by default.
4. Select `Selected data types`. Verify nine optional checkboxes: Conditions, Medications, Labs, Vitals, Clinical visits, Allergies, Procedures, Immunizations, and Clinical notes. Verify `Demographics and contact information` is always included.
5. Click `Clear`; verify zero optional types are checked and the control becomes `Select all`. Select Vitals alone, enter a name generated for `SHARING-01` using the shared naming convention, and keep `One-time use` selected.
6. Click `Cancel`. Verify the original list is unchanged and the QA name is absent. Reopen the form, verify the default dated name/one-time/all-records preferences are restored, and cancel again.

**Expected/pass:** Radio and checkbox changes are reflected accurately; cancellation creates no resource and preserves all prior links. The raw-record/download warning remains visible.
**Fail:** Cancel creates a link, changes another link, loses the baseline, or reopening shows stale canceled choices.
**Cleanup:** Cancel any open form. Never deactivate a baseline link. Verify that cancellation and reopening leave the captured baseline unchanged.

### SHARING-02 — Create a one-time scoped link, verify persistence, and deactivate it

**Start:** Fresh F6 owner page with baseline links captured independently. **Priority:** P0. **Observed:** Automated main-suite run passed: created one uniquely named scoped link, verified active reload, explicitly deactivated it, verified inactive reload/history, and preserved baseline links.

1. Confirm the Google wallet identity. Open Sharing → Shared Links → `Create share link`.
2. Generate the name once with `createShareLinkName('SHARING-02')` and enter it. Select `One-time use` → `Selected data types` → `Clear` → Vitals only. Confirm that demographics/contact information is mandatory and included in the approval.
3. Establish the owner-details cleanup path before submission. Prepare a private cleanup ledger and a `finally` cleanup handler. Record the QA name and pending creation before clicking once.
4. Click `Create share link` once. Immediately save the returned link identifier and owner-details route privately, before making other assertions. Keep any bearer URL/QR payload out of logs, reports, traces, and messages.
5. Verify the owner details identify the QA link and expose `Deactivate link` while it is active; do not require a literal `Active` label if the details do not show one. Compare one-time type and exact normalized scopes with the approved submission. Check `Link type`, `Created on`, and `What's included`; reload and verify persistence.
6. Select `Deactivate link`, verify `This link is inactive` and `Deactivated by you`, reload the details, and verify the link appears in inactive history. Confirm every pre-existing link is unchanged. Fixture teardown repeats owned-link recovery/deactivation even when an earlier assertion fails.

**Expected/pass:** Exactly one matching active link is created with the approved name/type/scope, persists after reload, and is explicitly deactivated before the scenario ends. No baseline link changes.
**Fail:** Duplicate creation, broader scope, wrong owner/name/type, lost persistence, exposed bearer token, or any active test link remaining after cleanup. Treat an ambiguous submission as potentially successful and locate the QA link before retrying.
**Execution evidence:** SHARING-02 passed in the 14-test main run. The test verified active metadata, exact one-time Vitals-plus-mandatory-demographics/contact scope, persistence after reload, and explicit deactivation. Both the test body and fixture teardown verified inactivity; the private ownership ledger records one created link in inactive state. The active link was never opened or distributed.

## 4. Coverage and reporting

| Requested behavior | Scenarios |
| --- | --- |
| Public login navigation | AUTH-01 |
| Existing imported records and persistence | RECORDS-01 |
| Open different records and documents | RECORDS-02, RECORDS-05 |
| Timeline / Summary / Sources | RECORDS-02, RECORDS-03, RECORDS-04 |
| Correct wallet title / Records / Sharing | WALLET-01, NAV-01 |
| Share-form defaults, scope choices, and cancellation | SHARING-01 |
| Create one scoped link and clean it up | SHARING-02 |
| Individual document downloads | DOWNLOAD-01 |
| Entire-record download and PDF-tab second click | DOWNLOAD-02 |
| Entire-record print / verified PDF alternative | PRINT-01, PRINT-02 |

Implementation/reporting requirements:

- Use accessible names from actual snapshots; do not invent test IDs or persist ephemeral snapshot refs.
- Synchronize popup/download/navigation events with actions. For native Chrome preview, validate its actual generated output or record a manual content/layout requirement; dialog invocation alone is insufficient.
- Keep one-hour access expiration, initial empty versus current populated state, and loaded versus total counts distinct.
- Record **Passed**, **Failed**, **Blocked**, **Not run**, or **Not applicable** per assertion, with browser, fixture, and minimal nonclinical evidence.
- Keep passwords, recovery number, cookies, OAuth codes/state, signed document URLs, and clinical text out of this file and shared traces/reports. Failure screenshots are enabled for local debugging, stored in ignored test output, and attached to the private HTML report; they can contain displayed health information. Private file checks used Cheerio for HTML and PDF.js with native canvas for PDF parsing/rendering; no clinical document content is reproduced here.
- Historical browser exploration and local artifact validation are distinguished from automated results; P-01 remains a known expected failure.
- Sharing assertions check the returned owner metadata, active reload, explicit deactivation, inactive reload/history, and unchanged pre-existing links. Screenshots mask QR codes and bearer-value fields.
- Every mutation scenario establishes its own fresh state, captures a private baseline, records any newly created identifier before further assertions, and deactivates all of its still-active resources in `finally`. Recover ambiguous submissions by locating the QA resource before retrying. Do not deactivate an unrelated/pre-existing link.
- Use the shared `QA-<scenario ID>-<UUIDv4>` naming convention for new resources in both Sharing scenarios. Avoid `cleanup` in link names; generate once per test attempt and preserve that name through request recovery and deactivation.
- Planner/browser MCP tools (`planner_setup_page`, `planner_save_plan`, and `browser_*`) were unavailable in this session. Exploration used installed Playwright attached to the existing regular-Chrome default context and accessible snapshots; this Markdown was saved directly. No screenshots were needed.

**Verified states:** Earlier record exploration confirmed the correct Google wallet, one Kaiser source, available imported records, two individual documents, a full 106-page PDF, and a complete 106-page PDF print preview canceled without physical printing. On November 13, normal Google sign-in restored the same identity without a phone challenge. Form changes were canceled, then exactly one explicitly approved temporary one-time scoped link was created and deactivated; inactive reload passed and both the test entry and the original entry appeared under `Inactive links (2)`. No active test link remains. The final NAV-01 check passed and task Chrome was closed after the run. Direct `Print Records` remains finding P-01; exhaustive record reconciliation was not performed.

## 5. Generated automation

All 14 scenarios have runnable files: 12 under `tests/healthex` and 2 under `tests/sharing`. They share the main Chrome configuration, authentication/data fixtures, automatic Chrome startup/shutdown, and HTML reporting. `npm test` runs them together; `npm run test:sharing` runs the two Sharing cases using that same configuration.

`SharingPage` and its fixture keep UUID-based names, exact returned identifiers, private mode-0600 ownership ledgers, baseline preservation, and deactivation in teardown. SHARING-02 creates one one-time link for Vitals plus mandatory demographics/contact information. It requires no separate Sharing configuration, contract file, backend-clock module, or delayed validation. Inputs remain externalized in the existing environment/record fixtures.

The read-only command includes SHARING-01 and excludes link creation. Test listing uses the list reporter only, preserving the last execution report. The main 14-test run completed with 13 ordinary passes plus the known expected P-01 failure, 0 skipped, 0 unexpected failures, and 0 global errors. One test-owned share link was created and explicitly deactivated; baseline links were preserved. Test Chrome closed and the HTML report opened. Private results: `private-artifacts/main-sharing-verification.json` and `private-artifacts/main-sharing-summary.json`.
