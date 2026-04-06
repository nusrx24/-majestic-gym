import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  UserCheck, 
  UserMinus, 
  TrendingUp, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Package as PackageIcon,
  Clock,
  DollarSign,
  MessageSquare,
  Send,
  AlertCircle,
  Dumbbell,
  RefreshCw,
  User
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format, subDays, startOfMonth, startOfDay, endOfDay } from 'date-fns';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    expiredMembers: 0,
    todayCheckins: 0,
    monthlyRevenue: 0,
    revenueGrowth: 0
  });
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [packageDist, setPackageDist] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [equipmentAlerts, setEquipmentAlerts] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [equipmentStats, setEquipmentStats] = useState({ topMachine: 'N/A', usageRevenue: 0 });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    // ... Existing date logic ...
    const today = new Date();
    const startOfCurrentMonth = startOfMonth(today);
    const dayStart = startOfDay(today);
    const dayEnd = endOfDay(today);

    // Fetch Equipment Alerts
    const { data: equipData } = await supabase
      .from('equipment')
      .select('id, name, status')
      .neq('status', 'good');
    
    setEquipmentAlerts(equipData || []);

    // Fetch Active Equipment Sessions
    const { data: activeData } = await supabase
      .from('equipment_usage')
      .select('id, start_time, equipment(name), members(first_name, last_name)')
      .is('end_time', null);
    
    setActiveSessions(activeData || []);

    // Fetch Usage Revenue & Popularity
    const { data: usageData } = await supabase
      .from('equipment_usage')
      .select('total_charge, equipment(name)')
      .not('end_time', 'is', null);

    const usageMap = {};
    let totalUsageRev = 0;
    (usageData || []).forEach(u => {
      totalUsageRev += (Number(u.total_charge) || 0);
      const name = u.equipment?.name || 'Unknown';
      usageMap[name] = (usageMap[name] || 0) + 1;
    });

    const topMachine = Object.entries(usageMap).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A';
    setEquipmentStats({ topMachine, usageRevenue: totalUsageRev });

    // 1. Fetch All members & their subs for status calculation
    const { data: allMembers } = await supabase
      .from('members')
      .select('id, member_subscriptions(payment_status, end_date)');

    let activeCount = 0;
    let expiredCount = 0;
    const todayStr = today.toISOString().split('T')[0];

    (allMembers || []).forEach(m => {
      const subs = m.member_subscriptions || [];
      const hasActive = subs.some(s => s.payment_status === 'paid' && s.end_date >= todayStr);
      const hasPast = subs.some(s => s.end_date < todayStr);
      
      if (hasActive) activeCount++;
      else if (hasPast) expiredCount++;
    });

    // 2. Fetch Today's Checkins
    const { count: checkinCount } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .gte('checked_in_at', dayStart.toISOString())
      .lte('checked_in_at', dayEnd.toISOString());

    // 3. Fetch Monthly Revenue
    const { data: monthlySubs } = await supabase
      .from('member_subscriptions')
      .select('amount_paid')
      .eq('payment_status', 'paid')
      .gte('created_at', startOfCurrentMonth.toISOString());
    
    const revenueSum = (monthlySubs || []).reduce((acc, curr) => acc + (Number(curr.amount_paid) || 0), 0);

    // 4. Fetch Revenue Trend (Last 30 days)
    const thirtyDaysAgo = subDays(today, 30);
    const { data: trendData } = await supabase
      .from('member_subscriptions')
      .select('amount_paid, created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Group by day for Recharts
    const trendMap = {};
    for (let i = 0; i < 30; i++) {
        const d = format(subDays(today, i), 'MMM dd');
        trendMap[d] = 0;
    }
    (trendData || []).forEach(s => {
        const d = format(new Date(s.created_at), 'MMM dd');
        if (trendMap[d] !== undefined) trendMap[d] += Number(s.amount_paid);
    });
    const trendList = Object.keys(trendMap).reverse().map(date => ({ date, amount: trendMap[date] }));

    // 5. Package Distribution
    const { data: pkgData } = await supabase
      .from('member_subscriptions')
      .select('packages(name)')
      .eq('payment_status', 'paid');
    
    const pkgMap = {};
    (pkgData || []).forEach(s => {
      const name = s.packages?.name || 'Unknown';
      pkgMap[name] = (pkgMap[name] || 0) + 1;
    });
    const pkgList = Object.keys(pkgMap).map(name => ({ name, value: pkgMap[name] }));

    // 6. Recent Transactions
    const { data: recent } = await supabase
      .from('member_subscriptions')
      .select('amount_paid, created_at, members(first_name, last_name), packages(name)')
      .order('created_at', { ascending: false })
      .limit(6);

    // 7. Expiring Soon (Next 7 Days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const { data: expiring } = await supabase
      .from('member_subscriptions')
      .select('end_date, members(first_name, last_name, phone), packages(name)')
      .eq('payment_status', 'paid')
      .gt('end_date', today.toISOString().split('T')[0])
      .lte('end_date', sevenDaysFromNow.toISOString().split('T')[0])
      .order('end_date', { ascending: true });

    // Deduplicate: If someone has multiple subscriptions (rare in this logic), only show the first one
    const uniqueExpiring = [];
    const seenMembers = new Set();
    (expiring || []).forEach(e => {
        const key = `${e.members?.first_name}-${e.members?.phone}`;
        if (!seenMembers.has(key)) {
            uniqueExpiring.push(e);
            seenMembers.add(key);
        }
    });

    setStats({
      totalMembers: allMembers?.length || 0,
      activeMembers: activeCount,
      expiredMembers: expiredCount,
      todayCheckins: checkinCount || 0,
      monthlyRevenue: revenueSum
    });
    setRevenueTrend(trendList);
    setPackageDist(pkgList);
    setRecentTransactions(recent || []);
    setExpiringSoon(uniqueExpiring);
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const sendReminder = (member, date) => {
    const cleanPhone = member.phone.replace(/\D/g, '');
    const message = `Hi ${member.first_name}, your subscription at Majestic GYM expires on ${format(new Date(date), 'MMMM dd')}. Renew today to keep your access active! See you at the gym!`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const sendAllReminders = () => {
    if (expiringSoon.length === 0) return;
    if (window.confirm(`This will open ${expiringSoon.length} WhatsApp tabs. Continue?`)) {
        expiringSoon.forEach((item, index) => {
            // Use timeout to prevent browser popup block of too many windows at once
            setTimeout(() => {
                sendReminder(item.members, item.end_date);
            }, index * 1000);
        });
    }
  };

  const COLORS = ['#CCFF00', '#00E5FF', '#FF00E5', '#7000FF'];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-10 h-10 border-4 border-neon border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 pb-10 overflow-hidden">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Admin Dashboard</h1>
          <p className="text-textSecondary mt-1">Majestic GYM Overview & Analytics</p>
        </div>
        <button onClick={fetchDashboardData} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm transition-colors border border-gray-700">
           Refresh Stats
        </button>
      </div>

      {/* Equipment Alerts Banner */}
      {equipmentAlerts.length > 0 && (
        <div className="card bg-red-500/10 border-red-500/30 p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400">
                 <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                 <h3 className="text-white font-bold tracking-tight">Maintenance Required ({equipmentAlerts.length})</h3>
                 <p className="text-red-400/80 text-xs">Some equipment is marked as broken or needs attention.</p>
              </div>
           </div>
           <div className="flex -space-x-2 overflow-hidden">
              {equipmentAlerts.map((equip, idx) => (
                <div key={idx} className="px-3 py-1 bg-gray-900 border border-gray-800 text-[10px] text-textSecondary uppercase font-black tracking-widest rounded-lg">
                   {equip.name}
                </div>
              ))}
           </div>
           <button onClick={() => window.location.href='/equipment'} className="btn-secondary py-2 px-4 text-xs font-bold border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white">
              View Tool
           </button>
        </div>
      )}
      
      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Members', val: stats.totalMembers, icon: <Users />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: 'Equipment Income', val: `Rs. ${equipmentStats.usageRevenue}`, icon: <Dumbbell />, color: 'text-neon', bg: 'bg-neon/10' },
          { label: 'Top Machine', val: equipmentStats.topMachine, icon: <TrendingUp />, color: 'text-orange-400', bg: 'bg-orange-400/10' },
          { label: 'Today Check-ins', val: stats.todayCheckins, icon: <Clock />, color: 'text-purple-400', bg: 'bg-purple-400/10' },
        ].map((m, i) => (
          <div key={i} className="card p-5 hover:border-gray-700 transition-all border-gray-800 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${m.bg} flex items-center justify-center ${m.color}`}>
              {m.icon}
            </div>
            <div>
              <p className="text-textSecondary text-[10px] uppercase font-black tracking-widest">{m.label}</p>
              <p className={`text-xl font-black ${m.label === 'Top Machine' ? 'text-white' : ''} mt-0.5`}>{m.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Live Floor Status & Active Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 card border-neon/20 p-0 overflow-hidden">
           <div className="p-5 border-b border-gray-800 bg-neon/5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 bg-neon rounded-full animate-pulse shadow-[0_0_10px_#CCFF00]"></div>
                 <h2 className="text-xs font-black text-white uppercase tracking-widest">Live Floor Occupancy</h2>
              </div>
              <span className="text-neon text-[10px] font-black uppercase tracking-widest">{activeSessions.length} Active</span>
           </div>
           
           <div className="divide-y divide-gray-800 max-h-[350px] overflow-y-auto">
              {activeSessions.length > 0 ? activeSessions.map((session, idx) => (
                <div key={idx} className="p-4 hover:bg-gray-800/10 transition-all flex items-center justify-between group">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-neon">
                         <User className="w-4 h-4" />
                      </div>
                      <div>
                         <p className="text-xs font-bold text-white leading-none">{session.members?.first_name} {session.members?.last_name}</p>
                         <p className="text-[9px] text-textSecondary uppercase font-black tracking-widest mt-1">on {session.equipment?.name}</p>
                      </div>
                   </div>
                   <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1.5 text-neon text-[9px] font-black uppercase">
                         <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                         Active
                      </div>
                   </div>
                </div>
              )) : (
                <div className="p-10 text-center space-y-3">
                   <Dumbbell className="w-8 h-8 text-gray-800 mx-auto" />
                   <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest leading-relaxed">The fitness floor is currently clear.</p>
                </div>
              )}
           </div>
           <div className="p-4 bg-gray-900/50 border-t border-gray-800">
              <button onClick={() => window.location.href='/kiosk'} className="w-full py-2 bg-gray-800 hover:bg-neon hover:text-black border border-gray-700 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                 Open Member Kiosk Mode
              </button>
           </div>
        </div>
        {/* Revenue Trend Chart */}
        <div className="lg:col-span-2 card p-6 border-gray-800 min-h-[400px]">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-lg font-bold text-white">Monthly Revenue</h2>
              <p className="text-textSecondary text-sm">Income trend for the last 30 days</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white tracking-widest leading-none">Rs. {stats.monthlyRevenue}</p>
              <p className="text-neon text-xs font-bold mt-1 uppercase">Total for {format(new Date(), 'MMMM')}</p>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#CCFF00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" vertical={false} />
                <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `Rs.${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F0F0F', border: '1px solid #2D2D2D', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#CCFF00' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#CCFF00" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Package Distribution Chart */}
        <div className="card p-6 border-gray-800">
          <h2 className="text-lg font-bold text-white mb-1">Package Popularity</h2>
          <p className="text-textSecondary text-sm mb-6">Distribution by active plans</p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={packageDist}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {packageDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F0F0F', border: '1px solid #2D2D2D', borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {packageDist.map((pkg, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-textSecondary">{pkg.name}</span>
                </div>
                <span className="text-white font-medium">{pkg.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
        {/* Upcoming Expirations Panel */}
        <div className="card p-0 overflow-hidden border-gray-800">
           <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
             <div>
               <h2 className="text-lg font-bold text-white uppercase tracking-tight">Upcoming Expirations</h2>
               <p className="text-textSecondary text-xs">Members ending within 7 days</p>
             </div>
             {expiringSoon.length > 0 && (
               <button 
                 onClick={sendAllReminders}
                 className="flex items-center gap-2 px-3 py-1.5 bg-neon text-black rounded-lg text-xs font-bold hover:bg-neon/80 transition-all shadow-[0_0_15px_rgba(204,255,0,0.2)]"
               >
                 <Send className="w-3 h-3" />
                 Send 
               </button>
             )}
           </div>
           
           <div className="divide-y divide-gray-800 max-h-[460px] overflow-y-auto">
             {expiringSoon.length > 0 ? expiringSoon.map((item, i) => {
               const daysLeft = Math.ceil((new Date(item.end_date) - new Date()) / (1000 * 60 * 60 * 24));
               return (
                 <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-800/20 transition-colors group">
                   <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${daysLeft <= 2 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-neon/10 text-neon border border-neon/20'}`}>
                        {daysLeft}d
                     </div>
                     <div>
                       <p className="text-white font-bold">{item.members?.first_name} {item.members?.last_name}</p>
                       <p className="text-textSecondary text-xs uppercase tracking-widest">{item.packages?.name}</p>
                     </div>
                   </div>
                   <button 
                     onClick={() => sendReminder(item.members, item.end_date)}
                     className="p-2.5 bg-green-500/10 text-green-400 rounded-xl hover:bg-green-500 hover:text-black transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2 text-xs font-bold"
                   >
                     <MessageSquare className="w-4 h-4" />
                     WhatsApp
                   </button>
                 </div>
               );
             }) : (
               <div className="p-16 text-center">
                 <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserCheck className="w-6 h-6 text-gray-400" />
                 </div>
                 <p className="text-textSecondary text-sm">No members are expiring in the next 7 days.</p>
               </div>
             )}
           </div>
        </div>

        {/* Quick Insights / Help */}
        <div className="card p-6 bg-gradient-to-br from-neon/5 via-transparent to-transparent border-neon/10 h-full">
           <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tighter">Majestic Insights</h2>
           <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-xl bg-gray-900 border border-gray-800">
                <div className="w-12 h-12 rounded-lg bg-neon/10 flex items-center justify-center flex-shrink-0">
                   <TrendingUp className="w-6 h-6 text-neon" />
                </div>
                <div>
                   <h3 className="text-white font-bold tracking-tight">Global Revenue: Rs. {stats.monthlyRevenue}</h3>
                   <p className="text-textSecondary text-xs leading-relaxed mt-1">Excellent performance this month! You have {expiringSoon.length} members nearing expiration. Don't forget to use the WhatsApp tools to ensure renewals.</p>
                </div>
              </div>

              {stats.expiredMembers > 0 && (
                <div className="flex gap-4 p-4 rounded-xl bg-red-500/5 border border-red-500/10 divide-x divide-red-500/20">
                  <div className="flex items-center gap-3 pr-4">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <div>
                      <p className="text-red-400 font-bold leading-none">{stats.expiredMembers}</p>
                      <p className="text-textSecondary text-[10px] uppercase font-bold mt-1">Expired</p>
                    </div>
                  </div>
                  <div className="pl-4">
                    <p className="text-textSecondary text-xs">These members are no longer able to check in. Visit the Members Directory to manage their renewals.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mt-2">
                  <button onClick={() => window.location.href='/members'} className="flex flex-col items-center gap-2 p-5 rounded-xl border border-gray-800 bg-gray-900 hover:border-neon/50 hover:bg-neon/5 transition-all text-white group">
                    <PackageIcon className="w-7 h-7 text-neon group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-widest">Assign Pkg</span>
                  </button>
                  <button onClick={() => window.location.href='/attendance'} className="flex flex-col items-center gap-2 p-5 rounded-xl border border-gray-800 bg-gray-900 hover:border-neon/50 hover:bg-neon/5 transition-all text-white group">
                    <UserCheck className="w-7 h-7 text-neon group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-widest">Attendance</span>
                  </button>
              </div>
           </div>
        </div>
      </div>

      {/* Recent Transactions List - Full Width */}
      <div className="card p-0 overflow-hidden border-gray-800 pb-10">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/30">
          <h2 className="text-lg font-bold text-white uppercase tracking-tight">Recent Transactions</h2>
          <DollarSign className="w-5 h-5 text-neon" />
        </div>
        <div className="divide-y divide-gray-800">
          {recentTransactions.length > 0 ? recentTransactions.map((tx, i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-800/10 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-neon/10 flex items-center justify-center text-neon border border-neon/20">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-bold">{tx.members?.first_name} {tx.members?.last_name}</p>
                  <p className="text-textSecondary text-xs uppercase tracking-widest">{tx.packages?.name || 'Manual Payment'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-neon font-bold tracking-tighter">Rs. {tx.amount_paid}</p>
                <p className="text-textSecondary text-[10px] uppercase font-bold tracking-widest">{format(new Date(tx.created_at), 'MMM dd, hh:mm a')}</p>
              </div>
            </div>
          )) : (
            <p className="p-16 text-center text-textSecondary text-sm">No recent transactions recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
