"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Download, Trash2, Calendar,
  Filter, Search, ChevronDown, Shield, X,
  Users, DollarSign, AlertCircle, CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AuctionLog {
  id: string;
  player_id: string;
  team_id: string | null;
  status: 'sold' | 'unsold' | 'manual';
  sale_price: number | null;
  base_price: number;
  bid_count: number;
  category: string;
  gender: string;
  logged_at: string;
  is_manual: boolean;
  deleted: boolean;
  deleted_at: string | null;
  player: {
    id: string;
    name: string;
    category: string;
    image_url: string;
    playing_role: string;
  } | null;
  team: {
    id: string;
    team_name: string;
    team_logo_url: string;
  } | null;
}

interface DeleteConfirmationState {
  show: boolean;
  logId: string | null;
  player: AuctionLog['player'] | null;
  team: AuctionLog['team'] | null;
  reason: string;
}

export function AuctionLogs() {
  const queryClient = useQueryClient();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sold' | 'unsold' | 'manual'>('all');
  const [showExportModal, setShowExportModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmationState>({
    show: false,
    logId: null,
    player: null,
    team: null,
    reason: '',
  });

  const { data: allLogs, isLoading } = useQuery({
    queryKey: ['auction_logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('auction_log')
        .select(`
          id,
          player_id,
          team_id,
          status,
          sale_price,
          base_price,
          bid_count,
          category,
          gender,
          logged_at,
          is_manual,
          deleted,
          deleted_at,
          player:players(id, name, category, image_url, playing_role),
          team:teams(id, team_name, team_logo_url)
        `)
        .order('logged_at', { ascending: false });
      return data || [];
    },
  });

  useEffect(() => {
    if (allLogs) {
      const filtered = allLogs.filter((log) => {
        if (statusFilter !== 'all' && log.status !== statusFilter) {
          return false;
        }
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const playerObj = log.player as any;
          const teamObj = log.team as any;
          const playerName = Array.isArray(playerObj) ? playerObj[0]?.name : playerObj?.name;
          const teamName = Array.isArray(teamObj) ? teamObj[0]?.team_name : teamObj?.team_name;
          return (
            (playerName?.toLowerCase().includes(searchLower) || false) ||
            (teamName?.toLowerCase().includes(searchLower) || false)
          );
        }
        return true;
      });
      setLogs(filtered);
    }
    setLoading(false);
  }, [allLogs, searchTerm, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: async ({ logId, reason }: { logId: string; reason: string }) => {
      const { deleteLogEntry } = await import('@/lib/actions/logging');
      const result = await deleteLogEntry(logId, reason);
      if (!result.success) {
        throw new Error(result.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction_logs'] });
      setDeleteConfirm({ show: false, logId: null, player: null, team: null, reason: '' });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const { exportLogsAsCSV } = await import('@/lib/actions/logging');
      const result = await exportLogsAsCSV();
      if (!result.success || !result.csv) {
        throw new Error(result.message);
      }
      return result.csv;
    },
    onSuccess: (csv) => {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auction_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportModal(false);
    },
  });

  const handleDelete = (log: AuctionLog) => {
    if (log.deleted) return;
    setDeleteConfirm({
      show: true,
      logId: log.id,
      player: log.player,
      team: log.team,
      reason: '',
    });
  };

  const confirmDelete = () => {
    if (!deleteConfirm.logId) return;
    deleteMutation.mutate({
      logId: deleteConfirm.logId,
      reason: deleteConfirm.reason,
    });
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin text-primary text-4xl">⟳</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-black text-white tracking-tight uppercase">
          Auction Logs
        </h2>
        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by player or team name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/60 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-primary/50 focus:bg-slate-900 outline-none transition-all placeholder:text-slate-600"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-900/60 border border-white/5 rounded-xl pl-10 pr-8 py-3 text-sm focus:border-primary/50 focus:bg-slate-900 outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="sold">Sold</option>
            <option value="unsold">Unsold</option>
            <option value="manual">Manual</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      </div>

      <div className="glass-card bg-slate-950/40 border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/60">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-white/5">Player</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-white/5">Team</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-white/5">Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-white/5">Sale Price</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-white/5">Base Price</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-white/5">Bids</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-white/5">Category</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-white/5">Date</th>
                <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-white/5">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {logs.map((log) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`border-b border-white/5 hover:bg-slate-900/40 transition-colors ${log.deleted ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={log.player?.image_url} alt={log.player?.name} className="w-8 h-8 rounded-lg bg-slate-900 object-cover" />
                        <div>
                          <p className="font-display text-sm font-black text-white tracking-wider">{log.player?.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase">{log.player?.playing_role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {log.team ? (
                        <div className="flex items-center gap-3">
                          <img src={log.team?.team_logo_url} alt={log.team?.team_name} className="w-6 h-6 rounded-full bg-slate-900 object-contain p-1" />
                          <p className="font-display text-sm font-black text-white tracking-wider">{log.team?.team_name}</p>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-sm">Unsold</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        log.status === 'sold' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                        log.status === 'unsold' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                        'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      }`}>
                        {log.status}
                        {log.is_manual && <Shield className="w-3 h-3" />}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-display text-sm font-black text-white">
                      {log.sale_price ? `₹${log.sale_price.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 font-display text-sm font-black text-white">
                      ₹{log.base_price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-display text-sm font-black text-white">
                      {log.bid_count}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        log.category === 'A+' ? 'bg-gold/10 text-gold' :
                        log.category === 'A' ? 'bg-primary/10 text-primary' :
                        'bg-slate-700/10 text-slate-300'
                      }`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(log.logged_at).toLocaleDateString()} {new Date(log.logged_at).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {log.deleted ? (
                        <span className="text-slate-500 text-[10px] uppercase">Deleted</span>
                      ) : (
                        <button
                          onClick={() => handleDelete(log)}
                          className="p-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-lg transition-all"
                          title="Delete log entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-4">
                      <FileText className="w-12 h-12 opacity-30" />
                      <p className="font-display text-sm uppercase tracking-[0.2em]">No logs found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {deleteConfirm.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full"
            >
              <div className="flex items-start justify-between mb-6">
                <h3 className="font-display text-xl font-black text-white tracking-tight uppercase">Delete Log Entry</h3>
                <button
                  onClick={() => setDeleteConfirm({ show: false, logId: null, player: null, team: null, reason: '' })}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="bg-slate-950/60 border border-white/5 p-4 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <img src={deleteConfirm.player?.image_url} alt="" className="w-10 h-10 rounded-xl bg-slate-900 object-cover" />
                    <div>
                      <p className="font-display text-sm font-black text-white">{deleteConfirm.player?.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase">{deleteConfirm.team?.team_name || 'Unsold'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed">
                      This will reverse the sale, restore player to available status, and refund team purse.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4 mb-2 block">
                    Reason for deletion
                  </label>
                  <textarea
                    value={deleteConfirm.reason}
                    onChange={(e) => setDeleteConfirm({ ...deleteConfirm, reason: e.target.value })}
                    placeholder="Enter reason for deleting this log entry..."
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-primary/50 focus:bg-slate-900 outline-none transition-all placeholder:text-slate-600 resize-none h-24"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setDeleteConfirm({ show: false, logId: null, player: null, team: null, reason: '' })}
                  className="flex-1 py-4 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={!deleteConfirm.reason.trim() || deleteMutation.isPending}
                  className="flex-1 py-4 rounded-xl bg-destructive text-white hover:bg-destructive/90 transition-all font-black tracking-widest text-sm disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {deleteMutation.isPending ? (
                    <div className="animate-spin text-sm">⟳</div>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Entry
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full"
            >
              <div className="flex items-start justify-between mb-6">
                <h3 className="font-display text-xl font-black text-white tracking-tight uppercase">Export Logs</h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <p className="text-slate-400 text-sm">
                  Export all auction logs as CSV file. The export includes all sold, unsold, and manual sale entries.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="flex-1 py-4 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => exportMutation.mutate()}
                  disabled={exportMutation.isPending}
                  className="flex-1 py-4 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all font-black tracking-widest text-sm disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {exportMutation.isPending ? (
                    <div className="animate-spin text-sm">⟳</div>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Export CSV
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
