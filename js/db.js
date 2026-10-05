/* Shared data layer: ERP.db. Load AFTER supabase-js, config.js, ui.js. One client for the whole app. */
window.ERP = window.ERP || {};
ERP.db = (function () {
  const C = window.ERP_CONFIG;
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);

  const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

  /* Reads ALL rows page by page (fixes the silent 1000-row limit). `build` may add filters; ALWAYS pass a stable `order`. */
  async function fetchAll(table, { select = "*", order, ascending = true, build } = {}) {
    const size = C.PAGE_SIZE; let from = 0, out = [];
    for (;;) {
      let q = sb.from(table).select(select);
      if (build) q = build(q);
      if (order) q = q.order(order, { ascending });
      const rows = must(await q.range(from, from + size - 1));
      out = out.concat(rows);
      if (rows.length < size) return out;
      from += size;
    }
  }

  /* Real DB column names, taken from your schema export. */
  const SOWDOWO = "S/O D/O W/O";
  const VOUCHER_TABLE = { expense: "expenses", payment: "payments", contra: "contra", general_receipt: "general_receipts" };
  const BACKUP_TABLES = { customers: "account_no", receipts: "id", sales: "id", stock_ledger: "id", product_master: "product_id",
    purchase_detail: "id", expenses: "id", payments: "id", contra: "id", general_receipts: "id", app_settings: "id" };

  return {
    sb, fetchAll, must,

    async settings() {
      const rows = await fetchAll("app_settings", { build: q => q.eq("is_active", true), order: "sort_order" });
      const by = c => rows.filter(r => r.category === c);
      return { rows, by, names: c => by(c).map(r => r.display_name) };
    },

    customers: {
      list: () => fetchAll("customers", { order: "account_no" }),
      async get(accNo) {
        return must(await sb.from("customers").select("*").eq("account_no", String(accNo).trim()).maybeSingle());
      },
      async save(c) {
        const row = { ...c }; if ("sowdowo" in row) { row[SOWDOWO] = row.sowdowo; delete row.sowdowo; }
        return must(await sb.from("customers").upsert(row, { onConflict: "account_no" }).select());
      },
      /* Uses the DB sequence from 01_foundation.sql (no duplicates). */
      async nextAccountNo() { return must(await sb.rpc("next_customer_account_no")); },
      balances: () => fetchAll("v_customer_balance", { order: "account_no" }),
      sowdowoOf: c => c[SOWDOWO]
    },

    receipts: {
      list: ({ from, to, accNo } = {}) => fetchAll("receipts", { order: "date", ascending: false, build: q => {
        if (from) q = q.gte("date", from); if (to) q = q.lte("date", to); if (accNo) q = q.eq("account_no", String(accNo).trim()); return q; } }),
      async add(rows) { return must(await sb.from("receipts").insert(rows).select()); },
      async remove(ids) { must(await sb.from("receipts").delete().in("id", ids)); }
    },

    products: {
      list: () => fetchAll("product_master", { order: "product_id" }),
      async save(p) { return must(await sb.from("product_master").upsert(p, { onConflict: "product_id" }).select()); }
    },

    purchases: {
      /* NOTE: real column is po_num (the old erp-backend.js wrongly used purchase_id). */
      list: ({ supplier } = {}) => fetchAll("purchase_detail", { order: "purchase_date", ascending: false,
        build: q => supplier && supplier !== "All" ? q.eq("supplier", supplier) : q }),
      /* head: {purchase_date, supplier, po_num?}  items: [{product_id, company_name, ..., qty, cost_price, line_total}] */
      async save(head, items) { return must(await sb.rpc("save_purchase", { p_head: head, p_items: items })); }
    },

    sales: {
      list: ({ accNo } = {}) => fetchAll("sales", { order: "date", ascending: false, build: q => accNo ? q.eq("account_no", String(accNo).trim()) : q }),
      /* sale: {date, approved_by, account_no, account_title, next_inst_month, remarks}  items: [{product_id, qty, sales_amt, ...}]
         Saves sale rows AND stock-out together, or neither. (sales table has no 'cro' column.) */
      async save(sale, items) { return must(await sb.rpc("save_sale", { p_sale: sale, p_items: items })); }
    },

    stock: { balance: () => fetchAll("v_stock_balance", { order: "product_id" }) },

    async monthly(n = 6) { return must(await sb.from("v_monthly_summary").select("*").order("m", { ascending: false }).limit(n)); },
    async kpis() { return must(await sb.from("v_dashboard_kpis").select("*").single()); },

    vouchers: {
      async save(type, rows) {
        const t = VOUCHER_TABLE[type]; if (!t) throw new Error("Unknown voucher type: " + type);
        return must(await sb.from(t).insert(rows).select());
      },
      list: (type, date) => fetchAll(VOUCHER_TABLE[type], { order: "id", build: q => date ? q.eq("date", date) : q })
    },

    /* One-click full backup (Free plan has no automatic backups). Downloads one CSV per table. */
    async backupAll(onProgress) {
      for (const [t, key] of Object.entries(BACKUP_TABLES)) {
        onProgress && onProgress(t);
        ERP.ui.downloadCSV(`${t}_${ERP.ui.today()}.csv`, await fetchAll(t, { order: key }));
      }
    }
  };
})();
