# HealthEx automated test plan

**Updated:** November 13, 2026 — America/Los_Angeles  
**Main configuration:** `playwright.config.ts` (`playwright.chrome.config.ts` re-exports it)  
**Automated coverage:** 14 tests: 12 in `tests/healthex` and 2 in `tests/sharing`.

This plan describes the assertions in the current runnable tests. Manual exploration and page-object methods that no test calls are not counted as automated coverage.

## 1. Scope and prerequisites

The suite covers public login navigation, authenticated wallet identity/titles, existing records, Timeline filters/order, Summary, Sources, document rendering/downloads, native print previews, Sharing navigation, form cancellation, and one-time share-link creation/deactivation.

Prepare these before running authenticated tests:

- Complete Google sign-in using the configured account in the dedicated regular-Chrome profile. AUTH-01 checks the login entry page; it does not complete Google sign-in.
- Connect the provider and import records manually. The current suite does not search for or add providers, submit provider/HealthEx consent, authenticate to Kaiser, or refresh a source. Provider helper methods remain in `HealthExPage.ts` without runnable tests calling them.
- Have exactly one connected source matching `HEALTHEX_PROVIDER`. The existing source checks target the configured Northern California Kaiser wallet.
- Provide at least two representative records: one visit and one imaging record, both with complete expected document text and usable document controls. At least two records need `dateISO` values for ordering checks.
- Ensure Timeline has Visits, Diagnostic, and Immunization entries. RECORDS-02 requires every tested category to contain records. Summary must contain medications, conditions, and vitals.
- Use a wallet whose Sharing Connections view shows `No Connections`, as asserted by NAV-01. Existing Shared Links, including inactive history, are allowed and preserved.

Each case establishes its own starting page and validates its required data. Cases do not depend on another test importing records or generating expected data.

## 2. Configuration and expected data

Configuration is loaded from `.env`/`.env.local`; process environment variables take precedence. Follow [README setup instructions](../README.md).

| Configuration | Purpose |
| --- | --- |
| `HEALTHEX_GOOGLE_EMAIL`, `HEALTHEX_ACCOUNT_INITIALS` | Locate the wallet account control and verify the exact Google login method. |
| `HEALTHEX_PROVIDER` | Expected connected source/provider label. |
| `HEALTHEX_FIXTURE_FILE` | Expected record baseline; defaults to `playwright/.auth/fixtures.json`. |
| `HEALTHEX_AUTH_MODE=cdp`, `HEALTHEX_CHROME_PROFILE` | Reuse the dedicated regular-Chrome profile and its authenticated session. |
| `HEALTHEX_HEADLESS=false` | Required for the native print-preview cases. |
| `HEALTHEX_SYNC_TIMEOUT`, `HEALTHEX_EXPORT_TIMEOUT` | Loading and export wait limits. |
| `HEALTHEX_KNOWN_PRINT_SCOPE_BUG` | Controls the narrowly scoped expected-failure handling for P-01. |

[loadTestData](../tests/support/test-data.ts) reads the private fixture file. These are saved expected values, maintained separately from authentication state; `auth:save` does not create this baseline.

| Fixture field | Assertions or use |
| --- | --- |
| `records[].rowText` | Locate the exact normalized representative Timeline entry. |
| `records[].kind` | Ensure the baseline contains visit and imaging examples. |
| `records[].detailMarkers` | Check expected text in the selected record details. |
| `records[].documentButtonText` | Locate the selected record's document action. |
| `records[].documentText` | Compare complete normalized viewer/download text and verify document content in full exports/print output. |
| `records[].dateISO` | Compare representative Timeline positions with newest-first dates. |
| `records[].source` | Optional expected provider/source text in details. |
| `summaryMarkers` | Verify selected Summary facts in the page and exported PDF. |
| `exportMarkers` | Verify full-export and print content; the helper also includes complete representative document text. |

The [template](../test-data/fixtures.example.json) has empty arrays and must be populated with the prepared wallet's expected data. The tests check representative records and selected markers; they do not reconcile every clinical fact against the provider's original system. Source visit-count consistency is calculated from the displayed values rather than fixed expected totals.

## 3. Automated scenarios

### AUTH-01 — Reach the genuine HealthEx login

**Test:** [auth-01-reach-genuine-login.spec.ts](../tests/healthex/auth-01-reach-genuine-login.spec.ts)  
**Start:** A separate signed-out browser context with empty cookies/storage.

1. Open the configured public URL and verify the marketing title and `www.healthex.io` host.
2. Follow `Sign in`; verify the configured application host, `#/login-patients` route, and `HealthEx` title.
3. Verify `Welcome to HealthEx` and an enabled `Continue with Google` button.
4. Close the signed-out context.

**Pass:** Public navigation reaches the genuine application login with usable controls. Google authentication itself remains a setup prerequisite.

### WALLET-01 — Verify titles and active wallet across views

**Test:** [wallet-01-titles-active-wallet.spec.ts](../tests/healthex/wallet-01-titles-active-wallet.spec.ts)  
**Start:** Authenticated configured wallet.

1. Open Records; verify `HealthEx | Patient Records`, `Your HealthEx`, and the Records tab.
2. Open Login Methods and verify Google with the configured email. Check wallet headings for invalid `undefined`/`null` values.
3. Open Sharing; verify `HealthEx | Patient Sharing` and `Share your Records`.
4. Return to Records, reload, and repeat the title/wallet/identity checks.

**Pass:** Both views show their correct titles and preserve the configured wallet identity.

### RECORDS-01 — Verify records arrive and persist

**Test:** [records-01-arrival-and-persistence.spec.ts](../tests/healthex/records-01-arrival-and-persistence.spec.ts)  
**Start:** Existing connected source and representative imported-record baseline.

1. Open Records and verify identity; wait for loading indicators to resolve.
2. Verify representative fixture rows are present in Timeline.
3. Open every configured representative record, compare its detail markers and optional source text, then close its details.
4. Verify the connected source, return to Timeline, reload, and repeat record/identity checks.

**Pass:** Previously imported representative records remain available after navigation and reload. This case waits for existing data readiness; it does not initiate an import or refresh.

### RECORDS-02 — Check Timeline content, ordering, loading, and navigation

**Test:** [records-02-timeline-ordering-navigation.spec.ts](../tests/healthex/records-02-timeline-ordering-navigation.spec.ts)  
**Start:** Populated Timeline, all tested categories available, and two dated representative records.

1. Select Visits, Diagnostic, and Immunization independently; verify the selected state and nonempty rows containing only the permitted types. Visits allows Specialist, Primary Care, and Rehabilitation; Diagnostic allows Imaging and Lab Draw; Immunization allows Immunization.
2. Reset to All and verify its selected state and representative rows.
3. Compare fixture dates with the displayed representative positions to verify newest-first ordering.
4. Scroll the last loaded row into view; verify the row count does not decrease and fixture rows remain present.
5. Open two different representative records and verify their detail text differs.

**Pass:** Category selection, representative ordering, loaded-row preservation, and distinct details work. Scrolling does not prove exhaustive pagination or total record completeness.

### RECORDS-03 — Check populated Summary against underlying data

**Test:** [records-03-summary-correspondence.spec.ts](../tests/healthex/records-03-summary-correspondence.spec.ts)  
**Start:** Populated Summary and nonempty `summaryMarkers`.

1. Open Summary and verify every configured Summary marker.
2. Verify medications, conditions, and vitals are represented in the page text.
3. Export the full PDF and verify the same Summary markers are present in its content.
4. Return to Summary. Check that any record drill-down links exposed by the page have destinations; annotate their absence when none exist.
5. Verify the page does not render `undefined` or `NaN` values.

**Pass:** Selected Summary facts agree with the saved baseline and export. The test checks available link destinations without following them; missing-category fixtures are outside this case.

### RECORDS-04 — Check Sources, details, counts, and status

**Test:** [records-04-sources-details-counts.spec.ts](../tests/healthex/records-04-sources-details-counts.spec.ts)  
**Start:** Exactly one connected configured source and populated records/Summary.

1. Open Sources; verify one source card, the configured provider label, and connected status.
2. Verify refresh-related information exists in the source view and details dialog.
3. Read the routine-visit, specialist-visit, and total-visit counts; require readable numeric values and `routine + specialist = total`.
4. Close details, verify Timeline rows, then check Summary markers.

**Pass:** Source identity/status, displayed visit-count relationships, and return navigation are consistent. No source refresh is submitted.

### RECORDS-05 — Open distinct records and verify document rendering

**Test:** [records-05-distinct-document-rendering.spec.ts](../tests/healthex/records-05-distinct-document-rendering.spec.ts)  
**Start:** Visit and imaging fixtures with different complete document text.

1. Open the visit and its configured document; wait for readable embedded-frame content.
2. Compare the full normalized viewer text with the visit's `documentText`.
3. Close overlays, then open the imaging record and its configured document.
4. Verify imaging text matches its fixture and differs from the visit document; close overlays and verify Timeline rows.

**Pass:** Both selected documents are readable, complete against their saved baselines, and distinct. PDF viewer zoom/multipage controls are not exercised by the current HTML document fixtures.

### DOWNLOAD-01 — Download and open individual documents

**Test:** [download-01-individual-documents.spec.ts](../tests/healthex/download-01-individual-documents.spec.ts)  
**Start:** All representative document fixtures, including visit and imaging examples.

1. Open each configured record/document and register a download listener before clicking Download.
2. Save the file, require successful completion and nonzero bytes, and detect its real format.
3. For HTML, compare full normalized downloaded text with the rendered viewer. The viewer has already been checked against the fixture.
4. For PDF, parse/render the pages and require the complete expected document text in the content.
5. Close each document and verify representative Timeline rows remain available.

**Pass:** Every prepared document downloads in a supported format with the expected content.

### NAV-01 — Check Records and Sharing content across navigation

**Test:** [nav-01-records-sharing-navigation.spec.ts](../tests/healthex/nav-01-records-sharing-navigation.spec.ts)  
**Start:** Authenticated populated wallet whose Connections view shows `No Connections`.

1. Verify Records identity/rows, then open Sharing and verify its title/heading.
2. Open Connections and assert `No Connections`.
3. Open Shared Links and accept either `No links yet` or a nonempty Active/Inactive links group. Verify Create share link is visible.
4. Return to Records and verify rows. Exercise browser Back/Forward between Records and Sharing and check their routes/titles.
5. Reload Records and verify rows and identity again.

**Pass:** Navigation preserves the expected wallet and displays the prepared Connections/Shared Links states. This test does not create a link or validate an existing Connection's details.

### DOWNLOAD-02 — Download the entire record through the PDF tab

**Test:** [download-02-full-record-pdf-tab.spec.ts](../tests/healthex/download-02-full-record-pdf-tab.spec.ts)  
**Start:** Populated wallet, nonempty export markers, and complete representative documents.

1. Close detail overlays and select Records → More options → Download as PDF while listening for a new tab.
2. Wait for the PDF tab/viewer. **Click Download again in that new tab's Chrome PDF toolbar** and capture the actual saved file.
3. Require a nonempty genuine PDF with a positive page count.
4. Parse/render every page, require text on every page, and verify all export markers plus the complete representative document texts.
5. Verify the wallet remains available.

**Pass:** The actual saved full-record PDF is readable across all its pages and contains the configured expected content. Page counts and file sizes are not hardcoded.

### PRINT-01 — Print the entire record using the direct Records action

**Test:** [print-01-direct-entire-record.spec.ts](../tests/healthex/print-01-direct-entire-record.spec.ts)  
**Start:** Headed Chrome, populated wallet, export markers, and document baselines.

1. Open Records → More options → Print Records.
2. Wait for native preview readiness, capture its complete generated PDF, and verify the captured page count matches the preview.
3. Parse/render its pages and compare expected export markers and complete representative document text.
4. Cancel the preview, return to Records, and verify representative rows.

**Pass:** Direct print output contains the expected content and the wallet remains usable. P-01 may cause an expected content failure under the configured flag; infrastructure/readiness/cleanup errors remain failures. No physical print job is submitted.

### PRINT-02 — Verify complete printing from the exported PDF

**Test:** [print-02-complete-exported-pdf.spec.ts](../tests/healthex/print-02-complete-exported-pdf.spec.ts)  
**Start:** Headed Chrome and the same full-export fixture requirements as DOWNLOAD-02.

1. Independently download and validate the full-record PDF while keeping its viewer tab open.
2. Click Print in that PDF viewer and wait for the native generated preview.
3. Compare preview/generated-PDF page counts with the exported PDF and verify all expected markers and rendered pages.
4. Cancel the preview, bring the wallet forward, and verify wallet/Timeline content.

**Pass:** Printing the full export preserves its page count and expected content. The preview is canceled without submitting a physical print job.

### SHARING-01 — Inspect defaults, select preferences, and cancel without creating a link

**Test:** [sharing-01-preferences-and-cancel.spec.ts](../tests/sharing/sharing-01-preferences-and-cancel.spec.ts)  
**Start:** Configured wallet identity and a freshly captured Shared Links baseline.

1. Open Sharing → Shared Links, capture the current link identifiers/statuses, and open Create share link.
2. Verify the dated name, owner-only name description, one-time/all-records defaults, and raw-record warning.
3. Select Selected data types; verify all nine optional checkboxes and mandatory demographics/contact information.
4. Click Clear, verify zero selected types and the Select all control, then select only Vitals and enter a unique QA name. Keep one-time use selected.
5. Cancel and verify no resource was created and baseline identifiers/statuses are unchanged.
6. Reopen the form, verify defaults reset, cancel again, and verify the baseline remains intact.

**Pass:** Preferences update, cancellation creates no link, and reopening restores defaults. Existing links are preserved.

### SHARING-02 — Create a one-time scoped link, verify persistence, and deactivate it

**Test:** [sharing-02-create-one-time-scoped-link.spec.ts](../tests/sharing/sharing-02-create-one-time-scoped-link.spec.ts)  
**Start:** Configured wallet identity and a freshly captured Shared Links baseline.

1. Generate `QA-SHARING-02-<UUIDv4>` and record ownership privately before submission. The name contains no `cleanup` or personal data.
2. Select one-time use, selected data types, and Vitals only. Demographics/contact information remains mandatory.
3. Submit creation once and save the returned identifier privately before subsequent assertions.
4. Verify the returned name, ACTIVE status, one-time flag, all-records disabled, and exactly `DEMOGRAPHICS`, `CONTACT_INFO`, `CLINICAL_VITALS`. Verify owner detail headings and Deactivate link are visible.
5. Reload the same link and repeat active metadata checks.
6. Explicitly deactivate the owned link; verify inactive details, Deactivated by you, persisted inactivity after reload, and inactive-list placement.
7. Verify all baseline links retain their names/statuses. Fixture teardown repeats owned-link recovery/deactivation even when an assertion fails.

**Pass:** The test-owned link is created with the selected scope, survives active reload, and is inactive at completion. It is never distributed or opened as a guest.

## 4. Execution and cleanup

```sh
npm run test:list
npm test -- --project=chrome --headed
```

| Command | Selected coverage |
| --- | --- |
| `npm test` | All 14 scenarios, including one share-link creation/deactivation. |
| `npm run test:readonly` | Login entry, wallet/records/navigation, downloads, and Sharing form cancellation; excludes link creation and print cases. |
| `npm run test:sharing` | SHARING-01 and SHARING-02 using the main configuration. |
| `npm run test:print` | PRINT-01 and PRINT-02. |
| `npm run test:report` | Open the saved HTML report. |

Runs use installed Chrome, one worker, and no automatic retries. In CDP mode, global setup opens the dedicated profile when needed, then global teardown closes task Chrome after workers finish. Authentication setup is separate; reopening Chrome does not complete an expired Google challenge.

Failure screenshots are attached to the report. Sharing cases use masked screenshots of their own test page. HTML reports are generated under `playwright-report`; local interactive runs open them automatically. Stop the report server with Ctrl+C when finished. Listing commands use only the list reporter and preserve the prior execution report.

Shared-link ownership ledgers are stored privately under `playwright/.auth/sharing-ledgers`. Teardown recovers ambiguous submissions by the unique test name, deactivates owned resources, and checks baseline preservation. If ownership or deactivation cannot be verified, cleanup fails and the ledger remains available for recovery. It never chooses a pre-existing link for deactivation by list position alone.

## 5. Known issue and coverage limits

### P-01 — Direct Records printing omits document contents

PRINT-01 tracks the direct print action's missing representative document content. With `HEALTHEX_KNOWN_PRINT_SCOPE_BUG=true`, only the recognized content mismatch is handled as expected, after successful preview capture/cancellation and safe return to Records. An infrastructure error remains unexpected. If the content check succeeds while the flag is enabled, Playwright reports an unexpected pass so the flag can be removed after confirming the fix.

PRINT-02 independently checks the exported PDF's print output. Its success does not resolve P-01 in the direct print action.

The suite checks the prepared record baseline and the explicit assertions above. It does not automate provider connection/import/refresh, complete Google authentication, exhaustively reconcile every provider record, test missing Summary categories, or validate a guest's use of a share link. Those operations are not implied by a passing 14-test report.

## 6. Plan verification

The scenario IDs, titles, and source links are checked against the 14 tests collected by `npm run test:list`. Updating this plan does not execute browser tests or create another share link. Actual pass/fail results come from the execution report, not this document.
