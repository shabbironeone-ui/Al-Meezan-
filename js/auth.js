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

  async function signOut() { await sb().auth.signOut(); location.replace("login.html"); }

  /* Call at the top of any protected page. Redirects to login.html when not signed in. */
  async function guard() {
    if (!ERP_CONFIG.AUTH_REQUIRED) return { full_name: "", role: "admin", open: true };
    const s = await session();
    if (!s) { location.replace("login.html"); return new Promise(() => {}); }
    const { data } = await sb().from("profiles").select("full_name, role").eq("id", s.user.id).maybeSingle();
    if (!data || !data.role) {
      alert("Your account has no role yet. Ask the admin to give you access.");
      await signOut(); return new Promise(() => {});
    }
    profile = { ...data, email: s.user.email };
    sb().auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") location.replace("login.html"); });
    return profile;
  }

  /* Simple permission check for buttons: ERP.auth.can("delete") */
  const RULES = { admin: ["read", "write", "edit", "delete"], accountant: ["read", "write", "edit"], cro: ["read", "write"], viewer: ["read"] };
  const can = action => !ERP_CONFIG.AUTH_REQUIRED || !!(profile && (RULES[profile.role] || []).includes(action));

  return { session, signIn, signOut, guard, can, get profile() { return profile; } };
})();
