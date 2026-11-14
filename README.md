# HealthEx Playwright tests

## 1. Setup

Install Node.js **22.13+** and regular **Google Chrome**, then:

```sh
git clone git@github.com:abhilashanithkumar/healthex-automation.git
cd healthex-automation
npm ci
cp .env.example .env.local
```

Copy the environment file only on first setup; edit your existing `.env.local` for later changes.

## 2. Update `.env.local`

Set your Google email, wallet initials, connected provider, and expected-data file. Keep these settings for local Chrome runs:

```dotenv
HEALTHEX_GOOGLE_EMAIL=your-email@gmail.com
HEALTHEX_ACCOUNT_INITIALS=AA
HEALTHEX_PROVIDER="Kaiser Permanente - Northern California"
HEALTHEX_AUTH_MODE=cdp
HEALTHEX_HEADLESS=false
HEALTHEX_SLOW_MO=0
HEALTHEX_CLOSE_BROWSER_AFTER_RUN=true
HEALTHEX_FIXTURE_FILE=playwright/.auth/fixtures.json
```

Connect the provider and import records in HealthEx before testing. The current suite validates existing records; provider connection and refresh are not automated.

Store expected visit/imaging records, document text, Summary markers, and export markers in the file set by `HEALTHEX_FIXTURE_FILE`. See the [fixture template](test-data/fixtures.example.json) and [field definitions](tests/support/test-data.ts). Maintain this baseline separately; `auth:save` saves login state, not expected record data.

For the current known direct-print issue, set `HEALTHEX_KNOWN_PRINT_SCOPE_BUG=true`; see [P-01 in the test plan](specs/healthex-test-plan.md#p-01--direct-records-printing-omits-document-contents).

Keep `.env.local` and `playwright/.auth/` local; Git ignores both.

## 3. Sign in and run

Prepare authentication once, and repeat when the session expires:

```sh
npm run auth:open
# Complete Google sign-in and wait for the HealthEx wallet.
npm run auth:save
```

Run all 14 tests in visible Chrome:

```sh
npm test -- --project=chrome --headed
```

Run with 500 ms between actions:

```sh
HEALTHEX_SLOW_MO=500 npm test -- --project=chrome --headed
```

Other commands:

| Command | Purpose |
| --- | --- |
| `npm run test:sharing` | Run Sharing form and create/deactivate tests |
| `npm run test:readonly` | Run without creating share links |
| `npm run test:print` | Run print checks |
| `npm run test:list` | List tests |
| `npm run test:typecheck` | Check TypeScript |
| `npm run test:report` | Open the latest HTML report |

The Sharing test deactivates its created link. Test Chrome closes after the run, failure screenshots are attached to the report, and the HTML report opens automatically for local terminal runs. Press **Ctrl+C** when finished viewing the report to stop its server.
