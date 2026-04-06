import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Download, 
  Search, 
  Calendar, 
  DollarSign, 
  ArrowUpRight, 
  CreditCard,
  Filter,
  FileText
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const RevenueHistory = () => {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRevenue = async () => {
    setLoading(true);
    
    // Convert dates to ISO for comparison
    const startISO = new Date(startDate).toISOString();
    const endISO = new Date(endDate + 'T23:59:59').toISOString();

    // 1. Fetch Membership Subscriptions
    const { data: subs } = await supabase
      .from('member_subscriptions')
      .select('*, members(first_name, last_name, phone), packages(name)')
      .eq('payment_status', 'paid')
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    // 3. Fetch Store Sales
    const { data: storeSales } = await supabase
      .from('inventory_sales')
      .select('*, members(first_name, last_name, phone)')
      .gte('sale_date', startISO)
      .lte('sale_date', endISO);

    // 4. Merge and Normalize
    const allTransactions = [
      ...(subs || []).map(s => ({
        id: s.id,
        created_at: s.created_at,
        members: s.members,
        type: 'Membership',
        label: s.packages?.name || 'Manual Package',
        amount: s.amount_paid,
        method: s.payment_method
      })),
      ...(usage || []).map(u => ({
        id: u.id,
        created_at: u.end_time,
        members: u.members,
        type: 'Equipment',
        label: `${u.equipment?.name || 'Treadmill'} Usage`,
        amount: u.total_charge,
        method: u.payment_method || 'On-Account'
      })),
      ...(storeSales || []).map(ss => ({
        id: ss.id,
        created_at: ss.sale_date,
        members: ss.members || { first_name: 'Guest', last_name: 'Customer' },
        type: 'Store',
        label: 'Supplement/Drink Sale',
        amount: ss.total_amount,
        method: ss.payment_method
      }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setTransactions(allTransactions);
    setLoading(false);
  };

  useEffect(() => {
    fetchRevenue();
  }, [startDate, endDate]);

  const filteredTransactions = transactions.filter(tx => {
    const fullName = `${tx.members?.first_name} ${tx.members?.last_name}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  const totalRevenue = filteredTransactions.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const avgTransaction = filteredTransactions.length > 0 ? (totalRevenue / filteredTransactions.length).toFixed(2) : 0;

  const exportToCSV = () => {
    if (filteredTransactions.length === 0) return;

    // Define CSV headers
    const headers = ['Date', 'Member Name', 'Type', 'Label', 'Method', 'Amount (LKR)'];
    
    // Map rows
    const rows = filteredTransactions.map(tx => [
      format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm'),
      `${tx.members?.first_name} ${tx.members?.last_name}`,
      tx.type,
      tx.label,
      tx.method?.replace('_', ' ').toUpperCase(),
      tx.amount
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // ... link download logic remains the same ...
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `MajesticGYM_Audit_${startDate}_to_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-white">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">Finance & Audit</h1>
          <p className="text-textSecondary mt-1 text-sm tracking-tight font-medium uppercase opacity-60">Membership Revenue & Equipment Billing Logs</p>
        </div>
        <button 
          onClick={exportToCSV}
          disabled={filteredTransactions.length === 0}
          className="btn-primary flex items-center gap-2 px-6 disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export Audit
        </button>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-6 border-neon/30 bg-neon/5 shadow-[0_0_20px_rgba(204,255,0,0.05)]">
          <p className="text-textSecondary text-[10px] uppercase font-black tracking-widest opacity-60">Total Consolidated Revenue</p>
          <p className="text-3xl font-black text-white mt-1 italic uppercase tracking-tighter">Rs. {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="card p-6 border-blue-500/20 bg-blue-500/5">
          <p className="text-textSecondary text-[10px] uppercase font-black tracking-widest opacity-60">Audit Entries</p>
          <p className="text-3xl font-black text-white mt-1 italic uppercase tracking-tighter">#{filteredTransactions.length}</p>
        </div>
        <div className="card p-6 border-purple-500/20 bg-purple-500/5">
          <p className="text-textSecondary text-[10px] uppercase font-black tracking-widest opacity-60">Session Avg</p>
          <p className="text-3xl font-black text-white mt-1 italic uppercase tracking-tighter">Rs. {avgTransaction}</p>
        </div>
      </div>
      
      {/* Filters (same as before) */}
      <div className="card p-6 border-gray-800 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-textSecondary uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-4 h-4 text-neon" /> Range Start
          </label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input-field w-full bg-gray-900 border-gray-800"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-textSecondary uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-4 h-4 text-neon" /> Range End
          </label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input-field w-full bg-gray-900 border-gray-800"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-textSecondary uppercase tracking-widest flex items-center gap-2">
            <Search className="w-4 h-4 text-neon" /> Audit Search
          </label>
          <input 
            type="text" 
            placeholder="Search by member..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field w-full bg-gray-900 border-gray-800"
          />
        </div>
      </div>

      <div className="card p-0 overflow-hidden border-gray-800 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800">
                <th className="px-6 py-5 text-[10px] font-black uppercase text-textSecondary tracking-[0.2em]">Transaction Trace</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-textSecondary tracking-[0.2em]">Member</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-textSecondary tracking-[0.2em]">Billing Category</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-textSecondary tracking-[0.2em]">Method</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-textSecondary tracking-[0.2em] text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center">
                    <RefreshCw className="w-8 h-8 text-neon animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center text-textSecondary italic text-xs uppercase tracking-widest opacity-40">
                    No matching audit logs for this period.
                  </td>
                </tr>
              ) : filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-neon/5 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                       <span className="text-white font-black text-sm tracking-tighter italic">{format(new Date(tx.created_at), 'yyyy-MM-dd')}</span>
                       <span className="text-[10px] text-textSecondary font-bold uppercase tracking-widest opacity-60">{format(new Date(tx.created_at), 'hh:mm a')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-white font-black uppercase italic tracking-tight">{tx.members?.first_name} {tx.members?.last_name}</p>
                    <p className="text-textSecondary text-[10px] font-bold opacity-60">{tx.members?.phone}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                       <span className={`text-[9px] font-black uppercase tracking-[0.15em] mb-1 px-2 py-0.5 rounded-full w-fit ${
                          tx.type === 'Membership' ? 'bg-blue-500/10 text-blue-400' : 
                          tx.type === 'Store' ? 'bg-neon/10 text-neon' :
                          'bg-purple-500/10 text-purple-400'
                       }`}>
                          {tx.type}
                       </span>
                       <span className="text-white font-bold text-xs">{tx.label}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-textSecondary text-[10px] font-black uppercase tracking-widest opacity-60 border border-gray-800 px-2 py-1 rounded-lg bg-gray-900 group-hover:border-neon/30 transition-all">
                       {tx.method?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="text-white font-black text-lg italic tracking-tighter group-hover:text-neon transition-colors">Rs. {tx.amount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const RefreshCw = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
);

const Clock = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

export default RevenueHistory;
