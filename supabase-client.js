/**
 * AL MEEZAN ERP - CORE SUPABASE SDK & API CLIENT
 * Connects all 16 Frontend HTML Pages directly to Supabase PostgreSQL
 */

const SUPABASE_URL = localStorage.getItem('erp_supabase_url') || "https://ofplfqawiupcmqvzkhfp.supabase.co";
const SUPABASE_ANON_KEY = localStorage.getItem('erp_supabase_key') || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mcGxmcWF3aXVwY21xdnpraGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NzA5MjAsImV4cCI6MjEwMzE0NjkyMH0.DP6_HPAoDhexUwiavzbmrXNfh3BOD27P4rsUcSKkQdU";

// Initialize Supabase Client
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/**
 * 1. SETTINGS & DROPDOWNS API
 */
async function getDropdownsByCategory(category) {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('display_name, lookup_code, contact_person, mobile_no')
      .eq('category', category)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error(`Error loading dropdowns for ${category}:`, err);
    return [];
  }
}

/**
 * 2. CUSTOMER & COA API
 */
async function getNextCustomerAccountNumber() {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('account_no')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    let maxNum = 7860000;
    if (data && data.length > 0) {
      data.forEach(r => {
        let num = parseInt(String(r.account_no).replace(/[^\d]/g, ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      });
    }
    return String(maxNum + 1);
  } catch (err) {
    console.error("Error generating account number:", err);
    return "7860001";
  }
}

async function saveCustomerToSupabase(customerData) {
  try {
    const { data, error } = await supabase
      .from('customers')
      .upsert(customerData, { onConflict: 'account_no' })
      .select();

    if (error) throw error;
    return { success: true, data: data };
  } catch (err) {
    return { success: false, error: err.message || err.toString() };
  }
}

async function getCustomerByAccNo(accNo) {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('account_no', String(accNo).trim())
      .single();

    if (error) throw error;
    return { success: true, data: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 3. SALES API
 */
async function saveSaleToSupabase(saleData, productRows) {
  try {
    // 1. Insert Sales Records
    const records = productRows.map(p => ({
      product_id: p.product_id || null,
      date: saleData.date,
      approved_by: saleData.approved_by,
      account_no: saleData.account_no,
      account_title: saleData.account_title,
      company_name: p.company_name,
      product_category: p.product_category,
      model: p.model,
      color: p.color,
      qty: Number(p.qty) || 1,
      sales_rate: Number(p.sales_rate) || 0,
      sales_amt: Number(p.sales_amt) || 0,
      plan_months: Number(p.plan_months) || 0,
      advance: Number(p.advance) || 0,
      installment_per_month: Number(p.installment_per_month) || 0,
      processing_fee: Number(p.processing_fee) || 0,
      total_amt: Number(p.sales_amt || 0) + Number(p.processing_fee || 0),
      next_inst_month: saleData.next_inst_month || null,
      remarks: p.remarks || saleData.remarks || null
    }));

    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .insert(records)
      .select();

    if (salesError) throw salesError;

    // 2. Insert Stock Out records in stock_ledger
    const stockOutEntries = productRows.filter(p => p.product_id).map(p => ({
      transaction_id: "OUT-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      date: saleData.date,
      product_id: p.product_id,
      company_name: p.company_name,
      product_category: p.product_category,
      model: p.model,
      color: p.color,
      qty_in: 0,
      qty_out: Number(p.qty) || 1,
      reference_type: 'SALE',
      reference_id: saleData.account_no,
      warehouse: 'MAIN WAREHOUSE',
      remarks: 'Sale to Acc: ' + saleData.account_no
    }));

    if (stockOutEntries.length > 0) {
      await supabase.from('stock_ledger').insert(stockOutEntries);
    }

    return { success: true, data: salesData };
  } catch (err) {
    return { success: false, error: err.message || err.toString() };
  }
}

/**
 * 4. RECEIPTS & COLLECTIONS API
 */
async function saveReceiptToSupabase(receiptData) {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .insert([receiptData])
      .select();

    if (error) throw error;
    return { success: true, data: data };
  } catch (err) {
    return { success: false, error: err.message || err.toString() };
  }
}

/**
 * 5. PRODUCT MASTER API
 */
async function saveProductMasterToSupabase(productData) {
  try {
    const { data, error } = await supabase
      .from('product_master')
      .upsert(productData, { onConflict: 'product_id' })
      .select();

    if (error) throw error;
    return { success: true, data: data };
  } catch (err) {
    return { success: false, error: err.message || err.toString() };
  }
}

/**
 * 6. CUSTOMER LEDGER VIEW API
 */
async function getCustomerLedgerFromSupabase(accNo) {
  try {
    const { data, error } = await supabase
      .from('v_customer_ledger')
      .select('*')
      .eq('account_no', String(accNo).trim())
      .order('date', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message || err.toString() };
  }
}

/**
 * 7. EXECUTIVE DASHBOARD KPIS API
 */
async function getExecutiveDashboardKPIs() {
  try {
    // Total Customers Count
    const { count: customerCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    // Total Sales Count & Sum
    const { data: salesSum } = await supabase
      .from('sales')
      .select('total_amt, advance, processing_fee');

    let totalSalesVol = 0;
    let totalAdvance = 0;
    let totalPros = 0;
    let totalSalesContracts = salesSum ? salesSum.length : 0;

    if (salesSum) {
      salesSum.forEach(s => {
        totalSalesVol += Number(s.total_amt || 0);
        totalAdvance += Number(s.advance || 0);
        totalPros += Number(s.processing_fee || 0);
      });
    }

    // Total Receipts Recoveries
    const { data: rctData } = await supabase
      .from('receipts')
      .select('amount, pay_mode');

    let totalReceiptsCount = rctData ? rctData.length : 0;
    let cashCollections = 0;
    let bankCollections = 0;

    if (rctData) {
      rctData.forEach(r => {
        let amt = Number(r.amount || 0);
        let mode = String(r.pay_mode || '').toLowerCase();
        if (mode.includes('bank') || mode.includes('online') || mode.includes('cheque')) {
          bankCollections += amt;
        } else {
          cashCollections += amt;
        }
      });
    }

    let totalRecovered = cashCollections + bankCollections;
    let totalOutstanding = totalSalesVol - (totalAdvance + totalRecovered);

    return {
      success: true,
      data: {
        totalActiveCustomers: customerCount || 0,
        totalSalesContracts: totalSalesContracts,
        totalSalesVolume: totalSalesVol,
        totalCollections: totalRecovered,
        cashCollections: cashCollections,
        bankCollections: bankCollections,
        advanceTotal: totalAdvance,
        processingFeeTotal: totalPros,
        totalOutstandingReceivable: totalOutstanding > 0 ? totalOutstanding : 0,
        totalReceiptEntries: totalReceiptsCount
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
