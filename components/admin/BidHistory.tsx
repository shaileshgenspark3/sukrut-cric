"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Clock, User } from "lucide-react";
import { Bid } from "@/hooks/useBids";

interface BidHistoryProps {
  bids: Bid[];
  topBids: Bid[];
  historyBids: Bid[];
  currentBidAmount?: number;
}

const rankColors = [
  "bg-gold/20 border-gold/40 text-gold",
  "bg-slate-400/20 border-slate-400/40 text-slate-300",
  "bg-amber-700/20 border-amber-700/40 text-amber-600",
];

const rankBadges = [
  "1ST",
  "2ND",
  "3RD",
];

export function BidHistory({ bids, topBids, historyBids, currentBidAmount }: BidHistoryProps) {
  if (bids.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-8 text-center">
        <Trophy className="w-12 h-12 text-slate-700 mx-auto mb-4" />
        <p className="text-slate-500 font-medium">No bids yet</p>
        <p className="text-slate-600 text-sm mt-1">Waiting for captains to place bids...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top 3 Bids - Prominent Display */}
      {topBids.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500">
            Top Bids
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topBids.map((bid, index) => (
              <motion.div
                key={bid.id}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative p-4 rounded-2xl border-2 ${
                  index === 0
                    ? "bg-gold/10 border-gold/30"
                    : index === 1
                    ? "bg-slate-400/10 border-slate-400/30"
                    : "bg-amber-700/10 border-amber-700/30"
                }`}
              >
                {/* Rank Badge */}
                <div className={`absolute -top-2 -right-2 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  rankColors[index]
                }`}>
                  {rankBadges[index]}
                </div>

                {/* Team Logo */}
                <div className="flex items-center gap-3 mb-3">
                  {bid.team_logo_url ? (
                    <img
                      src={bid.team_logo_url}
                      alt={bid.team_name}
                      className="w-10 h-10 rounded-lg border border-white/10"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-slate-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{bid.team_name}</p>
                    {bid.captain_name && (
                      <p className="text-[10px] text-slate-500 truncate">{bid.captain_name}</p>
                    )}
                  </div>
                </div>

                {/* Bid Amount */}
                <div className="text-center">
                  <p className={`text-2xl font-black tracking-tight ${
                    index === 0 ? "text-gold" : "text-white"
                  }`}>
                    ₹{bid.bid_amount.toLocaleString()}
                  </p>
                </div>

                {/* Timestamp */}
                <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-slate-500">
                  <Clock className="w-3 h-3" />
                  {new Date(bid.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Bid History - 4th onwards */}
      {historyBids.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500">
            Bid History
          </p>
          <div className="bg-slate-900/40 border border-white/5 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/50 sticky top-0">
                <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-3 py-2 text-left font-black">#</th>
                  <th className="px-3 py-2 text-left font-black">Team</th>
                  <th className="px-3 py-2 text-right font-black">Amount</th>
                  <th className="px-3 py-2 text-right font-black">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {historyBids.map((bid, index) => (
                  <motion.tr
                    key={bid.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-3 py-2 text-slate-500 font-medium">
                      {index + 4}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {bid.team_logo_url && (
                          <img
                            src={bid.team_logo_url}
                            alt={bid.team_name}
                            className="w-5 h-5 rounded"
                          />
                        )}
                        <span className="text-slate-300 truncate max-w-[120px]">
                          {bid.team_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-white">
                      ₹{bid.bid_amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500 text-xs">
                      {new Date(bid.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-gold" />
          <span className="text-slate-400 text-sm">
            <span className="font-bold text-white">{bids.length}</span> total bids
          </span>
        </div>
        {currentBidAmount && (
          <div className="text-right">
            <span className="text-slate-500 text-xs uppercase tracking-wider">Current High</span>
            <p className="text-gold font-bold">₹{currentBidAmount.toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BidHistory;
