(function () {
  var D = { steps: {} };
  D.commits = [
    { sha: "a17e0d4", msg: "Add coupons table and SqliteCouponRepository" },
    { sha: "9c41e2a", msg: "Apply coupon discounts at checkout and add a coupon API" }
  ];
  var S = D.steps;
  S[1] = { blocks: [
    { target: true },
    { quote: "Apply coupon discounts at checkout and add a coupon API\nPOST /orders/:id/coupon takes a coupon code and attaches a discount to the order. Checkout charges the total minus the discount." },
    { p: "Both commits were co-authored by an AI model. So we read the commit message as a claim to check, not as a fact.", basis: "fact" }
  ] };
  S[2] = { blocks: [
    { p: "Before opening any code, a senior says in plain words who stops having a problem. Here: the shop can hand out a code worth a fixed number of yen. A customer attaches it to a cart, and checkout charges less." },
    { p: "A coupon is a promise about money. The shop is counting on three limits. We will check each one in later chapters." },
    { list: ["A code gives a discount only before its expiry date.", "A code gives a discount at most `max_uses` times in total.", "The amount charged is the total minus the discount, and never below zero."] },
    { p: "Nothing in the change creates coupons. The only `INSERT INTO coupons` is in the test setup. So in production, someone has to write coupon rows by hand. Keep that in mind for later.", basis: "fact" }
  ] };
  S[3] = { blocks: [
    { files: true },
    { p: "I checked every edit to existing tests. Each one only adds `discountAmount: 0` to an order literal. No expected value changed. So the old checkout and reconcile behavior is still asserted as before.", basis: "fact" },
    { p: "Where the time goes: most of it on the 18 lines of `apply()` and the one `UPDATE`. A little on the migration and the charged-amount line. The rest gets a quick look." }
  ] };
  S[5] = { blocks: [
    { p: "Before judging `apply()`, look at what checkout already promises. The status check below was the guard against double clicks before this change." },
    { code: { file: "src/orders/orderService.ts", at: "base", lines: [33, 41], show: [30, 49], note: "unchanged", marks: [{ line: 33, text: "only CART or PAYMENT_FAILED may be charged" }, { line: 40, text: "saved before the charge: blocks a 2nd checkout" }] } },
    { code: { file: "src/coupons/couponService.ts", lines: [18, 35], marks: [{ line: 21, text: "same states as checkout" }, { line: 28, text: "the only write to coupons" }, { line: 32, text: "cap: discount <= total" }] } },
    { p: "`apply` copies the same status check. So once checkout saves PENDING_PAYMENT, a coupon request gets 409. The discount cannot change while a charge is in flight. That keeps the amount sent to the payment service equal to the amount checkout read.", basis: "fact" },
    { p: "The order of checks is good too. The checks that only read (order exists, status, coupon exists, expiry) run first. The one write, `consumeUse`, runs last, so a rejected request does not burn a use.", basis: "fact" }
  ] };
  S[6] = { question: true, blocks: [
    { p: "Coupon `WELCOME` has `max_uses = 10` and `used_count = 9`. Two customers apply it to their own carts at the same moment." },
    { p: "`apply()` calls `this.#coupons.get(code)` on line 25 before it consumes a use. Can both customers end up with the discount, leaving `used_count` at 11?" }
  ] };
  S[9] = { question: true, blocks: [
    { p: "`WELCOME` has `max_uses = 10`, `used_count = 0`. A customer applies `WELCOME` to cart `o1`. The response is slow, so the app retries the same request. Both requests succeed with 200." },
    { p: "What is `used_count` now? And if the customer had applied `SPRING` first and then switched to `WELCOME`, what happens to `SPRING`?" }
  ] };
  S[10] = { blocks: [
    { timeline: { lanes: ["Customer", "CouponService", "coupons", "orders"], events: [
      { lane: "Customer", to: "CouponService", text: "apply(o1, WELCOME)" },
      { lane: "CouponService", to: "coupons", text: "consumeUse → used 1" },
      { lane: "CouponService", to: "orders", text: "coupon=WELCOME, discount=500" },
      { lane: "Customer", to: "CouponService", text: "retry: apply(o1, WELCOME)" },
      { lane: "CouponService", text: "status is still CART: passes", mark: "bad" },
      { lane: "CouponService", to: "coupons", text: "consumeUse → used 2", mark: "bad" },
      { lane: "CouponService", to: "orders", text: "same values written again" }
    ] } },
    { p: "Nothing in `apply()` looks at `order.couponCode` before calling `consumeUse`. The status stays CART after an apply, so every repeat passes the check on line 21. One order uses two of the ten slots. With `max_uses = 1`, the retry even returns `coupon_used_up` for the customer's own coupon.", basis: "fact" },
    { p: "Switching codes is worse. `SPRING` was consumed, then line 30 overwrites `couponCode` with `WELCOME`. No code ever gives the `SPRING` use back. A customer who switches codes a few times can drain a limited coupon that nobody actually used.", basis: "fact" },
    { p: "The tests apply each coupon to each order only once (`o1`, then `o2`). So no test covers a second apply on the same order.", basis: "fact" },
    { p: "Weight: **must fix**. It touches money and limits, and a normal client retry triggers it. The `UPDATE` was safe against two customers. The gap is one customer arriving twice, which is an **idempotency** problem.", basis: "inferred" }
  ] };
  S[12] = { blocks: [
    { p: "The name `expiresAt: Date` suggests a checked value. Follow it back to where it comes from." },
    { code: { file: "src/coupons/sqliteCouponRepository.ts", lines: [27, 27], show: [19, 29], marks: [{ line: 27, text: "any TEXT goes in; nothing is checked" }] } },
    { code: { file: "src/coupons/couponService.ts", lines: [27, 27], show: [25, 28], marks: [{ line: 27, text: "Invalid Date <= now is false" }] } },
    { p: "`expires_at` is a plain `TEXT NOT NULL` with no format check, and coupons are inserted by hand. If someone types `2026/12/31 end`, `new Date` gives an Invalid Date. Any comparison with it is false, so line 27 never throws. **The coupon never expires.**", basis: "inferred" },
    { p: "A value like `2026-12-31 23:59:59` (no `T`, no zone) is read in the server's local time zone, while the test data uses `Z` (UTC). The cut-off moves by the server's offset.", basis: "inferred" },
    { p: "Weight: **suggestion**. A bad row breaks one coupon, not every order, but it breaks it open. Throw in `get()` when `Number.isNaN(expiresAt.getTime())`, so a broken row is rejected instead of honored. Also document the expected format.", basis: "opinion" },
    { p: "The same pattern shows up in the cap. Line 32's `Math.min` keeps `discount_amount <= total_amount`, but the orders table has no CHECK for it. The base migration protected `total_amount >= 0` in the database. Today no code changes `totalAmount` after creation (I searched `src/`), so this is safe now. A `CHECK` would keep it safe for the next change. Weight: suggestion.", basis: "fact" }
  ] };
  S[13] = { blocks: [
    { p: "The test `caps the discount at the order total` gives a 5000-yen coupon to a 3000-yen order. Checkout will then call `charge` with `amount: 0`. Whether the payment service accepts 0 is outside this repository.", basis: "fact" },
    { p: "What our code does if the service refuses is fixed, though. A 4xx other than 402 becomes a plain `Error` (`src/payment/httpGateway.ts:35-36`). Checkout rethrows it and leaves the order PENDING_PAYMENT, and the client gets a 500. Ten minutes later, reconcile finds no charge and sets PAYMENT_FAILED. The customer can retry and hit the same wall every time.", basis: "fact" },
    { p: "Second question: after a declined card, the order is PAYMENT_FAILED and `apply()` allows a coupon. The retry then sends a **different amount** with the **same** key `order-o1`. Whether the payment service accepts that within its 24-hour key window is also outside this repository.", basis: "fact" },
    { p: "Weight: **question**. Before merging, someone should check the payment service docs for `amount: 0` and for reusing a key with a new amount. If either is rejected, skip the charge for 0 yen, or block coupons on PAYMENT_FAILED orders.", basis: "opinion" }
  ] };
  S[14] = { blocks: [
    { table: { head: ["Looks risky", "Why it is fine here", "Checked at"], rows: [
      ["apply and checkout racing on one order", "Single process, sync DB. Neither path waits on I/O between its read and its write, except the charge, and apply is rejected while PENDING_PAYMENT", "src/server.ts, src/app.ts:9, couponService.ts:21"],
      ["coupon_code foreign key not enforced", "PRAGMA foreign_keys = ON on every open", "src/db.ts:10"],
      ["Migration half-applied", "Each file runs in BEGIN/COMMIT", "src/db.ts:17-24"],
      ["SQL injection via the code", "Values are bound with ?", "sqliteCouponRepository.ts:20,37"],
      ["No auth on the new route", "Checkout has none either. Pre-existing, not added here", "base src/server.ts"]
    ] } },
    { list: [
      "Suggestion: `readJson` turns invalid JSON into a 500 (it is inside the try at `src/server.ts:21-30`) and reads a body of any size. Return 400 and cap the size.",
      "Question: is a use \u201cused\u201d when it is applied or when it is paid? Today an abandoned cart keeps its use forever.",
      "Question: rolling back to main would quietly charge full price on carts that already have a coupon, because the old checkout ignores `discount_amount`.",
      "Opinion: 404 / 410 / 409 lets anyone probe which codes exist. Consider rate limits if codes are guessable.",
      "Nit: `InvalidOrderStateError` says \u201ccannot be checked out\u201d when the coupon path throws it.",
      "Nit: `CouponService` takes the concrete `SqliteCouponRepository`, while `OrderService` takes the `OrderRepository` interface.",
      "Nit: the README still lists only `POST /orders/:id/checkout`."
    ] },
    { p: "In one sentence: the use limit holds against many customers, but not against one customer applying more than once, and expiry and the cap are kept only by app code that trusts its input.", basis: "inferred" }
  ] };
  S[15] = { blocks: [
    { p: "Mostly yes. The feature is small, follows the existing layers, keeps checkout's status rule, and has a race-free use limit. But it has one must-fix issue: a normal retry can consume extra uses. So the verdict is \u201cgood shape, fix idempotency before merging, and answer the payment questions\u201d.", basis: "inferred" },
    { table: { head: ["Label", "Comment"], rows: [
      ["Must", "`apply()` consumes a use every time it is called, even on an order that already has a coupon. Return early on the same code, reject a different one, and add a test that applies twice."],
      ["Suggestion", "An unparsable `expires_at` makes the coupon never expire. Reject Invalid Date in `get()`, and add a DB CHECK for `discount_amount <= total_amount`."],
      ["Question", "Does the payment service accept `amount: 0`, and a new amount under an idempotency key it has already declined? If not, a fully discounted order loops through 500 and PAYMENT_FAILED."],
      ["Praise", "`consumeUse` checks and increments in one UPDATE, so concurrent customers cannot pass the limit. The comment says why."]
    ] } }
  ] };
  S[16] = { blocks: [
    { list: [
      "We said the purpose and the three promises before reading code, then checked each promise one by one.",
      "We left the diff to read checkout's status rule, `db.ts`, and the payment gateway, because the new lines only make sense against them.",
      "We tested an AI's comment (\u201cconcurrent uses cannot exceed the limit\u201d) and found it true. Then we asked a question it did not cover: the same customer, twice.",
      "We traced concrete values (9 of 10 used, a retry, an Invalid Date, a 0-yen charge) instead of stopping at \u201clooks right\u201d.",
      "We split each external question into what our code decides (fact) and what the payment service decides (a question).",
      "We said \u201cfine here\u201d only where we could point to the line that makes it fine."
    ] }
  ] };
  D.files = {
    "src/server.ts": { lang: "ts", lines: [
      "import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';",
      "import type { App } from './app';",
      "import { handleApplyCoupon } from './handlers/applyCoupon';",
      "import { handleCheckout } from './handlers/checkout';",
      "",
      "async function readJson(req: IncomingMessage): Promise<unknown> {",
      "  let body = '';",
      "  for await (const chunk of req) body += chunk;",
      "  return body ? JSON.parse(body) : {};",
      "}",
      "",
      "function send(res: ServerResponse, status: number, data: unknown): void {",
      "  res.writeHead(status, { 'content-type': 'application/json' });",
      "  res.end(JSON.stringify(data));",
      "}",
      "",
      "export function startServer(app: App, port: number) {",
      "  return createServer(async (req, res) => {",
      "    const url = new URL(req.url ?? '/', 'http://localhost');",
      "    const m = url.pathname.match(/^\\/orders\\/([^/]+)\\/(checkout|coupon)$/);",
      "    try {",
      "      if (req.method === 'POST' && m && m[2] === 'checkout') {",
      "        const r = await handleCheckout(app, m[1]);",
      "        return send(res, r.status, r.body);",
      "      }",
      "      if (req.method === 'POST' && m && m[2] === 'coupon') {",
      "        const r = handleApplyCoupon(app, m[1], await readJson(req));",
      "        return send(res, r.status, r.body);",
      "      }",
      "      send(res, 404, { error: 'not_found' });",
      "    } catch (err) {",
      "      send(res, 500, { error: 'internal' });",
      "    }",
      "  }).listen(port);",
      "}"
    ] },
    "src/server.ts@base": { lang: "ts", lines: [
      "import { createServer, type ServerResponse } from 'node:http';",
      "import type { App } from './app';",
      "import { handleCheckout } from './handlers/checkout';",
      "",
      "function send(res: ServerResponse, status: number, data: unknown): void {",
      "  res.writeHead(status, { 'content-type': 'application/json' });",
      "  res.end(JSON.stringify(data));",
      "}",
      "",
      "export function startServer(app: App, port: number) {",
      "  return createServer(async (req, res) => {",
      "    const url = new URL(req.url ?? '/', 'http://localhost');",
      "    const m = url.pathname.match(/^\\/orders\\/([^/]+)\\/checkout$/);",
      "    try {",
      "      if (req.method === 'POST' && m) {",
      "        const r = await handleCheckout(app, m[1]);",
      "        return send(res, r.status, r.body);",
      "      }",
      "      send(res, 404, { error: 'not_found' });",
      "    } catch (err) {",
      "      send(res, 500, { error: 'internal' });",
      "    }",
      "  }).listen(port);",
      "}"
    ] },
    "src/handlers/applyCoupon.ts": { lang: "ts", lines: [
      "import type { App } from '../app';",
      "import { CouponExpiredError, CouponNotFoundError, CouponUsedUpError } from '../coupons/coupon';",
      "import { InvalidOrderStateError, OrderNotFoundError } from '../orders/order';",
      "",
      "type Result = { status: number; body: unknown };",
      "",
      "export function handleApplyCoupon(app: App, orderId: string, body: unknown): Result {",
      "  const code = (body as { code?: unknown }).code;",
      "  if (typeof code !== 'string' || code === '') return { status: 400, body: { error: 'code_required' } };",
      "  try {",
      "    const order = app.coupons.apply(orderId, code);",
      "    return { status: 200, body: { orderId: order.id, discountAmount: order.discountAmount } };",
      "  } catch (err) {",
      "    if (err instanceof OrderNotFoundError) return { status: 404, body: { error: 'order_not_found' } };",
      "    if (err instanceof CouponNotFoundError) return { status: 404, body: { error: 'coupon_not_found' } };",
      "    if (err instanceof CouponExpiredError) return { status: 410, body: { error: 'coupon_expired' } };",
      "    if (err instanceof CouponUsedUpError) return { status: 409, body: { error: 'coupon_used_up' } };",
      "    if (err instanceof InvalidOrderStateError) return { status: 409, body: { error: 'invalid_order_state' } };",
      "    throw err;",
      "  }",
      "}"
    ] },
    "src/payment/httpGateway.ts": { lang: "ts", lines: [
      "import { PaymentDeclinedError, type Charge, type ChargeRequest, type PaymentGateway } from './paymentGateway';",
      "",
      "export class HttpPaymentGateway implements PaymentGateway {",
      "  readonly #baseUrl: string;",
      "  readonly #apiKey: string;",
      "",
      "  constructor(baseUrl: string, apiKey: string) {",
      "    this.#baseUrl = baseUrl;",
      "    this.#apiKey = apiKey;",
      "  }",
      "",
      "  /** Used by reconcilePendingPayments. Looks a charge up by its idempotency key. */",
      "  async findCharge(idempotencyKey: string): Promise<Charge | null> {",
      "    const res = await fetch(`${this.#baseUrl}/charges?key=${encodeURIComponent(idempotencyKey)}`, {",
      "      headers: { authorization: `Bearer ${this.#apiKey}` },",
      "    });",
      "    if (res.status === 404) return null;",
      "    if (!res.ok) throw new Error(`payment service answered ${res.status}`);",
      "    return (await res.json()) as Charge;",
      "  }",
      "",
      "  async charge(req: ChargeRequest): Promise<void> {",
      "    const res = await fetch(`${this.#baseUrl}/charges`, {",
      "      method: 'POST',",
      "      headers: {",
      "        'content-type': 'application/json',",
      "        authorization: `Bearer ${this.#apiKey}`,",
      "        'idempotency-key': req.idempotencyKey,",
      "      },",
      "      body: JSON.stringify({ amount: req.amount, reference: req.orderId }),",
      "    });",
      "    if (res.ok) return;",
      "",
      "    // 402 is a declined card. Anything else is our problem or theirs.",
      "    if (res.status === 402) throw new PaymentDeclinedError(req.orderId);",
      "    throw new Error(`payment service answered ${res.status}`);",
      "  }",
      "}"
    ] },
    "src/jobs/reconcilePendingPayments.ts": { lang: "ts", lines: [
      "import type { OrderRepository } from '../orders/orderRepository';",
      "import type { PaymentGateway } from '../payment/paymentGateway';",
      "",
      "const STALE_AFTER_MS = 10 * 60 * 1000;",
      "",
      "/**",
      " * Runs every 5 minutes. Settles orders stuck in PENDING_PAYMENT, for",
      " * example after the process died during a charge.",
      " */",
      "export async function reconcilePendingPayments(orders: OrderRepository, payments: PaymentGateway, now = new Date()): Promise<void> {",
      "  for (const order of orders.findByStatus('PENDING_PAYMENT')) {",
      "    if (now.getTime() - order.updatedAt.getTime() < STALE_AFTER_MS) continue;",
      "    const charge = await payments.findCharge(`order-${order.id}`);",
      "    order.status = charge ? 'PAID' : 'PAYMENT_FAILED';",
      "    order.updatedAt = now;",
      "    orders.save(order);",
      "  }",
      "}"
    ] }
  };
  window.DT_MORE = D;
})();
