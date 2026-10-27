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

  return {
    session, signIn, signOut, changePassword, sendPasswordReset, guard, can, pageKey,
    pages: PAGES.map(([file, key, label]) => ({ file, key, label })),
    actions: ACTIONS.slice(),
    roles: Object.keys(ROLE_RULES),
    roleRules: ROLE_RULES,
    get profile() { return profile; }
  };
})();
