/* Login / roles: ERP.auth. Load AFTER db.js. Roles: admin, accountant, cro, viewer. */
window.ERP = window.ERP || {};
ERP.auth = (function () {
  const sb = () => ERP.db.sb;
  let profile = null;
  const PAGES = [
    ["receipts.html", "receipts", "Receipts"],
    ["SalesForm.html", "sales", "Sales"],
    ["customer.html", "customers", "Customers"],
    ["LedgerView.html", "ledger", "Customer Ledger"],
    ["Accounts.html", "accounts", "Accounts & Day Book"],
    ["voucher_entry.html", "vouchers", "Voucher Entry"],
    ["ReconciliationView.html", "reconciliation", "Reconciliation"],
    ["Settings.html", "settings", "Settings"],
    ["ProductForm.html", "products", "Products"],
    ["PurchaseForm.html", "purchases", "Purchases"],
    ["StockLedger.html", "stock", "Stock Ledger"],
    ["VenderLedger.html", "vendors", "Vendor Ledger"],
    ["DashboardView.html", "dashboard", "Dashboard"],
    ["BusinessReports.html", "business_reports", "Business Reports"],
    ["recovery.html", "aging", "Recovery"],
    ["AgingReport2.html", "aging_report", "Recovery & Aging"],
    ["cro_report.html", "cro_report", "CRO Report"],
    ["FollowUp.html", "followup", "Customer Follow-up"],
    ["UserAccess.html", "user_access", "User Roles"]
  ];
  const ACTIONS = ["read", "write", "edit", "delete", "export"];
  const FEATURES = {
    receipts: [
      { key: "show_receipt_summary", label: "Receipt summary", description: "Selected-filter receipt count and total amount." }
    ],
    dashboard: [
      { key: "show_financial_summary", label: "Financial overview", description: "Sales, collections, receivables, payables and cash-flow cards." }
    ],
    customers: [
      { key: "show_balance_summary", label: "Customer balance summary", description: "Customer balance totals and summary cards." }
    ],
    ledger: [
      { key: "show_balance_summary", label: "Account balance summary", description: "Customer outstanding balance and account summary cards." },
      { key: "show_installment_plan", label: "Installment plan", description: "View the customer's installment schedule." }
    ],
    sales: [
      { key: "show_installment_plan", label: "Installment schedule", description: "Show the proposed payment schedule while creating a sale." },
      { key: "show_entry_totals", label: "Sale entry totals", description: "Show item, advance, installment and grand-total figures in the entry bar." }
    ],
    purchases: [
      { key: "show_entry_totals", label: "Purchase entry total", description: "Show the purchase quantity and total while entering a purchase." },
      { key: "quick_product_add", label: "Add a product from Purchases", description: "Allow quick product creation from the purchase item picker." }
    ],
    vouchers: [
      { key: "show_entry_totals", label: "Voucher entry totals", description: "Show the number of entries and combined amount before saving." }
    ],
    accounts: [
      { key: "show_totals", label: "Day-book summary totals", description: "Opening, received, paid and closing totals for the selected period." }
    ],
    reconciliation: [
      { key: "show_totals", label: "Account balances and summary totals", description: "Account closing balances and reconciliation summary cards." }
    ],
    products: [
      { key: "show_product_summary", label: "Product and stock summary", description: "Product stock summary cards." },
      { key: "show_cost_prices", label: "Product cost and sale prices", description: "Cost and MRP values in the product list and details." }
    ],
    stock: [
      { key: "show_stock_summary", label: "Stock summary cards", description: "Stock movement and valuation summary cards." },
      { key: "show_detailed_view", label: "Detailed stock view", description: "Detailed stock audit columns and filters." }
    ],
    vendors: [
      { key: "show_balance_summary", label: "Vendor balance summary", description: "Purchase, paid and payable balance summary cards." }
    ],
    settings: [
      { key: "show_settings_summary", label: "Settings summary", description: "Show the total, active and category counts at the top of Settings." }
    ],
    business_reports: [
      { key: "show_profitability", label: "Profit and loss report", description: "Profitability figures and the Profit & Loss report." }
    ],
    aging: [
      { key: "show_balance_summary", label: "Recovery balance summary", description: "Outstanding, overdue and recovery summary totals." }
    ],
    aging_report: [
      { key: "show_balance_summary", label: "Recovery balance summary", description: "Outstanding, overdue and recovery summary totals." }
    ],
    cro_report: [
      { key: "show_balance_columns", label: "Financial columns and report totals", description: "Sale, paid, overdue, balance and monthly collection figures." }
    ],
    followup: [
      { key: "show_collection_summary", label: "Collection summary", description: "Monthly due, received and remaining collection totals." }
    ]
  };
  const ROLE_RULES = {
    admin: ACTIONS,
    accountant: ["read", "write", "edit", "export"],
    cro: ["read", "write"],
    viewer: ["read"]
  };
  const pageByFile = new Map(PAGES.map(([file, key]) => [file.toLowerCase(), key]));

  async function session() { return (await sb().auth.getSession()).data.session; }

  async function signIn(email, password) {
    const { data, error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(/invalid login/i.test(error.message) ? "Email or password is wrong" : error.message);
    return data;
  }

  async function changePassword(password) {
    const { data, error } = await sb().auth.updateUser({ password });
    if (error) throw new Error("Could not change password: " + error.message);
    return data;
  }

  async function sendPasswordReset(email) {
    const redirectTo = new URL("index.html", window.location.href).toString();
    const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error("Could not send password reset email: " + error.message);
  }

  /* Admin tools used by UserAccess.html.
     create_user  : creates a Supabase login with a temporary client, so the admin stays signed in.
     set_password : uses the Supabase Edge Function named below if it is deployed (it can set any
                    user's password). If it is not deployed, a password reset email is sent instead. */
  const ADMIN_FUNCTION = "admin-manage-user";
  async function adminManageUser(payload) {
    const action = payload && payload.action;
    if (action === "create_user") {
      const client = window.supabase.createClient(sb().supabaseUrl, sb().supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      const { data, error } = await client.auth.signUp({
        email: String(payload.email || "").trim(),
        password: payload.password,
        options: { data: { full_name: payload.full_name } }
      });
      if (error) throw new Error(error.message);
      if (!data.user || (data.user.identities && data.user.identities.length === 0)) {
        throw new Error("This email already has an account. Close this window and press Refresh; it will be in the list.");
      }
      return { user: data.user };
    }
    if (action === "set_password") {
      try {
        const { data, error } = await sb().functions.invoke(ADMIN_FUNCTION, { body: payload });
        if (!error && data && !data.error) return data;
      } catch (ignored) { /* function not deployed: fall back below */ }
      if (!payload.email) throw new Error("Could not change the password: this user has no email address.");
      await sendPasswordReset(payload.email);
      return { message: "A password reset link was emailed to " + payload.email + ". The user sets the new password from that email." };
    }
    throw new Error("Unknown admin action: " + action);
  }

  const toLogin = () => (self !== top ? top : window).location.replace("login.html");   // never show the login page inside the frame
  async function signOut() { await sb().auth.signOut(); toLogin(); }

  /* Call at the top of any protected page. Redirects to login.html when not signed in. */
  async function guard() {
    /* a page opened directly (not inside the menu shell) is sent into the shell, so Home and the menu are always there */
    const file = location.pathname.split("/").pop();
    if (self === top && file && file !== "index.html" && file !== "login.html") { location.replace("index.html#" + file + location.search); return new Promise(() => {}); }
    if (ERP_CONFIG.OPEN_ACCESS === true) return { full_name: "", role: "admin", permissions: {}, open: true };   // only if the database lock (sql/99) was removed
    const s = await session();
    if (!s) { toLogin(); return new Promise(() => {}); }
    let result = await sb().from("profiles").select("full_name, role, permissions, cro_name").eq("id", s.user.id).maybeSingle();
    if (result.error && /permissions|column/i.test(result.error.message || "")) {
      result = await sb().from("profiles").select("full_name, role, permissions").eq("id", s.user.id).maybeSingle();
      if (result.error && /permissions|column/i.test(result.error.message || "")) {
        result = await sb().from("profiles").select("full_name, role").eq("id", s.user.id).maybeSingle();
      }
    }
    if (result.error) throw new Error("Could not load your user profile: " + result.error.message);
    const data = result.data;
    if (!data || !data.role) {
      alert("Your account has no role yet. Ask the admin to give you access.");
      await signOut(); return new Promise(() => {});
    }
    profile = { ...data, permissions: data.permissions || {}, email: s.user.email, roleDefinition: null };
    if (!ROLE_RULES[profile.role]) {
      const { data: roleDefinition, error: roleError } = await sb().from("custom_roles")
        .select("role_key, role_name, permissions, cro_scoped")
        .eq("role_key", profile.role)
        .maybeSingle();
      if (roleError) throw new Error("Could not load your custom role: " + roleError.message);
      if (!roleDefinition) {
        await signOut();
        throw new Error("Your assigned role is no longer available. Ask an admin to assign a valid role.");
      }
      profile.roleDefinition = roleDefinition;
    }
    sb().auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") toLogin(); });
    if (!can("export")) {
      document.querySelectorAll("#btnCsv, #btnExport, #bCsv, [onclick*='exportToCSV'], [onclick*='exportToPDF']").forEach(button => { button.hidden = true; });
      document.querySelectorAll("#menu [data-p='backup']").forEach(button => { button.hidden = true; });
    }
    const fileName = location.pathname.split("/").pop().toLowerCase();
    const page = pageByFile.get(fileName);
    if (page && !can("read", page)) {
      alert("You do not have permission to open this page.");
      (self !== top ? top : window).location.replace("index.html");
      return new Promise(() => {});
    }
    applyFeatureVisibility();
    return profile;
  }

  function pageKey(file) {
    return pageByFile.get(String(file || "").split("?")[0].split("/").pop().toLowerCase()) || null;
  }
  function can(action, page) {
    if (ERP_CONFIG.OPEN_ACCESS === true) return true;
    if (!profile) return false;
    const key = page || pageKey(location.pathname);
    if (key === "user_access" && profile.role !== "admin") return false;
    if (profile.role === "admin") return true;
    const base = ROLE_RULES[profile.role];
    if (base) {
      if (!base.includes(action)) return false;
    } else if (!profile.roleDefinition
      || !profile.roleDefinition.permissions
      || !profile.roleDefinition.permissions[key]
      || profile.roleDefinition.permissions[key][action] !== true) {
      return false;
    }
    const override = key && profile.permissions && profile.permissions[key];
    return !(override && override[action] === false);
  }

  function canFeature(feature, page) {
    if (ERP_CONFIG.OPEN_ACCESS === true) return true;
    const key = page || pageKey(location.pathname);
    if (!profile || !FEATURES[key] || !FEATURES[key].some(item => item.key === feature)) return false;
    if (profile.role === "admin") return true;

    const rolePermissions = profile.roleDefinition && profile.roleDefinition.permissions;
    const canRead = can("read", key);
    if (!canRead) return false;
    if (rolePermissions && rolePermissions[key] && rolePermissions[key][feature] === false) return false;

    const override = profile.permissions && profile.permissions[key];
    return !(override && override[feature] === false);
  }

  function applyFeatureVisibility(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-feature]").forEach(element => {
      const feature = element.dataset.feature;
      const page = element.dataset.featurePage || pageKey(location.pathname);
      const visible = canFeature(feature, page);
      if (!visible) {
        element.hidden = true;
        element.style.display = "none";
      }
    });
  }

  return {
    session, signIn, signOut, changePassword, sendPasswordReset, adminManageUser, guard, can, canFeature, applyFeatureVisibility, pageKey,
    pages: PAGES.map(([file, key, label]) => ({ file, key, label })),
    features: JSON.parse(JSON.stringify(FEATURES)),
    actions: ACTIONS.slice(),
    roles: Object.keys(ROLE_RULES),
    roleRules: ROLE_RULES,
    get profile() { return profile; }
  };
})();
