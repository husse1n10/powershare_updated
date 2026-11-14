# PowerShare Manual Test Cases

| Test ID | Area | Preconditions | Steps | Expected Result |
|---|---|---|---|---|
| QA-AUTH-LOGIN-001 | Login | Valid owner credentials | Submit owner username/password | Owner dashboard opens and correct role is displayed |
| QA-AUTH-LOGIN-002 | Login | Invalid password | Submit known username with wrong password | 401/invalid credentials; no session created |
| QA-REG-001 | Registration | Active destination exists | Register with details, installation address and selected generator; omit meter number; log in immediately | Account opens with Awaiting meter assignment and correct destination |
| QA-REG-002 | Registration validation | Registration page open | Omit destination/address or reuse a username/email | Clear validation; no orphan account or application |
| QA-REG-003 | Owner/admin meter assignment | Pending application exists | Responsible owner or admin opens Subscriber applications, selects a plan for requested generator and assigns a unique meter | Subscription and profile created once; subscriber sees assigned meter |
| QA-REG-004 | Concurrent assignment | Pending application exists | Responsible owner and admin submit meter assignment simultaneously | Exactly one assignment succeeds; no duplicate profile/subscription |
| QA-REG-008 | Application ownership | Two generator owners and pending applications exist | Owner lists applications and attempts detail/assignment for the other owner's application; try as collector/subscriber | Owner sees only own generators' applications; unrelated detail/assignment returns 404; collector/subscriber denied |
| QA-RBAC-004 | Collector authorization | Collector has restricted assignments | Try unassigned subscriber/bill operation | 403/not assigned; no record changed |
| QA-ADMIN-001 | Admin dashboard | Admin signed in | Open dashboard and change month/year | Statistics and fee snapshot load for selected period |
| QA-USER-001 | User management | Admin signed in | Create owner; search/filter list | User appears with correct role/status |
| QA-USER-002 | User management | Non-admin user exists | Deactivate then reactivate/edit user | Account status and editable fields persist |
| QA-OWNERADMIN-001 | Owner management | Owner account exists | Admin edits owner business name | Business name persists and appears in user list |
| QA-GEN-001 | Generator CRUD | Owner signed in | Add generator with location/capacity | Generator appears in list and database |
| QA-GEN-002 | Generator CRUD | Generator exists | Edit then deactivate generator | Updated values persist and inactive status is shown |
| QA-MAINMETER-001 | Main meter | Owner signed in | Create/edit/deactivate main meter | Meter record persists with correct starting reading/status |
| QA-SUB-001 | Subscriber | Plan and generator exist | Create subscriber with meter and initial reading | Subscriber and active subscription are created |
| QA-SUB-002 | Subscriber | Subscriber exists | Edit phone/address/meter/plan | Profile and subscription changes persist |
| QA-SUBACC-001 | Subscriber account | Subscriber without account exists | Owner creates subscriber login | Login links only to selected subscriber |
| QA-SUBSCRIPTION-001 | Subscription | Active subscriber exists | Deactivate then resubscribe | End date/status update and reactivation works |
| QA-PLAN-001 | Plans | Generator exists | Create/edit/deactivate ampere plan | Plan changes persist and only owner generator is accepted |
| QA-PRICE-001 | Monthly pricing | Plan exists | Save different prices for two months | Each month keeps independent price/exchange rate |
| QA-FIXED-UI-001 | Fixed billing | Fixed subscriber exists | Generate monthly bill without meter reading | Bill uses fixed USD amount without meter requirement |
| QA-COLLECTOR-001 | Collector | Owner signed in | Create/edit/deactivate collector | Collector account is owned by current owner and status persists |
| QA-ASSIGN-001 | Assignments | Collector/generators/subscribers exist | Assign collector to selected scope | Collector sees only assigned scope |
| QA-METER-001 | Meter reading | Subscription exists | Record valid reading > previous | Reading saves with previous/current/consumption history |
| QA-UPLOAD-001 | Meter image | Owner/collector signed in | Upload valid JPG/PNG/WEBP <=8MB | Image accepted and OCR starts |
| QA-UPLOAD-002 | Meter image | Owner/collector signed in | Upload PDF or oversized image | Upload is rejected with controlled error |
| QA-OCR-CONFIRM-001 | OCR confirmation | OCR returned values | Change/confirm detected value before saving | Only confirmed reading is saved |
| QA-AUTOID-001 | Meter identification | Meter belongs to active subscriber | Scan/enter normalized meter number | Correct subscriber is located |
| QA-METER-002 | Consumption | Previous reading known | Enter current reading 250 after 200 | Consumption is 50 kWh |
| QA-CURRENCY-001 | Dual currency | Rate configured | Generate invoice | LBP and USD totals are displayed and stored |
| QA-RATE-UI-001 | Exchange rate | Owner signed in | Change current rate after old invoice exists | Old invoice rate/totals do not change |
| QA-INVOICEHIST-001 | Invoice history | Multiple months billed | Open bill history | Invoices are ordered by period and retain historical values |
| QA-PAYMENT-UI-001 | Payment | Open bill exists | Record full payment | Payment history entry created and bill becomes paid |
| QA-BALANCE-001 | Balances | Prior bill has remainder | Generate following bill | Previous balance is carried and visible |
| QA-COLPAY-001 | Collector collection | Assigned unpaid bill exists | Collector records cash payment | Bill balance decreases and collector ledger increases |
| QA-SETTLEMENT-001 | Settlement | Collector has positive balance | Request settlement; owner confirms | Settlement becomes confirmed and available collector balance decreases |
| QA-PORTAL-001 | Subscriber portal | Subscriber signed in | Open dashboard/bills/consumption/payments | Only own data is visible |
| QA-RBAC-SUB-001 | Subscriber isolation | Two subscriber accounts exist | Attempt URL/API access to another subscriber bill | Other subscriber bill is not returned |
| QA-CONSUMPTION-001 | Consumption history | Readings exist | Open consumption page | Historical readings and kWh differences appear |
| QA-PAYHIST-001 | Payment history | Payments exist | Open payments page | Own payment records and invoice references appear |
| QA-OUTAGE-UI-001 | Outage | Owner signed in | Create/edit/deactivate one-time outage | Outage persists and affected subscribers are notified |
| QA-RECUR-001 | Recurring outage | Owner signed in | Create recurring weekday outage | Recurring schedule is stored/displayed correctly |
| QA-SUBOUT-001 | Subscriber outage | Subscriber generator has outage | Open subscriber outage page | Only relevant active outages appear |
| QA-NOTIFY-001 | Notifications | Notification exists | Open notification and mark read | Read status/time changes |
| QA-NOTIFY-002 | Notifications | Several unread notifications exist | Use Mark all read | All current user notifications become read |
| QA-SUPPORT-001 | Support | Any authenticated role | Create support ticket and open details | Ticket is created under correct owner context |
| QA-SUPPORT-002 | Support authorization | Owner/admin and unrelated user exist | Try viewing/updating unrelated ticket | Unauthorized access is denied |
| QA-REPORT-001 | Reports | Admin/owner signed in | Open reports page | Counts/financial summary match source records |
| QA-PROFILE-001 | Profile | Authenticated user | Update permitted profile fields | Changes persist and current session displays updated values |
| QA-PASSWORD-001 | Password | Authenticated user knows current password | Change password and try old/new credentials | Refresh sessions revoked; old password fails; new password works |
| QA-SETTINGS-001 | Settings | Owner/admin signed in | Update allowed settings | Values persist and influence future records only where appropriate |
| QA-AUDIT-001 | Audit | Perform login/profile/bill/payment actions | Admin opens Audit Log | Important actions show actor, route, entity and timestamp |
| QA-RESP-001 | Responsive UI | Desktop browser | Test 1920x1080 and 1366x768 | No clipped critical controls; sidebar/layout usable |
| QA-RESP-002 | Responsive UI | Mobile browser/device | Test ~390x844 and rotate | Navigation, meter scan and forms remain usable |
| QA-RTL-001 | Arabic RTL | Authenticated user | Switch EN to AR | Direction becomes RTL and layout remains usable |
| QA-FIN-UAT-001 | Balance carry-forward lifecycle | Subscriber has an unpaid prior-month remainder | Generate the next month bill, then inspect both invoices and dashboard balance | Prior bill becomes carried-forward, new bill contains the remainder once, and outstanding total is not duplicated |
| QA-CONCUR-001 | Concurrent payment integrity | One open bill is visible on two sessions/devices | Submit payments from both sessions at nearly the same time | At most one stale update succeeds; the other receives a controlled 409 conflict and no overpayment/duplicate ledger entry is created |
| QA-CONCUR-002 | Concurrent settlement integrity | Collector has balance and two pending settlements that together exceed it | Confirm both settlements at nearly the same time | Row locking prevents negative balance; one confirmation is rejected with a controlled conflict when funds are no longer sufficient |
| QA-SEC-COOKIE-001 | Refresh-token storage | User logs in using browser developer tools | Inspect cookies and browser local/session storage | Refresh token exists only as HttpOnly cookie; authentication tokens are not stored in localStorage/sessionStorage |
| QA-SESSION-001 | Password/session invalidation | Same account signed in on two browser sessions | Change password in session A, then use session B | Session B is rejected as invalidated; old password fails and new password authenticates successfully |
| QA-REPORT-005 | Period report reconciliation | Owner has known bills/payments/readings for selected month | Open report for that month and manually reconcile source records | Bill count, current charges, consumption, collected amount and outstanding amount match source data without double-counting carried debt |
| QA-OCR-UAT-001 | OCR recognition | Clear and low-quality sample meter images are available | Upload multiple meter images with known meter number/reading | OCR attempts extraction; uncertain values remain editable and nothing is saved until confirmation |
| QA-BILL-UAT-001 | Invoice generation | Active subscriber, monthly pricing and meter reading exist | Generate invoice and manually recalculate consumption, maintenance, VAT, exchange rate and prior balance | Stored/printed invoice matches the independent calculation and selected billing period |
| QA-PARTIAL-UAT-001 | Partial payment | Open invoice has a known remaining balance | Record a partial payment, reopen invoice, then record another payment | Status becomes partially paid after first payment; next payment defaults to remaining amount and never recharges the original total |
| QA-LEDGER-UAT-001 | Collector ledger | Collector has recorded collections and confirmed settlements | Reconcile collector wallet against payment records and settlement records | Ledger balance equals collections plus adjustments minus confirmed settlements with traceable references |
| QA-ARCH-UAT-001 | Maintainability / architecture | Source code available for review | Inspect representative Login, Billing and Subscriber flows | Requests follow PL → BLL → DAL; PL does not query MySQL directly and DAL does not contain presentation logic |
| QA-BALANCE-UAT-001 | Balance reminder | Subscriber portal account has an open invoice | Owner sends balance reminder from Bills screen; subscriber opens Notifications | Subscriber receives a balance notification linked to own Bills page; reminder is audit logged |
| QA-SETTLEMENT-NOTIFY-001 | Settlement notifications | Collector has a positive wallet balance | Collector requests settlement; owner confirms/rejects | Owner is notified of request and collector is notified of the final decision |
| QA-SUPPORT-VALID-001 | Support validation | Authenticated user | Submit invalid category/priority, very short subject, and oversized reply | Request is rejected with controlled 422 validation response and no invalid ticket data is written |
| QA-CONCUR-003 | Concurrent settlement request integrity | Collector has a balance that cannot cover two simultaneous requests | Submit two settlement requests at nearly the same time | Collector row lock and pending-total calculation allow only requests within available balance; excess request receives controlled conflict |

### QA-SETTLEMENT-IDEMP-001 — Reject a settlement only once
**Precondition:** A collector has one pending settlement request.
1. The Generator Owner rejects the pending settlement.
2. Repeat the rejection request for the same settlement (for example, by resubmitting the stale browser action).
**Expected:** The first request changes the status to rejected and sends one rejection notification. The second request is rejected as no longer pending and must not create another notification or audit decision.
| QA-REPORT-010 | Detailed report analytics | Owner/admin has known period data including payments, collectors, support tickets and platform fees | Open Reports, select period, compare detail tables and export CSV | Billing status, payment methods, owner/generator performance, collector/outstanding or platform/support sections match source data; exported CSV matches visible performance rows |
| QA-NOTIFY-011 | Real-time notification delivery | Two browser sessions are signed in as different users and Socket.IO is reachable | Trigger a bill/payment/outage/support notification for User A | User A receives the new notification and unread badge without refresh; User B does not receive User A's notification; marking it read updates the badge |
| QA-COL-DASH-UAT-001 | Collector dashboard | Collector has assigned subscribers, open bills and settlement history | Open Collector home page | Dashboard shows assignment count, bills to collect, available wallet balance, pending/recent settlements and quick actions without exposing other owners' data |
| QA-PROFILE-SYNC-001 | Subscriber profile consistency | Subscriber login is linked to a subscriber profile | Change subscriber name/phone from profile, then reopen owner subscriber list and invoice preview | Login profile and linked subscriber billing profile show the same updated name/phone; address, meter and owner-controlled fields remain unchanged |
| QA-A11Y-UAT-001 | Keyboard accessibility | Authenticated page open on desktop | Press Tab from browser content start and activate Skip to main content | Focus moves directly to the main page content; sidebar can be bypassed without mouse use |
| QA-RTL-UAT-002 | Arabic role navigation | Any role authenticated | Switch to AR and inspect sidebar/dashboard quick actions | Operational navigation labels are Arabic, sidebar direction is mirrored, and quick-action arrows/layout remain visually correct |
| QA-UI-ERR-UAT-001 | Frontend error recovery | QA build with a controlled component error injected | Trigger the component error inside an authenticated page | Friendly recovery panel appears instead of a blank application; Try again/Reload actions are available |
| QA-SEC-VALID-001 | Authentication/profile input bounds | Login/register/profile forms or API client available | Submit overlong username/password, invalid email/phone and unsupported language | Controlled 422 validation response is returned; invalid data is not written and server remains responsive |

## Final hardening / operational QA cases

| ID | Area | Precondition | Steps | Expected Result |
|---|---|---|---|---|
| QA-ADMIN-DASH-UAT-001 | Admin dashboard finance | A previous balance has been carried into a new month and payments exist across two different months | Select each month on Admin Dashboard and reconcile bills/payments manually | “Billed” reflects only current-period charges, “Collected” reflects payments actually recorded in that month, and open outstanding debt is not double-counted |
| QA-SETTINGS-UAT-002 | Platform settings | Admin signed in | Save valid platform name/fee/rate/feature flag/email, then try unknown key, negative rate and malformed email through API/UI | Valid values persist and create audit entries; unsupported/invalid values return controlled 422 and are not stored |
| QA-VALID-UAT-002 | Request validation | Authenticated Owner/Collector/Subscriber sessions available | Submit non-numeric/zero IDs, negative payment/readings, invalid dates/times, oversized combine arrays and oversized assignment arrays | PL rejects malformed requests with controlled 422 before any database change |
| QA-SESSION-UAT-002 | Access-token refresh | User remains signed in long enough for an access token refresh | Keep application open through access-token expiry and continue navigating | Refresh succeeds with HttpOnly refresh cookie; valid Base64URL JWT payload schedules refresh and user is not unexpectedly logged out |
| QA-OPS-UAT-001 | Deployment readiness | Backend can be started with MySQL available and unavailable | Request `/api/health` and `/api/ready` in both states | Liveness stays OK while process runs; readiness returns 200/`database: ok` with MySQL and 503/`database: unavailable` without MySQL |

## Meter upload privacy QA

| ID | Area | Precondition | Steps | Expected Result |
|---|---|---|---|---|
| QA-UPLOAD-PRIVACY-UAT-001 | Meter image privacy and cleanup | Owner/Collector is authenticated and a supported meter image is available | Scan a JPG/PNG/WEBP meter image; after the response, try to access the uploaded filename through `/uploads/...`; repeat with an OCR failure/invalid meter match | Scan still returns OCR/match result as applicable; temporary original scan file is removed after processing on success or failure; `/uploads/...` is not publicly served; unsupported formats are rejected before normal scan processing |

## Subscriber invoice, RTL and deployment acceptance cases

| ID | Area | Precondition | Steps | Expected Result |
|---|---|---|---|---|
| QA-PORTAL-INVOICE-UAT-001 | Subscriber detailed invoice | Two Subscriber accounts exist and Subscriber A has a normal or combined bill with meter-reading data | Sign in as Subscriber A; open Bills; view/print own invoice; verify identity, meter, readings, period/line items and totals; then attempt to request Subscriber B's bill ID | Subscriber A can view/print only the own tenant-scoped invoice; expected subscriber/generator/meter/readings and combined source periods are shown when present; another subscriber's bill is not disclosed |
| QA-PORTAL-RTL-UAT-001 | Subscriber Arabic/RTL | Subscriber is signed in | Switch language to Arabic and navigate Dashboard, Bills, Consumption, Payments, Outages and Settings on desktop and mobile widths | Subscriber Portal operational labels are Arabic, document direction/layout is RTL, values remain readable, and navigation/actions remain usable without clipped or reversed content |
| QA-DEPLOY-UAT-001 | Single-service deployment | Frontend dependencies are installed and a fresh production build exists; MySQL and backend production configuration are valid | Build React from source; start backend with `SERVE_FRONTEND=true`; open `/`, refresh a deep link such as `/subscriber/bills`, call `/api/health` and `/api/ready`, and establish Socket.IO | React assets and deep links are served from the same origin; API and Socket.IO routes remain handled by backend; no API response is replaced by `index.html`; missing frontend build causes controlled startup failure |

