import React, { useState, useEffect } from 'react';
import { Search, Plus, RefreshCw, Eye, User as UserIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AssignMembershipModal from '../components/AssignMembershipModal';

const MembersList = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Compute real-time status from subscriptions
  const getMemberStatus = (member) => {
    const today = new Date().toISOString().split('T')[0];
    const sub = member.member_subscriptions?.[0];
    if (!sub) return 'inactive';
    if (sub.payment_status === 'paid' && sub.end_date >= today) return 'active';
    if (sub.end_date < today) return 'expired';
    return 'inactive';
  };

  const fetchMembers = async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase
      .from('members')
      .select(`
        *,
        member_subscriptions (
          payment_status,
          end_date
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
    } else {
      // Sort each member's subscriptions by end_date desc so [0] is the latest
      const enriched = (data || []).map(m => ({
        ...m,
        member_subscriptions: (m.member_subscriptions || []).sort((a, b) =>
          b.end_date?.localeCompare(a.end_date)
        )
      }));
      setMembers(enriched);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Members Directory</h1>
          <p className="text-textSecondary mt-1">Register and manage gym memberships.</p>
        </div>
        <Link 
          to="/members/new" 
          id="add-member-button"
          className="btn-primary flex items-center justify-center gap-2 px-8 py-4 min-w-[200px] shadow-[0_0_20px_rgba(204,255,0,0.2)] hover:shadow-neon/40 transition-all"
        >
          <Plus className="w-6 h-6" />
          <span className="font-black uppercase tracking-widest">Add New Member</span>
        </Link>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID, or phone..." 
              className="input-field pl-10"
            />
          </div>
          <div className="flex gap-4 items-center">
            <button onClick={fetchMembers} className="text-gray-400 hover:text-white transition-colors p-2 bg-gray-800/50 rounded-lg">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field bg-transparent w-auto">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm text-center">
            Failed to load members: {errorMsg}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-800/50 text-textSecondary text-sm uppercase tracking-wider">
                <th className="p-4 rounded-tl-lg">ID</th>
                <th className="p-4">Name</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Status</th>
                <th className="p-4 rounded-tr-lg">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-textSecondary">
                    <div className="w-6 h-6 border-2 border-neon border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-textSecondary">
                    No members found. Add a member to see them here.
                  </td>
                </tr>
              ) : (
                members
                  .filter(m => {
                    const s = getMemberStatus(m);
                    const matchStatus = statusFilter === 'all' || s === statusFilter;
                    const term = searchTerm.toLowerCase();
                    const matchSearch = !term ||
                      `${m.first_name} ${m.last_name}`.toLowerCase().includes(term) ||
                      m.member_id_string?.toLowerCase().includes(term) ||
                      m.phone?.includes(term);
                    return matchStatus && matchSearch;
                  })
                  .map((member) => {
                    const dynStatus = getMemberStatus(member);
                    const statusStyle = {
                      active:   'bg-green-500/20 text-green-400',
                      expired:  'bg-orange-500/20 text-orange-400',
                      inactive: 'bg-gray-600/40 text-gray-400',
                    }[dynStatus] || 'bg-gray-600/40 text-gray-400';

                    return (
                      <tr key={member.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors group">
                        <td className="p-4 text-neon font-mono text-sm">{member.member_id_string}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center text-textSecondary group-hover:border-neon/30 transition-all">
                               {member.image_url ? (
                                 <img src={member.image_url} alt="" className="w-full h-full object-cover" />
                               ) : (
                                 <UserIcon className="w-5 h-5 opacity-30" />
                               )}
                            </div>
                            <div>
                               <p className="text-white font-bold leading-tight">{member.first_name} {member.last_name}</p>
                               <p className="text-[10px] text-textSecondary uppercase font-black tracking-widest mt-0.5">Joined {new Date(member.created_at).getFullYear()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-textSecondary font-medium">{member.phone}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                            dynStatus === 'active' ? 'bg-neon/10 text-neon border-neon/20' : 
                            dynStatus === 'expired' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                            'bg-gray-800 text-gray-500 border-gray-700'
                          }`}>
                            {dynStatus}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/members/${member.id}`)}
                              className="text-xs font-bold uppercase bg-gray-700 text-white px-3 py-2 rounded hover:bg-gray-600 transition-colors flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> View
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedMember(member);
                                setIsModalOpen(true);
                              }}
                              className="text-xs font-bold uppercase bg-neon text-black px-3 py-2 rounded hover:bg-neon/80 transition-colors"
                            >
                              {dynStatus === 'active' ? 'Renew' : 'Assign'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Assignment Modal */}
      <AssignMembershipModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        member={selectedMember}
        onSuccess={() => {
          setIsModalOpen(false);
          alert("Package fully assigned & activated!");
          fetchMembers(); // refresh to show updated status later
        }}
      />
    </div>
  );
};

export default MembersList;
