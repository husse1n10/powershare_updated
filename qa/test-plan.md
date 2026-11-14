# PowerShare Quality Assurance Test Plan

## Objective
Verify that every approved proposal requirement is implemented correctly, that the PL/BLL/DAL architecture remains maintainable, and that financial/security behavior is reliable enough for production-style operation and project demonstration.

## Test Levels
1. **Static/Architecture checks** — syntax, PL→BLL→DAL dependency direction, frontend/API route contract, schema contract, and requirement traceability.
2. **Unit tests** — billing, payment/currency rounding, master-data validation, OCR parsing, outage validation, collector balances, platform fees, account rules, error normalization, and record integrity.
3. **Static contract tests** (`tests/integration`) — inspect source text (routes, SQL, schema, UI wiring) without running the system. They are fast tripwires against accidental removal of a safeguard but **cannot prove behavior**; a passing contract test is never evidence that a feature works.
4. **Live integration tests** (`tests/live`, `npm run test:live`) — drive the real Express API against MySQL with Socket.IO and file uploads, with no mocks: tenant isolation (IDOR), RBAC, token handling, billing, payments, carry-forward, combined invoices, settlements under concurrency, uploads/OCR, real-time room isolation. Each High/Critical defect gets a live regression test that must fail on the defective code.
5. **System/UI tests** — manual role workflows from `manual-test-cases.md`, including desktop/mobile behavior and Arabic RTL.
6. **Security tests** — role isolation, owner/tenant isolation, collector assignment authorization, invalid/expired tokens, HttpOnly refresh cookies, session invalidation, deactivated users, authenticated Socket.IO room isolation, rate limits, and upload constraints.
7. **Financial integrity & concurrency tests** — balance carry-forward, full/partial payments in USD/LBP, simultaneous payment attempts, collector ledger atomicity, and simultaneous settlement confirmation.
8. **Regression tests** — run the full QA command after every defect fix or significant feature change.
9. **User Acceptance Testing** — execute the major Admin, Owner, Collector and Subscriber end-to-end scenarios against the final deployment.

## Entry Criteria
- Requirement is documented in `requirements.json`.
- Implementation files exist.
- Database schema contains required entities/fields.
- Relevant routes/controllers/services/repositories are present.
- The feature has at least one traceable automated or manual verification reference.

## Exit Criteria
- `npm run qa` passes with zero automated failures.
- All Critical/High manual test cases pass on the presentation/deployment build.
- No unresolved Critical or High defects.
- Requirement traceability has no missing implementation or test references.
- Live MySQL database smoke test passes before and after the live suite.
- `npm run test:live` passes.
- Fresh frontend production build succeeds.
- End-to-end Admin → Owner → Subscriber → Meter → Bill → Payment → Collector → Settlement workflow passes.

## Defect Severity
- **Critical**: security breach, data loss/corruption, financial corruption, or system unusable.
- **High**: core workflow unavailable, authorization bypass, or financially incorrect result.
- **Medium**: feature works incorrectly but has a reasonable workaround.
- **Low**: cosmetic, usability, wording, or minor inconsistency.

## Regression Policy
A defect fix is complete only when a behavioral (live or unit) regression test exists that fails on the defective code and passes on the fix. Static contract tests may be added as tripwires but do not count as regression evidence.

Any fix affecting billing, payments, meter readings, authorization, authentication/session handling, settlements, historical data, or tenant isolation requires full automated regression plus the related manual workflow tests. Financial fixes must also re-run concurrency and carry-forward scenarios because errors can propagate across billing periods.

## Evidence Policy
Automated test output, the Requirements Traceability Matrix, manual execution results, and the Defect Log are retained as QA evidence. A test is not reported as passed unless it was actually executed in an environment capable of exercising that test level.

## Continuous Integration Gate
The repository includes `.github/workflows/qa.yml`. In an online GitHub Actions environment it provisions MySQL 8, initializes a clean database, explicitly seeds QA-only demo data, executes the complete source QA and live MySQL/API suites, and separately performs a fresh React production build. This does not replace final manual UAT, but it prevents merges that break reproducible automated QA.
