/* Al Meezan ERP - single place for settings. Change keys here only. */
window.ERP_CONFIG = {
  APP_NAME: "Al Meezan ERP",
  SUPABASE_URL: "https://ofplfqawiupcmqvzkhfp.supabase.co",
  SUPABASE_KEY: "sb_publishable_8VV3n9Dr_XXgDnkuonMTqg_Hkfm59z_", // publishable key: safe in browser ONLY with RLS policies
  /* Accounts money moves through. Used by Receipts, Vouchers and Transfer. Edit the names here only. */
  PAY_MODES: {
    cash: ["Cash", "Head Office Cash", "Collection Cash"],
    bank: ["Bank Transfer", "Online Meezan", "Cheque", "Allied Bank (1870014)"]
  },
  SPECIAL_RECEIPT_NOS: ["Advance", "Processing Fee", "1st Installment"],  // receipt numbers that may repeat (old data)
  QUICK_RECEIPT_TAGS: ["Advance", "Processing Fee", "1st Installment"],  // quick buttons on the Receipts page
  PAGE_SIZE: 1000,        // Supabase returns max 1000 rows per request
  OPEN_ACCESS: true       // true = NO login (development, with sql/10_unlock_for_now.sql). Before going live: run sql/11_lock_again.sql and set this to false.
};
