/**
 * ============================================================================
 * AL MEEZAN ERP - 100% DIRECT SUPABASE POSTGRESQL ENGINE (erp-backend.js)
 * Clean, Fast, Direct Database Connection with Zero Dual-System Conflicts
 * ============================================================================
 */

const SUPABASE_URL = "https://ofplfqawiupcmqvzkhfp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mcGxmcWF3aXVwY21xdnpraGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NzA5MjAsImV4cCI6MjEwMzE0NjkyMH0.DP6_HPAoDhexUwiavzbmrXNfh3BOD27P4rsUcSKkQdU";

// Shared Supabase Client
let _supabaseClient = null;
function getSB() {
  if (!_supabaseClient && window.supabase) {
    _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabaseClient;
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  getSB();
});

const erpApi = {

  // ==========================================
  // 1. SETTINGS & DROPDOWN VALUES
  // ==========================================
  async getSettings() {
    const sb = getSB();
    try {
      const { data, error } = await sb.from('app_settings').select('*').eq('is_active', true).order('sort_order');
      if (error || !data || data.length === 0) {
        return {
          success: true,
          cros: ['JAFAR SB', 'Raza Shah', 'Hassan', 'Muhammad Ali'],
          approvedBy: ['M Shabbir', 'M Shahid'],
          cash: ['Daybook (Cash)', 'Cash in Hand'],
          bank: ['Allied Bank (1870014)', 'Meezan Bank (99281)', 'Online Transfer'],
          expenseHeads: ['Shop Rent', 'Electricity Bill', 'Staff Salary', 'Tea & Refreshment', 'Stationery', 'Misc Expense'],
          vendors: []
        };
      }

      const cros = data.filter(d => d.category === 'CRO').map(d => d.display_name);
      const approvedBy = data.filter(d => d.category === 'APPROVED_BY').map(d => d.display_name);
      const cash = data.filter(d => d.category === 'PAY_MODE').map(d => d.display_name);
      const bank = data.filter(d => d.category === 'BANK').map(d => d.display_name);
      const expenseHeads = data.filter(d => d.category === 'EXPENSE_HEAD').map(d => d.display_name);
      const vendors = data.filter(d => d.category === 'VENDOR').map(d => ({ name: d.display_name, contact: d.contact_person, mobile: d.mobile_no }));

      return {
        success: true,
        cros: cros.length ? cros : ['JAFAR SB', 'Raza Shah', 'Hassan'],
        approvedBy: approvedBy.length ? approvedBy : ['M Shabbir', 'M Shahid'],
        cash: cash.length ? cash : ['Daybook (Cash)'],
        bank: bank.length ? bank : ['Allied Bank (1870014)'],
        expenseHeads: expenseHeads.length ? expenseHeads : ['General Expense'],
        vendors: vendors
      };
    } catch(e) {
      return {
        success: true,
        cros: ['JAFAR SB', 'Raza Shah', 'Hassan'],
        approvedBy: ['M Shabbir', 'M Shahid'],
        cash: ['Daybook (Cash)'],
        bank: ['Allied Bank (1870014)'],
        expenseHeads: ['General Expense'],
        vendors: []
      };
    }
  },

  // ==========================================
  // 2. CUSTOMERS (COA)
  // ==========================================
  async getNextAccountNumber() {
    const sb = getSB();
    const { data, error } = await sb.from('customers').select('account_no').order('account_no', { ascending: false }).limit(100);
    if (error) throw error;

    let maxNum = 7860000;
    if (data && data.length > 0) {
      data.forEach(r => {
        let num = parseInt(String(r.account_no).replace(/[^\d]/g, ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      });
    }
    return { success: true, nextAccNo: String(maxNum + 1) };
  },

  async getCustomer(accNo) {
    const sb = getSB();
    const cleanAcc = String(accNo).trim();
    const { data: cust, error: custErr } = await sb.from('customers').select('*').eq('account_no', cleanAcc).maybeSingle();
    if (custErr) throw custErr;
    if (!cust) return { success: false, error: "Account not found" };

    const { data: sales } = await sb.from('sales').select('total_amt, advance, installment_per_month').eq('account_no', cleanAcc);
    const { data: receipts } = await sb.from('receipts').select('amount').eq('account_no', cleanAcc);

    let totalSale = 0, advance = 0, monthlyInst = 0;
    if (sales) {
      sales.forEach(s => {
        totalSale += Number(s.total_amt || 0);
        advance += Number(s.advance || 0);
        if (s.installment_per_month) monthlyInst = Number(s.installment_per_month);
      });
    }

    let totalPaidReceipts = 0;
    if (receipts) {
      receipts.forEach(r => totalPaidReceipts += Number(r.amount || 0));
    }

    let totalPaid = advance + totalPaidReceipts;
    let balance = totalSale - totalPaid;

    return {
      success: true,
      accountNo: cust.account_no,
      accountTitle: cust.account_title,
      approvedBy: cust.approved_by,
      cro: cust.cro,
      mobileNo: cust.mobile_number,
      sowdowo: cust.sowdowo,
      cnicNo: cust.cnic_no,
      address: cust.address,
      department: cust.department,
      designation: cust.designation,
      salary: cust.salary,
      totalSale: totalSale,
      totalSaleAmount: totalSale,
      paidAmount: totalPaid,
      balance: balance > 0 ? balance : 0,
      monthlyInst: monthlyInst,
      installment: monthlyInst
    };
  },

  async saveCustomer(data) {
    const sb = getSB();
    const record = {
      account_no: String(data.accountNo || data.accNo).trim(),
      account_title: data.accountTitle,
      approved_by: data.approvedBy,
      cro: data.cro,
      mobile_number: data.mobileNo,
      sowdowo: data.sowdowo,
      cnic_no: data.cnicNo,
      address: data.address,
      department: data.department,
      salary: Number(data.salary || 0),
      designation: data.designation,
      guarantor_1_name: data.g1Name,
      guarantor_1_mobile: data.g1Mobile,
      guarantor_1_dept: data.g1Dept,
      guarantor_1_designation: data.g1Desig,
      guarantor_2_name: data.g2Name,
      guarantor_2_mobile: data.g2Mobile,
      guarantor_2_dept: data.g2Dept,
      guarantor_2_designation: data.g2Desig
    };

    const { data: saved, error } = await sb.from('customers').upsert(record, { onConflict: 'account_no' }).select();
    if (error) throw error;
    return { success: true, message: "Customer saved successfully", data: saved };
  },

  async getAllCustomers() {
    const sb = getSB();
    const { data, error } = await sb.from('customers').select('*').order('account_no', { ascending: true });
    if (error) throw error;
    return { success: true, data: data || [] };
  },

  // ==========================================
  // 3. RECEIPTS & COLLECTIONS
  // ==========================================
  async saveReceipt(data) {
    const sb = getSB();
    const record = {
      voucher_no: String(data.receiptNo || data.receiptNoCustom || data.voucher_no || '').trim(),
      date: data.receiptDate || data.date || new Date().toISOString().split('T')[0],
      account_no: String(data.accountNo || data.accNo || '').trim(),
      account_title: String(data.accountTitle || data.customerName || '').trim(),
      account_head: data.receiptSuffix || data.account_head || 'Cash',
      pay_mode: data.paymentMode || data.pay_mode || 'Cash',
      amount: Number(data.receiptAmount || data.amount || 0),
      remarks: data.receiptRemarks || data.remarks || ''
    };

    const { data: saved, error } = await sb.from('receipts').insert([record]).select();
    if (error) throw error;
    return { success: true, data: saved };
  },

  async updateReceipt(idOrVoucher, data) {
    const sb = getSB();
    const updatePayload = {};
    if (data.date) updatePayload.date = data.date;
    if (data.amount !== undefined) updatePayload.amount = Number(data.amount);
    if (data.pay_mode || data.paymentMode) updatePayload.pay_mode = data.pay_mode || data.paymentMode;
    if (data.account_no) updatePayload.account_no = String(data.account_no).trim();
    if (data.account_title) updatePayload.account_title = String(data.account_title).trim();
    if (data.remarks !== undefined) updatePayload.remarks = data.remarks;

    const { data: updated, error } = await sb.from('receipts')
      .update(updatePayload)
      .or(`id.eq.${idOrVoucher},voucher_no.eq.${idOrVoucher}`)
      .select();

    if (error) throw error;
    return { success: true, data: updated };
  },

  async deleteReceipt(idOrVoucher) {
    const sb = getSB();
    const { error } = await sb.from('receipts').delete().or(`id.eq.${idOrVoucher},voucher_no.eq.${idOrVoucher}`);
    if (error) throw error;
    return { success: true };
  },

  async getRecentReceipts(filters = {}) {
    const sb = getSB();
    let query = sb.from('receipts').select('*').order('date', { ascending: false }).limit(300);

    if (filters.fromDate) query = query.gte('date', filters.fromDate);
    if (filters.toDate) query = query.lte('date', filters.toDate);

    const { data, error } = await query;
    if (error) throw error;

    return {
      success: true,
      data: (data || []).map(r => ({
        id: r.id,
        receiptNo: r.voucher_no,
        date: r.date,
        accountNo: r.account_no,
        accountTitle: r.account_title,
        paymentHead: r.pay_mode,
        amount: r.amount,
        remarks: r.remarks
      }))
    };
  },

  // ==========================================
  // 4. SALES CONTRACTS & ORDERS
  // ==========================================
  async saveSalesEntry(data) {
    const sb = getSB();
    const products = data.products || [];
    const records = products.map(p => ({
      product_id: p.product_id || null,
      date: data.date,
      approved_by: data.approvedBy,
      cro: data.cro,
      account_no: data.accountNo,
      account_title: data.accountTitle,
      company_name: p.companyName,
      product_category: p.productCategory,
      model: p.model,
      color: p.color,
      qty: Number(p.qty) || 1,
      sales_rate: Number(p.salesRate) || 0,
      sales_amt: Number(p.salesAmt) || 0,
      plan_months: Number(p.planMonths) || 0,
      advance: Number(p.advance) || 0,
      installment_per_month: Number(p.installmentPerMonth) || 0,
      processing_fee: Number(p.processingFee) || 0,
      total_amt: Number(p.salesAmt || 0) + Number(p.processingFee || 0),
      next_inst_month: data.nextInstMonth || null,
      remarks: p.remarks || ''
    }));

    const { error } = await sb.from('sales').insert(records);
    if (error) throw error;

    // Automatic Stock Deduction
    const stockOut = products.filter(p => p.product_id).map(p => ({
      transaction_id: "OUT-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      date: data.date,
      product_id: p.product_id,
      company_name: p.companyName,
      product_category: p.productCategory,
      model: p.model,
      color: p.color,
      qty_in: 0,
      qty_out: Number(p.qty) || 1,
      reference_type: 'SALE',
      reference_id: data.accountNo,
      warehouse: 'MAIN WAREHOUSE',
      remarks: 'Sale Acc ' + data.accountNo
    }));

    if (stockOut.length > 0) {
      await sb.from('stock_ledger').insert(stockOut);
    }

    return { success: true, message: "Sale saved successfully" };
  },

  async getRecentSales() {
    const sb = getSB();
    const { data, error } = await sb.from('sales').select('*').order('date', { ascending: false }).limit(250);
    if (error) throw error;
    return { success: true, data: data || [] };
  },

  // ==========================================
  // 5. PRODUCT MASTER
  // ==========================================
  async getProductDropdownData() {
    const sb = getSB();
    const { data, error } = await sb.from('product_master').select('*');
    if (error) throw error;

    return {
      categories: [...new Set(data.map(p => p.product_category).filter(Boolean))].sort(),
      companies: [...new Set(data.map(p => p.company_name).filter(Boolean))].sort(),
      models: [...new Set(data.map(p => p.model).filter(Boolean))].sort(),
      colors: [...new Set(data.map(p => p.color).filter(Boolean))].sort(),
      rams: [...new Set(data.map(p => p.ram).filter(Boolean))].sort(),
      roms: [...new Set(data.map(p => p.memory).filter(Boolean))].sort(),
      products: data || []
    };
  },

  async saveProductMaster(data) {
    const sb = getSB();
    const pid = data.product_id || "PRD-" + new Date().getTime().toString(36).toUpperCase();
    const record = {
      product_id: pid,
      company_name: data.company_name,
      product_category: data.product_category,
      model: data.model,
      color: data.color || '',
      memory: data.memory || '',
      ram: data.ram || '',
      remarks: data.remarks || ''
    };

    const { error } = await sb.from('product_master').upsert(record, { onConflict: 'product_id' });
    if (error) throw error;
    return { success: true, message: "Product saved successfully", product_id: pid };
  },

  // ==========================================
  // 6. PURCHASES & INVENTORY IN
  // ==========================================
  async savePurchaseEntry(data) {
    const sb = getSB();
    const items = data.items || [data];
    const purchaseRecords = [];
    const stockRecords = [];

    const purchaseId = data.purchase_id || "PUR-" + new Date().getTime().toString(36).toUpperCase();

    items.forEach(item => {
      purchaseRecords.push({
        purchase_id: purchaseId,
        purchase_date: data.purchase_date || item.purchase_date,
        supplier: data.supplier || item.supplier,
        product_id: item.product_id,
        company_name: item.company_name,
        product_category: item.product_category,
        model: item.model,
        color: item.color,
        qty: Number(item.qty) || 1,
        cost_price: Number(item.cost_price) || 0,
        mrp: Number(item.mrp) || 0,
        hp_percent: Number(item.hp_percent) || 0,
        hp_amount: Number(item.hp_amount) || 0,
        line_total: Number(item.line_total) || 0,
        serial_no: item.serial_no || '',
        remarks: item.remarks || ''
      });

      stockRecords.push({
        transaction_id: "IN-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
        date: data.purchase_date || item.purchase_date,
        product_id: item.product_id,
        company_name: item.company_name,
        product_category: item.product_category,
        model: item.model,
        color: item.color,
        qty_in: Number(item.qty) || 1,
        qty_out: 0,
        reference_type: 'PURCHASE',
        reference_id: purchaseId,
        warehouse: 'MAIN WAREHOUSE',
        remarks: 'Purchase from ' + (data.supplier || item.supplier)
      });
    });

    const { error: purErr } = await sb.from('purchase_detail').insert(purchaseRecords);
    if (purErr) throw purErr;

    if (stockRecords.length > 0) {
      await sb.from('stock_ledger').insert(stockRecords);
    }

    return { success: true, message: "Purchase saved successfully", purchase_id: purchaseId };
  },

  async getPurchases() {
    const sb = getSB();
    const { data, error } = await sb.from('purchase_detail').select('*').order('purchase_date', { ascending: false }).limit(300);
    if (error) throw error;
    return { success: true, data: data || [] };
  },

  // ==========================================
  // 7. HIGH-SPEED AGING REPORT (REAL-TIME)
  // ==========================================
  async getAgingReportData() {
    const sb = getSB();

    const [custRes, salesRes, rctRes] = await Promise.all([
      sb.from('customers').select('account_no, account_title, approved_by, cro, mobile_number'),
      sb.from('sales').select('account_no, date, company_name, model, plan_months, total_amt, advance, installment_per_month, remarks'),
      sb.from('receipts').select('account_no, date, amount')
    ]);

    const customers = custRes.data || [];
    const sales = salesRes.data || [];
    const receipts = rctRes.data || [];

    const salesByAcc = {};
    sales.forEach(s => {
      const acc = String(s.account_no).trim();
      if (!salesByAcc[acc]) salesByAcc[acc] = [];
      salesByAcc[acc].push(s);
    });

    const rctByAcc = {};
    receipts.forEach(r => {
      const acc = String(r.account_no).trim();
      if (!rctByAcc[acc]) rctByAcc[acc] = [];
      rctByAcc[acc].push(r);
    });

    const now = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const m1Date = new Date(now.getFullYear(), now.getMonth(), 1);
    const m2Date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const m3Date = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const m1Header = monthNames[m1Date.getMonth()] + "-" + String(m1Date.getFullYear()).slice(-2);
    const m2Header = monthNames[m2Date.getMonth()] + "-" + String(m2Date.getFullYear()).slice(-2);
    const m3Header = monthNames[m3Date.getMonth()] + "-" + String(m3Date.getFullYear()).slice(-2);

    const m1Prefix = m1Date.toISOString().slice(0, 7);
    const m2Prefix = m2Date.toISOString().slice(0, 7);
    const m3Prefix = m3Date.toISOString().slice(0, 7);

    const agingList = [];

    customers.forEach(c => {
      const acc = String(c.account_no).trim();
      const accSales = salesByAcc[acc] || [];
      const accReceipts = rctByAcc[acc] || [];

      let totalSale = 0, totalAdvance = 0, monthlyInst = 0, plan = 0, deliveryDate = "";
      let products = [], remarks = [];

      accSales.forEach(s => {
        totalSale += Number(s.total_amt || 0);
        totalAdvance += Number(s.advance || 0);
        if (s.installment_per_month) monthlyInst = Number(s.installment_per_month);
        if (s.plan_months) plan = Number(s.plan_months);
        if (!deliveryDate && s.date) deliveryDate = s.date;
        if (s.company_name || s.model) products.push(`${s.company_name || ''} ${s.model || ''}`.trim());
        if (s.remarks) remarks.push(s.remarks);
      });

      let totalReceiptsAmt = 0, m1Received = 0, m2Received = 0, m3Received = 0;
      accReceipts.forEach(r => {
        const amt = Number(r.amount || 0);
        totalReceiptsAmt += amt;
        const rDate = String(r.date || '');
        if (rDate.startsWith(m1Prefix)) m1Received += amt;
        else if (rDate.startsWith(m2Prefix)) m2Received += amt;
        else if (rDate.startsWith(m3Prefix)) m3Received += amt;
      });

      const totalReceived = totalAdvance + totalReceiptsAmt;
      const balance = totalSale - totalReceived;

      if (totalSale > 0 || accReceipts.length > 0) {
        agingList.push({
          accNo: acc,
          accTitle: c.account_title || '',
          approvedBy: c.approved_by || '',
          cro: c.cro || '',
          mobile: c.mobile_number || '',
          monthlyInst: monthlyInst,
          remarks: remarks.join(', '),
          product: products.join(', '),
          plan: plan ? plan + " M" : '',
          totalSales: totalSale,
          totalReceived: totalReceived,
          advance: totalAdvance,
          balance: balance > 0 ? balance : 0,
          deliveryDate: deliveryDate,
          m1Received: m1Received,
          m2Received: m2Received,
          m3Received: m3Received
        });
      }
    });

    return {
      success: true,
      data: agingList,
      monthHeaders: [m3Header, m2Header, m1Header]
    };
  },

  // ==========================================
  // 8. DAILY RECOVERY REPORT
  // ==========================================
  async getDailyRecoveryData(filters = {}) {
    const sb = getSB();
    let query = sb.from('receipts').select('*').order('date', { ascending: false });

    if (filters.fromDate) query = query.gte('date', filters.fromDate);
    if (filters.toDate) query = query.lte('date', filters.toDate);

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, data: data || [] };
  },

  // ==========================================
  // 9. DAYBOOK (CASH & BANK JOURNAL)
  // ==========================================
  async getDaybookData(dateStr) {
    const sb = getSB();
    const date = dateStr || new Date().toISOString().split('T')[0];

    const [rctRes, salesRes, expRes, payRes, contraRes] = await Promise.all([
      sb.from('receipts').select('*').eq('date', date),
      sb.from('sales').select('*').eq('date', date).gt('advance', 0),
      sb.from('expenses').select('*').eq('date', date),
      sb.from('payments').select('*').eq('date', date),
      sb.from('contra').select('*').eq('date', date)
    ]);

    return {
      success: true,
      date: date,
      receipts: rctRes.data || [],
      salesAdvance: salesRes.data || [],
      expenses: expRes.data || [],
      payments: payRes.data || [],
      contra: contraRes.data || []
    };
  },

  // ==========================================
  // 10. CUSTOMER STATEMENT & LEDGER VIEW
  // ==========================================
  async getCustomerLedger(accNo) {
    const sb = getSB();
    const cleanAcc = String(accNo).trim();
    const { data, error } = await sb.from('v_customer_ledger').select('*').eq('account_no', cleanAcc).order('date', { ascending: true });
    if (error) throw error;
    return { success: true, data: data || [] };
  },

  // ==========================================
  // 11. STOCK LEDGER
  // ==========================================
  async getStockLedger() {
    const sb = getSB();
    const { data, error } = await sb.from('stock_ledger').select('*').order('date', { ascending: false });
    if (error) throw error;
    return { success: true, data: data || [] };
  },

  // ==========================================
  // 12. VENDOR LEDGER
  // ==========================================
  async getVendorLedger(vendorName) {
    const sb = getSB();
    let query = sb.from('purchase_detail').select('*');
    if (vendorName && vendorName !== 'All') query = query.eq('supplier', vendorName);
    const { data, error } = await query.order('purchase_date', { ascending: true });
    if (error) throw error;
    return { success: true, data: data || [] };
  },

  // ==========================================
  // 13. VOUCHER ENTRIES (EXPENSES, PAYMENTS, CONTRA)
  // ==========================================
  async saveVoucher(type, data) {
    const sb = getSB();
    let table = 'expenses';
    if (type === 'payment') table = 'payments';
    else if (type === 'contra') table = 'contra';
    else if (type === 'general_receipt') table = 'general_receipts';

    const { data: saved, error } = await sb.from(table).insert([data]).select();
    if (error) throw error;
    return { success: true, data: saved };
  },

  // ==========================================
  // 14. EXECUTIVE DASHBOARD KPIS
  // ==========================================
  async getDashboardKPIs() {
    const sb = getSB();
    const { count: customerCount } = await sb.from('customers').select('*', { count: 'exact', head: true });
    const { data: salesSum } = await sb.from('sales').select('total_amt, advance, processing_fee');

    let totalSalesVol = 0, totalAdvance = 0, totalPros = 0;
    if (salesSum) {
      salesSum.forEach(s => {
        totalSalesVol += Number(s.total_amt || 0);
        totalAdvance += Number(s.advance || 0);
        totalPros += Number(s.processing_fee || 0);
      });
    }

    const { data: rctData } = await sb.from('receipts').select('amount, pay_mode');
    let cashCollections = 0, bankCollections = 0;

    if (rctData) {
      rctData.forEach(r => {
        let amt = Number(r.amount || 0);
        let mode = String(r.pay_mode || '').toLowerCase();
        if (mode.includes('bank') || mode.includes('online') || mode.includes('cheque')) bankCollections += amt;
        else cashCollections += amt;
      });
    }

    let totalRecovered = cashCollections + bankCollections;
    let totalOutstanding = totalSalesVol - (totalAdvance + totalRecovered);

    return {
      success: true,
      data: {
        totalActiveCustomers: customerCount || 0,
        totalSalesContracts: salesSum ? salesSum.length : 0,
        totalSalesVolume: totalSalesVol,
        totalCollections: totalRecovered,
        cashCollections: cashCollections,
        bankCollections: bankCollections,
        advanceTotal: totalAdvance,
        processingFeeTotal: totalPros,
        totalOutstandingReceivable: totalOutstanding > 0 ? totalOutstanding : 0,
        totalReceiptEntries: rctData ? rctData.length : 0
      }
    };
  }
};
