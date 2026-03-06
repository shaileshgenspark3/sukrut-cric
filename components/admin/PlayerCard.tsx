"use client";

import { motion } from "framer-motion";
import { User, Ruler, Hand, Trophy, Calendar, Star, AlertCircle } from "lucide-react";

interface Player {
  id: string;
  name: string;
  category: string;
  age: number | null;
  height: string | null;
  handy: string | null;
  type: string | null;
  earlier_seasons: string | null;
  achievements: string | null;
  special_remarks: string | null;
  playing_role: string;
  gender: string;
  base_price: number;
  image_url: string | null;
  is_sold?: boolean;
  sold_to_team_id?: string | null;
  sold_price?: number | null;
}

interface PlayerCardProps {
  player: Player;
  basePrice: number;
  showBidInfo?: boolean;
  currentBid?: number;
  bidCount?: number;
  topBidder?: {
    team_name: string;
    captain_name: string;
    team_logo_url?: string;
  } | null;
}

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  "A+": { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
  A: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" },
  B: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" },
  C: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" },
  F: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30" },
};

const BID_INCREMENT = 25000;

export function PlayerCard({
  player,
  basePrice,
  showBidInfo = false,
  currentBid,
  bidCount = 0,
  topBidder = null,
}: PlayerCardProps) {
  const categoryStyle = categoryColors[player.category] || categoryColors["B"];

  // Calculate next bid amount
  const nextBidAmount = (currentBid || basePrice) + BID_INCREMENT;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950" />
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent" />

      <div className="relative z-10 p-6 md:p-8">
        {/* Header - Player Image and Name */}
        <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
          <div className="relative group">
            <div className={`absolute -inset-2 rounded-full blur-xl opacity-50 ${categoryStyle.bg} transition-opacity duration-500`} />
            <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white/10 overflow-hidden bg-slate-900">
              {player.image_url ? (
                <img
                  src={player.image_url}
                  alt={player.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-800">
                  <User className="w-12 h-12 text-slate-600" />
                </div>
              )}
            </div>
          </div>

          <div className="text-center md:text-left">
            {/* Category Badge */}
            <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-3">
              <span
                className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase border ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}
              >
                {player.category} TIER
              </span>
              <span className="px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase bg-blue-500/20 text-blue-400 border-blue-500/30 border">
                {player.gender.toUpperCase()}
              </span>
            </div>

            {/* Player Name - Largest, Bold */}
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-black text-white tracking-tight uppercase leading-none">
              {player.name}
            </h2>

            {/* Playing Role */}
            <p className="text-slate-400 text-sm font-medium mt-2 tracking-wide">
              {player.playing_role}
            </p>
          </div>
        </div>

        {/* Base Price Display */}
        <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em] font-black mb-1">
                {showBidInfo && currentBid ? "Current Bid" : "Base Price"}
              </p>
              <p className="text-4xl md:text-5xl font-display font-black text-white tracking-tighter">
                ₹{(showBidInfo && currentBid ? currentBid : basePrice).toLocaleString()}
              </p>
            </div>

            {showBidInfo && (
              <div className="text-right">
                <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em] font-black mb-1">
                  Bid Increment
                </p>
                <p className="text-xl font-display font-bold text-primary">
                  +₹{BID_INCREMENT.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Bid Count */}
          {showBidInfo && bidCount > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-slate-500 text-xs font-medium">
                Total Bids: <span className="text-white font-bold">{bidCount}</span>
              </p>
            </div>
          )}

          {/* Next Bid Info */}
          {showBidInfo && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-primary text-sm font-medium">
                Next valid bid: <span className="font-bold">₹{nextBidAmount.toLocaleString()}</span>
              </p>
            </div>
          )}

          {/* Top Bidder */}
          {showBidInfo && topBidder && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {topBidder.team_logo_url && (
                    <img
                      src={topBidder.team_logo_url}
                      alt={topBidder.team_name}
                      className="w-8 h-8 rounded-full border border-white/10"
                    />
                  )}
                  <div>
                    <p className="text-gold font-bold text-sm">{topBidder.team_name}</p>
                    <p className="text-slate-500 text-xs">{topBidder.captain_name}</p>
                  </div>
                </div>
                <Trophy className="w-5 h-5 text-gold" />
              </div>
            </div>
          )}
        </div>

        {/* Player Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Age */}
          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-slate-500" />
              <p className="text-slate-500 text-[10px] uppercase tracking-wider font-black">Age</p>
            </div>
            <p className="text-white font-display font-bold text-xl">
              {player.age || "-"} <span className="text-slate-500 text-sm font-normal">yrs</span>
            </p>
          </div>

          {/* Height */}
          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Ruler className="w-4 h-4 text-slate-500" />
              <p className="text-slate-500 text-[10px] uppercase tracking-wider font-black">Height</p>
            </div>
            <p className="text-white font-display font-bold text-xl">
              {player.height || "-"}
            </p>
          </div>

          {/* Handy */}
          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Hand className="w-4 h-4 text-slate-500" />
              <p className="text-slate-500 text-[10px] uppercase tracking-wider font-black">Handy</p>
            </div>
            <p className="text-white font-display font-bold text-lg">
              {player.handy || "-"}
            </p>
          </div>

          {/* Type */}
          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-slate-500" />
              <p className="text-slate-500 text-[10px] uppercase tracking-wider font-black">Type</p>
            </div>
            <p className="text-white font-display font-bold text-lg">
              {player.type || "-"}
            </p>
          </div>
        </div>

        {/* Earlier Seasons */}
        {player.earlier_seasons && (
          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <p className="text-slate-500 text-[10px] uppercase tracking-wider font-black">
                Earlier Seasons
              </p>
            </div>
            <p className="text-white font-medium">{player.earlier_seasons}</p>
          </div>
        )}

        {/* Achievements */}
        {player.achievements && (
          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-slate-500" />
              <p className="text-slate-500 text-[10px] uppercase tracking-wider font-black">
                Achievements
              </p>
            </div>
            <p className="text-white font-medium">{player.achievements}</p>
          </div>
        )}

        {/* Special Remarks */}
        {player.special_remarks && (
          <div className="bg-slate-900/60 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <p className="text-amber-500 text-[10px] uppercase tracking-wider font-black">
                Special Remarks
              </p>
            </div>
            <p className="text-white font-medium">{player.special_remarks}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default PlayerCard;
