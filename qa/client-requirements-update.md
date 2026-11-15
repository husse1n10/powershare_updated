# Requirements confirmed on 14 November 2026

## Registration and meter assignment (FR-002)

1. A visitor creates a subscriber account using their name, username, phone, optional email, preferred language and strong password.
2. They sign in immediately, even when no provider is currently available.
3. On their signed-in dashboard they choose an active generator/service area and enter an installation address.
4. The application becomes pending. The owning generator staff or administrator assigns the subscriber meter and an eligible plan.
5. The subscriber gains the active subscription dashboard after assignment.

Provider choice is an authenticated, one-time transition. Concurrent submissions cannot create duplicate applications. Client-supplied user/owner IDs cannot select another account. Previously pending and assigned applications retain their state.

The original Registration activity diagram described the earlier provider-at-registration flow. This dated requirement supersedes that decision. Existing Azure diagrams and Sprints 1–5 were not edited. A new Sprint 6 test story records the revised flow and its acceptance criteria.

## Passwords (FR-043 and all account forms)

New/changed passwords require at least eight characters, uppercase and lowercase letters, a number and a symbol, with no spaces. The backend rejects non-string values and passwords over bcrypt's 72-byte input limit. Frontend forms display matching guidance. Existing account passwords continue to authenticate until users choose to change them. Validation responses omit rejected values.

## Generators and meters (FR-007/FR-008/FR-009)

Generator creation collects generator details. It does not collect a subscriber meter number. The old optional generator `main_meter_number` metadata field was removed from that creation UI; historical database values are preserved. Dedicated main-meter and subscriber-meter management remain available.

## QA environments

Old deployed behavior was tested with labeled QA accounts and recorded separately. Those QA login accounts were deactivated after testing. Patched-source execution uses a separate MySQL test schema and synthetic credentials. No production schema reset, code deployment or change to the original 63 Azure work items was performed during this work.
