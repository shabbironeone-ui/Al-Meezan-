/* Al Meezan ERP - single place for settings. Change keys here only. */
window.ERP_CONFIG = {
  APP_NAME: "Al Meezan ERP",
  SUPABASE_URL: "https://ofplfqawiupcmqvzkhfp.supabase.co",
  SUPABASE_KEY: "sb_publishable_8VV3n9Dr_XXgDnkuonMTqg_Hkfm59z_", // publishable key: safe in browser ONLY with RLS policies
  PAGE_SIZE: 1000,        // Supabase returns max 1000 rows per request
  AUTH_REQUIRED: false    // login phase: set true once Supabase Auth + roles are added
};
