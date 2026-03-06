"use client";

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  X, User, DollarSign, Shield, AlertTriangle,
  CheckCircle, FilePlus, Search, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { validateManualSale, createManualSale } from '@/lib/actions/manualSales';

interface ManualSaleModalProps {
  show: boolean;
  onClose: () => void;
}

interface Player {
  id: string;
  name: string;
  category: string;
  base_price: number;
  playing_role: string;
  image_url: string;
  gender: string;
}

interface Team {
  id: string;
  team_name: string;
  team_logo_url: string;
}

export function ManualSaleModal({ show, onClose }: ManualSaleModalProps) {
  const queryClient = useQueryClient();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [mode, setMode] = useState<'strict' | 'override'>('strict');
  const [playerSearch, setPlayerSearch] = useState('');
  const [showValidation, setShowValidation] = useState(false);

  const { data: players = [] } = useQuery({
    queryKey: ['available_players'],
    queryFn: async () => {
      const { getAvailablePlayers } = await import('@/lib/actions/manualSales');
      return getAvailablePlayers();
    },
    enabled: show,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, team_name, team_logo_url')
        .order('team_name');

      if (error) {
        throw new Error(`Failed to fetch teams: ${error.message}`);
      }

      return data || [];
    },
    enabled: show,
  });

  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>({ valid: false, errors: [], warnings: [] });

  useEffect(() => {
    if (selectedPlayer) {
      setSalePrice(selectedPlayer.base_price);
    }
  }, [selectedPlayer]);

  useEffect(() => {
    const validate = async () => {
      if (selectedPlayer && selectedTeam) {
        const result = await validateManualSale(
          selectedTeam.id,
          selectedPlayer.id,
          salePrice,
          mode
        );
        setValidation(result);
      }
    };

    const timeoutId = setTimeout(validate, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedPlayer, selectedTeam, salePrice, mode]);

  const manualSaleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlayer || !selectedTeam) return;
      
      const result = await createManualSale(
        selectedPlayer.id,
        selectedTeam.id,
        salePrice,
        mode
      );

      if (!result.success) {
        throw new Error(result.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction_logs'] });
      queryClient.invalidateQueries({ queryKey: ['available_players'] });
      handleClose();
    },
  });

  const handleClose = () => {
    setSelectedPlayer(null);
    setSelectedTeam(null);
    setSalePrice(0);
    setMode('strict');
    setPlayerSearch('');
    setShowValidation(false);
    onClose();
  };

  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(playerSearch.toLowerCase())
  );

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="glass-card bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <FilePlus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-xl font-black text-white tracking-tight uppercase">Manual Sale</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Record player sale outside live auction</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">
                Select Player
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-white/5 rounded-xl pl-12 pr-4 py-4 text-sm focus:border-primary/50 focus:bg-slate-900 outline-none transition-all placeholder:text-slate-600"
                />
              </div>

              {playerSearch && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-950 border border-white/10 rounded-xl max-h-60 overflow-y-auto z-10">
                  {filteredPlayers.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">No players found</div>
                  ) : (
                    filteredPlayers.map((player) => (
                      <div
                        key={player.id}
                        onClick={() => {
                          setSelectedPlayer(player);
                          setPlayerSearch('');
                        }}
                        className="flex items-center gap-3 p-4 hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <img src={player.image_url} alt="" className="w-10 h-10 rounded-lg bg-slate-900 object-cover" />
                        <div className="flex-1">
                          <p className="font-display text-sm font-black text-white">{player.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              player.category === 'A+' ? 'bg-gold/10 text-gold' :
                              player.category === 'A' ? 'bg-primary/10 text-primary' :
                              'bg-slate-700/10 text-slate-300'
                            }`}>
                              {player.category}
                            </span>
                            <span className="text-[10px] text-slate-500">₹{player.base_price.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {selectedPlayer && !playerSearch && (
                <div className="bg-slate-950/60 border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    <img src={selectedPlayer.image_url} alt="" className="w-12 h-12 rounded-xl bg-slate-900 object-cover" />
                    <div className="flex-1">
                      <p className="font-display text-base font-black text-white">{selectedPlayer.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          selectedPlayer.category === 'A+' ? 'bg-gold/10 text-gold' :
                          selectedPlayer.category === 'A' ? 'bg-primary/10 text-primary' :
                          'bg-slate-700/10 text-slate-300'
                        }`}>
                          {selectedPlayer.category}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{selectedPlayer.playing_role}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">
                  Select Team
                </label>
                <div className="relative">
                  <select
                    value={selectedTeam?.id || ''}
                    onChange={(e) => {
                      const team = teams.find((t: Team) => t.id === e.target.value);
                      setSelectedTeam(team || null);
                    }}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-4 text-sm focus:border-primary/50 focus:bg-slate-900 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select a team...</option>
                    {teams.map((team: Team) => (
                      <option key={team.id} value={team.id}>
                        {team.team_name}
                      </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              {selectedTeam && (
                <div className="bg-slate-950/60 border border-white/5 rounded-xl p-4 flex items-center gap-3">
                  <img src={selectedTeam.team_logo_url} alt="" className="w-10 h-10 rounded-full bg-slate-900 object-contain p-1" />
                  <div className="flex-1">
                    <p className="font-display text-base font-black text-white">{selectedTeam.team_name}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">
                Sale Price
              </label>
              <input
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(parseInt(e.target.value) || 0)}
                min={selectedPlayer?.base_price || 0}
                className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-4 text-sm focus:border-primary/50 focus:bg-slate-900 outline-none transition-all"
              />
              {selectedPlayer && (
                <p className="text-[10px] text-slate-500 uppercase tracking-wider ml-4">
                  Base Price: ₹{selectedPlayer.base_price.toLocaleString()}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">
                Validation Mode
              </label>
              <div className="flex gap-4">
                <button
                  onClick={() => setMode('strict')}
                  className={`flex-1 p-4 rounded-xl border transition-all ${
                    mode === 'strict'
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-slate-950/60 border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <div className="text-left">
                      <p className="font-display text-sm font-bold uppercase">Strict</p>
                      <p className="text-[10px] opacity-80">Enforce all validation</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setMode('override')}
                  className={`flex-1 p-4 rounded-xl border transition-all ${
                    mode === 'override'
                      ? 'bg-destructive/10 border-destructive/30 text-destructive'
                      : 'bg-slate-950/60 border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <div className="text-left">
                      <p className="font-display text-sm font-bold uppercase">Override</p>
                      <p className="text-[10px] opacity-80">Bypass validation</p>
                    </div>
                  </div>
                </button>
              </div>

              {mode === 'override' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-500 leading-relaxed">
                    Override mode will bypass all validation rules. This action will be recorded in the audit trail.
                  </p>
                </div>
              )}
            </div>

            {showValidation && (
              <div className={`p-4 rounded-xl flex flex-col gap-3 ${
                validation.valid
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-destructive/10 border border-destructive/20'
              }`}>
                {validation.valid ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <p className="font-display text-sm font-black text-green-500 uppercase">Valid</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {validation.errors.map((error, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-destructive">{error}</p>
                      </div>
                    ))}
                  </div>
                )}

                {validation.warnings.length > 0 && (
                  <div className="space-y-2">
                    {validation.warnings.map((warning, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-500">{warning}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button
                onClick={handleClose}
                className="flex-1 py-4 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => manualSaleMutation.mutate()}
                disabled={!selectedPlayer || !selectedTeam || !validation.valid || manualSaleMutation.isPending}
                className="flex-1 py-4 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all font-black tracking-widest text-sm disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {manualSaleMutation.isPending ? (
                  <div className="animate-spin text-sm">⟳</div>
                ) : (
                  <>
                    <FilePlus className="w-4 h-4" />
                    Record Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
