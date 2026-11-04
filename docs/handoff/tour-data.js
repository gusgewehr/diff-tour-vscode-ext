window.DT = (function () {
  var tour = {
    title: "Coupons at checkout: what a single UPDATE protects, and what it doesn't",
    base: "main", head: "feature/coupons",
    questions: [6, 9],
    chapters: [
      { title: "The change under review", steps: ["Two commits, one new feature"] },
      { title: "What is this change for?", steps: ["Say the purpose before reading a single line"] },
      { title: "The map", steps: ["Which files need thought, and which are mechanical", "How a request flows, including code that did not change"] },
      { title: "How it works", steps: ["The rule apply() borrows from checkout", "Two customers, one use left", "Answer: no. The limit is checked inside the UPDATE", "One line at checkout, and why the compiler found every caller"] },
      { title: "Where a senior stops", steps: ["The customer taps Apply twice", "Answer: 2, and SPRING loses a use for good", "A fix, and what it still does not cover", "What does expires_at actually hold?", "Two questions the repository cannot answer alone", "Looks risky, but fine here, plus the short list"] },
      { title: "Wrap-up", steps: ["Did this change make the codebase better?", "What you just practiced"] }
    ]
  };

  var roles = [
    { file: "src/coupons/couponService.ts", role: "core", note: "apply(): every rule lives here" },
    { file: "src/coupons/sqliteCouponRepository.ts", role: "core", note: "the use-limit UPDATE" },
    { file: "db/migrations/002_add_coupons.sql", role: "core", note: "new table + 2 order columns" },
    { file: "src/orders/orderService.ts", role: "core", note: "one line: the charged amount" },
    { file: "src/handlers/applyCoupon.ts", role: "core", note: "HTTP mapping of the new errors" },
    { file: "src/server.ts", role: "core", note: "new route + body parsing" },
    { file: "src/coupons/coupon.ts", role: "mechanical", note: "type and error classes" },
    { file: "src/orders/order.ts", role: "mechanical", note: "two new fields" },
    { file: "src/orders/sqliteOrderRepository.ts", role: "mechanical", note: "maps the two new columns" },
    { file: "src/app.ts", role: "mechanical", note: "wiring" },
    { file: "test/couponService.test.ts", role: "test" },
    { file: "test/orderService.test.ts", role: "test", note: "1 new test + discountAmount: 0" },
    { file: "test/reconcilePendingPayments.test.ts", role: "test", note: "only adds discountAmount: 0" },
    { file: "test/sqliteOrderRepository.test.ts", role: "test", note: "only adds discountAmount: 0" }
  ];

  var visits = {
    "src/coupons/couponService.ts": [5, 11, 12],
    "src/coupons/sqliteCouponRepository.ts": [7, 12],
    "db/migrations/002_add_coupons.sql": [8],
    "src/orders/orderService.ts": [5, 8],
    "src/orders/order.ts": [8]
  };

  var added = ["src/coupons/couponService.ts", "src/coupons/sqliteCouponRepository.ts", "db/migrations/002_add_coupons.sql", "src/handlers/applyCoupon.ts", "src/coupons/coupon.ts", "test/couponService.test.ts"];

  var steps = {
    4: {
      asks: ["Why does reconcile not need to know about discounts?"],
      blocks: [
        { flow: { nodes: [
          { label: "POST /orders/:id/coupon", kind: "changed", note: "server.ts readJson", next: "orderId, body", start: true },
          { label: "handleApplyCoupon", kind: "new", note: "handlers/applyCoupon.ts", next: "orderId, code" },
          { label: "CouponService.apply", kind: "new", note: "status check, expiry, consumeUse" },
          { label: "coupons / orders tables", kind: "external", note: "SQLite, synchronous driver" },
          { label: "POST /orders/:id/checkout", kind: "same", note: "server.ts", start: true },
          { label: "OrderService.checkout", kind: "changed", note: "charges total - discount", next: "amount, idempotency key" },
          { label: "Payment service", kind: "external" },
          { label: "reconcilePendingPayments (every 5 min)", kind: "same", note: "looks up charges by key only", start: true }
        ] } },
        { p: "The two paths meet only through the `orders` row. `apply` writes `coupon_code` and `discount_amount`. Later, `checkout` reads them. The reconcile batch looks up charges by idempotency key and never reads the amount, so it needs no change.", basis: "fact" }
      ]
    },
    7: {
      asks: ["Is a single UPDATE always atomic, in any database?", "Why not check usedCount in apply() as well?"],
      blocks: [
        { code: { file: "src/coupons/sqliteCouponRepository.ts", lines: [37, 39], show: [31, 40], marks: [{ line: 37, text: "check and increment in one statement" }, { line: 39, text: "0 rows changed means the limit was reached" }] } },
        { p: "The `usedCount` read on line 25 is never compared to anything. The limit lives in the `WHERE used_count < max_uses` clause. The test `rejects a coupon that has reached its use limit` checks that the second apply fails and `usedCount` stays 1.", basis: "fact" },
        { timeline: { lanes: ["Customer A", "Customer B", "coupons row"], events: [
          { lane: "Customer A", to: "coupons row", text: "UPDATE ... WHERE used_count < max_uses" },
          { lane: "coupons row", text: "9 → 10, changes = 1", mark: "ok" },
          { lane: "Customer B", to: "coupons row", text: "same UPDATE" },
          { lane: "coupons row", text: "10 < 10 is false, changes = 0", mark: "ok" },
          { lane: "Customer B", text: "CouponUsedUpError → 409", mark: "note" }
        ] } },
        { p: "Compare the design it did not choose: read `usedCount`, compare in JavaScript, then `UPDATE used_count = ?`. That opens a gap between the check and the write for a second request to slip in. The conditional UPDATE has no gap, so it would stay correct even with several app processes on one database.", basis: "inferred" },
        { p: "The comment on `consumeUse` claims exactly this, and the claim holds. Checking an AI's comment and finding it true is a fine result too. This pattern has a name: a **conditional update** (an atomic check-and-set).", basis: "fact" }
      ]
    },
    8: {
      blocks: [
        { code: { file: "src/orders/orderService.ts", lines: [45, 45], show: [43, 49], diff: { line: 45 }, marks: [{ line: 45, text: "the only behavior change in checkout" }] } },
        { code: { file: "src/orders/order.ts", lines: [10, 12], show: [3, 14], marks: [{ line: 12, text: "required, not optional" }] } },
        { p: "`discountAmount` is a required number, not `discountAmount?: number`. If it were optional, `total - undefined` would be `NaN` and would go silently to the payment service. Because it is required, the type checker flagged every place that builds an `Order`. That is why the three old test files changed.", basis: "inferred" },
        { code: { file: "db/migrations/002_add_coupons.sql", lines: [9, 10] } },
        { schema: {
          caption: "after 002_add_coupons.sql, applied to an in-memory SQLite",
          tables: [
            { name: "orders", tag: "2 new columns", isNew: false, cols: [
              { name: "id", type: "TEXT", flag: "PK" },
              { name: "status", type: "TEXT", flag: "NOT NULL" },
              { name: "total_amount", type: "INTEGER", flag: "CHECK ≥ 0" },
              { name: "created_at", type: "TEXT", flag: "" },
              { name: "coupon_code", type: "TEXT", flag: "FK → coupons.code", added: true },
              { name: "discount_amount", type: "INTEGER", flag: "NOT NULL DEFAULT 0", added: true }
            ] },
            { name: "coupons", tag: "new table", isNew: true, cols: [
              { name: "code", type: "TEXT", flag: "PK" },
              { name: "amount", type: "INTEGER", flag: "CHECK > 0" },
              { name: "max_uses", type: "INTEGER", flag: "CHECK > 0" },
              { name: "used_count", type: "INTEGER", flag: "DEFAULT 0" },
              { name: "expires_at", type: "TEXT", flag: "NOT NULL, no format check" }
            ] }
          ],
          fk: "orders.coupon_code → coupons.code",
          fkNote: "enforced: PRAGMA foreign_keys = ON"
        } },
        { p: "`NOT NULL DEFAULT 0` lets existing rows read back as \u201cno discount\u201d. The `REFERENCES coupons (code)` really is enforced, because `openDatabase` turns on `PRAGMA foreign_keys` on every connection (`src/db.ts:10`).", basis: "fact" },
        { p: "In one sentence: apply() stores a discount only on a cart that is not being charged, consumes a use with no race between check and write, and checkout charges exactly what was stored.", basis: "inferred" }
      ]
    },
    11: {
      asks: ["Should switching coupons be allowed at all?", "How would you wrap two repository calls in one transaction here?"],
      blocks: [
        { snippet: { label: "Not in this repository: a possible guard in apply(), before consumeUse", lang: "typescript", text: "if (order.couponCode === code) return order; // retry: no second use\nif (order.couponCode) {\n  throw new CouponAlreadyAppliedError(order.couponCode); // \u2192 409\n}" } },
        { p: "Trace it with values. Retry of `WELCOME` on `o1`: `couponCode === 'WELCOME'` returns early, and `used_count` stays 1. Switch to `SPRING`: rejected, so `SPRING` stays at 0. Retry after a declined card (PAYMENT_FAILED): returns early, and no extra use is consumed.", basis: "inferred" },
        { p: "Two retries arriving together are also covered today. The repositories use the synchronous `DatabaseSync`, and `apply()` never waits on real I/O. So once the body is read, one `apply()` runs to the end before another request's handler continues.", basis: "inferred" },
        { p: "It is not covered once there are several app processes. Then both could read `couponCode` as empty. A full fix also puts `consumeUse` and the order save in one transaction, with `UPDATE orders ... WHERE coupon_code IS NULL`. The transaction also closes a smaller gap. Today, if the save on line 33 throws, the use is already gone.", basis: "inferred" },
        { p: "If the product wants switching, the same transaction must give the old code's use back. That is a product decision. The code should not decide it silently.", basis: "opinion" }
      ]
    }
  };

  var files = {
    "src/coupons/sqliteCouponRepository.ts": { lang: "ts", lines: [
      "import type { DatabaseSync } from 'node:sqlite';",
      "import { CouponUsedUpError, type Coupon } from './coupon';",
      "",
      "type CouponRow = {",
      "  code: string;",
      "  amount: number;",
      "  max_uses: number;",
      "  used_count: number;",
      "  expires_at: string;",
      "};",
      "",
      "export class SqliteCouponRepository {",
      "  readonly #db: DatabaseSync;",
      "",
      "  constructor(db: DatabaseSync) {",
      "    this.#db = db;",
      "  }",
      "",
      "  get(code: string): Coupon | undefined {",
      "    const row = this.#db.prepare('SELECT * FROM coupons WHERE code = ?').get(code) as CouponRow;",
      "    if (!row) return undefined;",
      "    return {",
      "      code: row.code,",
      "      amount: row.amount,",
      "      maxUses: row.max_uses,",
      "      usedCount: row.used_count,",
      "      expiresAt: new Date(row.expires_at),",
      "    };",
      "  }",
      "",
      "  /**",
      "   * Consumes one use. The limit is checked in the same statement,",
      "   * so concurrent uses cannot exceed max_uses.",
      "   */",
      "  consumeUse(code: string): void {",
      "    const result = this.#db.prepare(",
      "      'UPDATE coupons SET used_count = used_count + 1 WHERE code = ? AND used_count < max_uses',",
      "    ).run(code);",
      "    if (result.changes === 0) throw new CouponUsedUpError(code);",
      "  }",
      "}"
    ] },
    "src/coupons/couponService.ts": { lang: "ts", lines: [
      "import type { Order } from '../orders/order';",
      "import { InvalidOrderStateError, OrderNotFoundError } from '../orders/order';",
      "import type { OrderRepository } from '../orders/orderRepository';",
      "import { CouponExpiredError, CouponNotFoundError } from './coupon';",
      "import type { SqliteCouponRepository } from './sqliteCouponRepository';",
      "",
      "export class CouponService {",
      "  readonly #coupons: SqliteCouponRepository;",
      "  readonly #orders: OrderRepository;",
      "  readonly #now: () => Date;",
      "",
      "  constructor(coupons: SqliteCouponRepository, orders: OrderRepository, now = () => new Date()) {",
      "    this.#coupons = coupons;",
      "    this.#orders = orders;",
      "    this.#now = now;",
      "  }",
      "",
      "  apply(orderId: string, code: string): Order {",
      "    const order = this.#orders.get(orderId);",
      "    if (!order) throw new OrderNotFoundError(orderId);",
      "    if (order.status !== 'CART' && order.status !== 'PAYMENT_FAILED') {",
      "      throw new InvalidOrderStateError(order.id, order.status);",
      "    }",
      "",
      "    const coupon = this.#coupons.get(code);",
      "    if (!coupon) throw new CouponNotFoundError(code);",
      "    if (coupon.expiresAt <= this.#now()) throw new CouponExpiredError(code);",
      "    this.#coupons.consumeUse(code);",
      "",
      "    order.couponCode = code;",
      "    // never charge below zero",
      "    order.discountAmount = Math.min(coupon.amount, order.totalAmount);",
      "    this.#orders.save(order);",
      "    return order;",
      "  }",
      "}"
    ] },
    "src/orders/orderService.ts": { lang: "ts", lines: [
      "import { InvalidOrderStateError, OrderNotFoundError, type Order } from './order';",
      "import type { OrderRepository } from './orderRepository';",
      "import { PaymentDeclinedError, type PaymentGateway } from '../payment/paymentGateway';",
      "",
      "export class OrderService {",
      "  readonly #orders: OrderRepository;",
      "  readonly #payments: PaymentGateway;",
      "",
      "  constructor(orders: OrderRepository, payments: PaymentGateway) {",
      "    this.#orders = orders;",
      "    this.#payments = payments;",
      "  }",
      "",
      "  get(orderId: string): Order {",
      "    const order = this.#orders.get(orderId);",
      "    if (!order) throw new OrderNotFoundError(orderId);",
      "    return order;",
      "  }",
      "",
      "  /**",
      "   * Charges the order once. The status is saved as PENDING_PAYMENT",
      "   * before calling the payment service, so a second checkout of the",
      "   * same order is rejected while the first one is in flight.",
      "   *",
      "   * The idempotency key comes from the order id, so a retry after a",
      "   * timeout cannot create a second charge.",
      "   */",
      "  async checkout(orderId: string): Promise<Order> {",
      "    const order = this.get(orderId);",
      "",
      "    // A cart can be checked out. So can an order whose last payment",
      "    // was declined, so the customer can try another card.",
      "    if (order.status !== 'CART' && order.status !== 'PAYMENT_FAILED') {",
      "      throw new InvalidOrderStateError(order.id, order.status);",
      "    }",
      "",
      "    // Saved first: if the process dies during the charge,",
      "    // reconcilePendingPayments finds this order and settles it.",
      "    order.status = 'PENDING_PAYMENT';",
      "    this.#orders.save(order);",
      "",
      "    try {",
      "      await this.#payments.charge({",
      "        orderId: order.id,",
      "        amount: order.totalAmount - order.discountAmount,",
      "        idempotencyKey: `order-${order.id}`,",
      "      });",
      "      order.status = 'PAID';",
      "    } catch (err) {",
      "      if (!(err instanceof PaymentDeclinedError)) throw err;",
      "      order.status = 'PAYMENT_FAILED';",
      "    }",
      "    this.#orders.save(order);",
      "    return order;",
      "  }",
      "}"
    ] },
    "src/orders/order.ts": { lang: "ts", added: [10, 11, 12], lines: [
      "export type OrderStatus = 'CART' | 'PENDING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED';",
      "",
      "export type Order = {",
      "  id: string;",
      "  status: OrderStatus;",
      "  /** Yen, before any discount. */",
      "  totalAmount: number;",
      "  createdAt: Date;",
      "  updatedAt: Date;",
      "  /** Set by CouponService.apply(). */",
      "  couponCode: string | null;",
      "  discountAmount: number;",
      "};",
      "",
      "export class OrderNotFoundError extends Error {",
      "  constructor(readonly orderId: string) {",
      "    super(`order ${orderId} not found`);",
      "  }",
      "}"
    ] },
    "db/migrations/002_add_coupons.sql": { lang: "sql", lines: [
      "CREATE TABLE coupons (",
      "  code        TEXT PRIMARY KEY,",
      "  amount      INTEGER NOT NULL CHECK (amount > 0),",
      "  max_uses    INTEGER NOT NULL CHECK (max_uses > 0),",
      "  used_count  INTEGER NOT NULL DEFAULT 0,",
      "  expires_at  TEXT NOT NULL",
      ");",
      "",
      "ALTER TABLE orders ADD COLUMN coupon_code TEXT REFERENCES coupons (code);",
      "ALTER TABLE orders ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0;"
    ] },
    "src/db.ts": { lang: "ts", lines: [
      "import { DatabaseSync } from 'node:sqlite';",
      "import { readdirSync, readFileSync } from 'node:fs';",
      "import { join } from 'node:path';",
      "",
      "const MIGRATIONS = join(import.meta.dirname, '..', 'db', 'migrations');",
      "",
      "export function openDatabase(path: string): DatabaseSync {",
      "  const db = new DatabaseSync(path);",
      "  // SQLite leaves foreign keys off unless each connection turns them on.",
      "  db.exec('PRAGMA foreign_keys = ON');",
      "  migrate(db);",
      "  return db;",
      "}",
      "",
      "function migrate(db: DatabaseSync): void {",
      "  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)');",
      "  for (const name of readdirSync(MIGRATIONS).sort()) {",
      "    if (db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(name)) continue;",
      "    db.exec('BEGIN');",
      "    db.exec(readFileSync(join(MIGRATIONS, name), 'utf8'));",
      "    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(name);",
      "    db.exec('COMMIT');",
      "  }",
      "}"
    ] }
  };
  var base = files["src/orders/orderService.ts"].lines.slice();
  base[44] = "        amount: order.totalAmount,";
  files["src/orders/orderService.ts@base"] = { lang: "ts", lines: base };

  return { tour: tour, roles: roles, visits: visits, added: added, steps: steps, files: files };
})();
