/* Login / roles: ERP.auth. Load AFTER db.js. Roles: admin, accountant, cro, viewer. */
window.ERP = window.ERP || {};
ERP.auth = (function () {
  const sb = () => ERP.db.sb;
  let profile = null;

  async function session() { return (await sb().auth.getSession()).data.session; }

  async function signIn(email, password) {
    const { data, error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(/invalid login/i.test(error.message) ? "Email or password is wrong" : error.message);
    return data;
  }

  const toLogin = () => (self !== top ? top : window).location.replace("login.html");   // never show the login page inside the frame
  async function signOut() { await sb().auth.signOut(); toLogin(); }

  /* Call at the top of any protected page. Redirects to login.html when not signed in. */
  async function guard() {
    /* a page opened directly (not inside the menu shell) is sent into the shell, so Home and the menu are always there */
    const file = location.pathname.split("/").pop();
    if (self === top && file && file !== "index.html" && file !== "login.html") { location.replace("index.html#" + file + location.search); return new Promise(() => {}); }
    if (ERP_CONFIG.OPEN_ACCESS === true) return { full_name: "", role: "admin", open: true };   // only if the database lock (sql/99) was removed
    const s = await session();
    if (!s) { toLogin(); return new Promise(() => {}); }
    const { data } = await sb().from("profiles").select("full_name, role").eq("id", s.user.id).maybeSingle();
    if (!data || !data.role) {
      alert("Your account has no role yet. Ask the admin to give you access.");
      await signOut(); return new Promise(() => {});
    }
    profile = { ...data, email: s.user.email };
    sb().auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") toLogin(); });
    return profile;
  }

  /* Simple permission check for buttons: ERP.auth.can("delete") */
  const RULES = { admin: ["read", "write", "edit", "delete"], accountant: ["read", "write", "edit"], cro: ["read", "write"], viewer: ["read"] };
  const can = action => ERP_CONFIG.OPEN_ACCESS === true || !!(profile && (RULES[profile.role] || []).includes(action));

  return { session, signIn, signOut, guard, can, get profile() { return profile; } };
})();
