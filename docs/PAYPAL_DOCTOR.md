# PayPal Doctor report

On Oct 21, Earmark was checked against the **PayPal Doctor** checklist from PayPal's AI Toolkit
(`commands/doctor.md` and the `paypal-best-practices` references in
[github.com/paypal/AI-Toolkit](https://github.com/paypal/AI-Toolkit)). The checks were run by
reading the code. The toolkit's live probes need a sandbox access token and were not run.

```
Credentials & Security
  [✓] No client secret in source or in any browser bundle; secrets come from env vars only
  [✓] .env is git-ignored
  [✓] Sandbox-only: the app refuses to start if PAYPAL_ENVIRONMENT is anything but sandbox ← added

Authentication & Token Management
  [✓] Token cached and reused until expires_in; HTTP Basic auth; grant_type=client_credentials
  [✓] Concurrent callers share one token fetch; a failed fetch is not cached; 401 refreshes once
  [✓] PayPal-Request-Id on every POST, deterministic per operation and reused on retries
  [✓] Reauthorize Request-Id was time-based (a retry could renew twice)                     ← fixed

Orders API & Checkout
  [✓] Orders v2 with intent=AUTHORIZE; currency_code on every amount
  [✓] Every hold is re-checked with GET /v2/payments/authorizations/{id} before capture
  [✓] Orders are created on the server; amounts never come from the browser alone
  [✓] INSTRUMENT_DECLINED now restarts the PayPal flow instead of failing             ← added
  [✓] onError and onCancel are handled on the buttons                                     ← onCancel added
  [✓] Cross-site POSTs are refused on every state-changing route (CSRF)                 ← added

JS SDK (v5)
  [✓] One SDK script, official URL, intent=authorize matches the server flow, currency set

Webhooks
  [✓] Signatures verified with POST /v1/notifications/verify-webhook-signature
  [✓] Specific event types subscribed (no wildcard)
  [✓] PAYMENT.CAPTURE.COMPLETED handled
  [✓] Each verified event id is processed once (PayPal redelivers)                       ← added
  [✓] Bad signatures get 200 and are only logged (no probing, no replay)                 ← changed
  [✓] Malformed bodies no longer throw a 500                                              ← fixed

Environment & Configuration
  [✓] 429 retried with backoff, honouring Retry-After; 5xx retried with the same Request-Id
  [✓] Every call has a timeout
  [✓] debug_id is logged for every failed PayPal call                                    ← added
  [✓] return_url / cancel_url use the HTTPS app URL on Render

Summary: 0 critical · 0 warnings open · 9 items fixed or added in this pass
```

Tests: `tests/paypal-client.test.ts`, `tests/doctor.test.ts`, `tests/witness.test.ts`.

**Found in the toolkit itself:** `PayPalAgentToolkit.handleToolCall()` (`@paypal/agent-toolkit` 1.11.0) runs any tool name it's given, even ones the `actions` configuration didn't enable, and the toolkit defaults to the live API. Earmark's read-only witness (`src/lib/witness.ts`) therefore enforces its own one-tool allowlist and sets `sandbox` explicitly.
