"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/useRealtime';
import {
  FileText, Download, Trash2,
  Filter, Search, ChevronDown, Shield, X,
  AlertCircle
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
  player: AuctionLogPlayer | null;
  team: AuctionLogTeam | null;
}

interface AuctionLogPlayer {
  id: string;
  name: string;
  category: string;
  age?: number | null;
  handy?: string | null;
  phone_number?: string | null;
  image_url: string;
  playing_role: string;
}

interface AuctionLogTeam {
  id: string;
  team_name: string;
  team_logo_url: string;
}

interface AuctionLogSourceRow extends Omit<AuctionLog, 'player' | 'team'> {
  player: AuctionLogPlayer | AuctionLogPlayer[] | null;
  team: AuctionLogTeam | AuctionLogTeam[] | null;
}

interface DeleteConfirmationState {
  show: boolean;
  logId: string | null;
  status: AuctionLog['status'] | null;
  player: AuctionLog['player'] | null;
  team: AuctionLog['team'] | null;
  reason: string;
}

interface TeamFormationRow {
  teamId: string;
  teamName: string;
  captainName: string | null;
  teamLogoUrl: string | null;
  captainImageUrl: string | null;
  category: string;
  playerName: string;
  bidAmount: number;
  age: number | null;
  handy: string | null;
  phoneNumber: string | null;
}

interface TeamFormationSourceRow {
  id: string;
  name: string | null;
  category: string | null;
  age: number | null;
  handy: string | null;
  phone_number: string | null;
  sold_price: number | null;
  sold_to_team_id: string | null;
  team:
    | { id: string; team_name: string; captain_name: string | null; team_logo_url: string | null; captain_image_url: string | null }
    | { id: string; team_name: string; captain_name: string | null; team_logo_url: string | null; captain_image_url: string | null }[]
    | null;
}

const EXPORT_RUNNING_MESSAGE = "It may take a little time, so wait for all the files to be downloaded and then proceed with the auction.";

function unwrapRelation<T,>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value[0] || null;
  }
  return value;
}

function getAuctionStatusLabel(status: AuctionLog['status']) {
  switch (status) {
    case 'sold':
      return 'Confirmed Sale';
    case 'unsold':
      return 'Final Unsold';
    case 'manual':
      return 'Manual Sale';
    default:
      return status;
  }
}

export function AuctionLogs() {
  const queryClient = useQueryClient();
  useRealtimeSubscription('auction_log', ['auction_logs']);
  const [logs, setLogs] = useState<AuctionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sold' | 'unsold' | 'manual'>('all');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmationState>({
    show: false,
    logId: null,
    status: null,
    player: null,
    team: null,
    reason: '',
  });

  const { data: allLogs } = useQuery({
    queryKey: ['auction_logs'],
    queryFn: async () => {
      const { getAuctionLogs } = await import('@/lib/actions/logging');
      const data = await getAuctionLogs(1000, 0);
      const sourceLogs = (data || []) as AuctionLogSourceRow[];
      return sourceLogs.map((log) => ({
        ...log,
        player: unwrapRelation(log.player),
        team: unwrapRelation(log.team),
      }));
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (allLogs) {
      const filtered = allLogs.filter((log) => {
        if (statusFilter !== 'all' && log.status !== statusFilter) {
          return false;
        }
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const playerObj = unwrapRelation(log.player);
          const teamObj = unwrapRelation(log.team);
          const playerName = playerObj?.name;
          const teamName = teamObj?.team_name;
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
    mutationFn: async ({ logId, reason, status }: { logId: string; reason: string; status: AuctionLog['status'] | null }) => {
      const result =
        status === 'unsold'
          ? await (async () => {
              const { deleteLogEntry } = await import('@/lib/actions/logging');
              return deleteLogEntry(logId, reason);
            })()
          : await (async () => {
              const { reverseSale } = await import('@/lib/actions/reverseSale');
              return reverseSale(logId, reason);
            })();

      if (!result.success) {
        throw new Error(result.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction_state'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      queryClient.invalidateQueries({ queryKey: ['recent_bids'] });
      queryClient.invalidateQueries({ queryKey: ['auction_logs'] });
      setDeleteConfirm({ show: false, logId: null, status: null, player: null, team: null, reason: '' });
    },
  });

  const triggerDataUrlDownload = (dataUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const waitForDownloadQueue = async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  };

  const exportLogEntriesWorkbook = async () => {
    const sourceLogs = allLogs || [];
    if (sourceLogs.length === 0) {
      throw new Error('No log entries found to export.');
    }

    const { utils, writeFile } = await import('xlsx');

    const rows = sourceLogs.map((log) => {
      const player = unwrapRelation(log.player);
      const team = unwrapRelation(log.team);

      return {
        'Player Name': player?.name || 'N/A',
        Team: team?.team_name || 'Final Unsold',
        Status: getAuctionStatusLabel(log.status),
        'Sale Price': log.sale_price ?? 0,
        'Base Price': log.base_price,
        'Bid Count': log.bid_count,
        Category: log.category,
        Gender: log.gender,
        'Logged At': new Date(log.logged_at).toLocaleString(),
        'Manual Sale': log.is_manual ? 'Yes' : 'No',
        Deleted: log.deleted ? 'Yes' : 'No',
        'Deleted At': log.deleted_at ? new Date(log.deleted_at).toLocaleString() : '-',
      };
    });

    const workbook = utils.book_new();
    const worksheet = utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 28 },
      { wch: 24 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 22 },
      { wch: 12 },
      { wch: 10 },
      { wch: 22 },
    ];

    utils.book_append_sheet(workbook, worksheet, 'Log Entries');
    writeFile(workbook, 'LOG_ENTRIES.xlsx');
    await waitForDownloadQueue();
  };

  const fetchTeamFormationRows = async (): Promise<TeamFormationRow[]> => {
    const { data, error } = await supabase
      .from('players')
      .select(`
        id,
        name,
        category,
        age,
        handy,
        phone_number,
        sold_price,
        sold_to_team_id,
        team:teams(id, team_name, captain_name, team_logo_url, captain_image_url)
      `)
      .eq('is_sold', true)
      .not('sold_to_team_id', 'is', null)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch team formation data: ${error.message}`);
    }

    const sourceRows = (data || []) as TeamFormationSourceRow[];
    const rows = sourceRows.map((entry) => {
      const team = unwrapRelation<{
        id: string;
        team_name: string;
        captain_name: string | null;
        team_logo_url: string | null;
        captain_image_url: string | null;
      }>(entry.team);

      return {
        teamId: team?.id || entry.sold_to_team_id || 'unknown-team',
        teamName: team?.team_name || 'Unknown Team',
        captainName: team?.captain_name || null,
        teamLogoUrl: team?.team_logo_url || null,
        captainImageUrl: team?.captain_image_url || null,
        category: entry.category || '-',
        playerName: entry.name || '-',
        bidAmount: entry.sold_price || 0,
        age: typeof entry.age === 'number' ? entry.age : null,
        handy: entry.handy || null,
        phoneNumber: entry.phone_number || null,
      };
    });

    return rows;
  };

  const exportTeamFormationPdf = async () => {
    const rows = await fetchTeamFormationRows();
    const { jsPDF } = await import('jspdf');

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });

    const columns = ['Category', 'Player Name', 'Bid Amount', 'Age', 'Handy', 'Phone Number'];
    const columnWidths = [90, 220, 120, 70, 130, 120];
    const marginX = 32;
    const topY = 124;
    const rowHeight = 24;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const generatedAt = new Date().toLocaleString();
    const categoryOrder: Record<string, number> = { 'A+': 0, A: 1, B: 2, C: 3, F: 4 };

    const grouped = rows.reduce<Record<string, { teamName: string; captainName: string | null; teamLogoUrl: string | null; captainImageUrl: string | null; players: TeamFormationRow[] }>>((acc, row) => {
      if (!acc[row.teamId]) {
        acc[row.teamId] = {
          teamName: row.teamName,
          captainName: row.captainName || null,
          teamLogoUrl: row.teamLogoUrl || null,
          captainImageUrl: row.captainImageUrl || null,
          players: [],
        };
      }
      acc[row.teamId].players.push(row);
      return acc;
    }, {});

    const orderedTeams = Object.values(grouped).sort((a, b) => a.teamName.localeCompare(b.teamName));

    const imageCache = new Map<string, string | null>();
    const loadImageAsDataUrl = async (url: string | null | undefined): Promise<string | null> => {
      if (!url) return null;
      if (imageCache.has(url)) return imageCache.get(url) ?? null;

      const dataUrl = await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.referrerPolicy = 'no-referrer';
        const timeout = window.setTimeout(() => resolve(null), 5000);
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 56;
            canvas.height = 56;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              window.clearTimeout(timeout);
              resolve(null);
              return;
            }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            window.clearTimeout(timeout);
            resolve(canvas.toDataURL('image/png'));
          } catch {
            window.clearTimeout(timeout);
            resolve(null);
          }
        };
        img.onerror = () => {
          window.clearTimeout(timeout);
          resolve(null);
        };
        img.src = url;
      });

      imageCache.set(url, dataUrl);
      return dataUrl;
    };

    const drawTeamHeader = async (
      teamName: string,
      captainName: string | null,
      teamLogoUrl: string | null,
      captainImageUrl: string | null,
      isContinuation = false
    ) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(20, 30, 50);
      pdf.text('Team Formation', marginX, 40);

      pdf.setFontSize(14);
      pdf.text(`Team: ${teamName}${isContinuation ? ' (cont.)' : ''}`, marginX, 66);
      pdf.text(`Captain: ${captainName || 'N/A'}`, marginX, 84);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(180, 180, 180);
      pdf.text(`Generated: ${generatedAt}`, marginX, 102);

      const teamLogo = await loadImageAsDataUrl(teamLogoUrl);
      const captainLogo = await loadImageAsDataUrl(captainImageUrl);
      const logoY = 30;
      const rightEdge = pdf.internal.pageSize.getWidth() - 32;
      if (captainLogo) {
        pdf.addImage(captainLogo, 'PNG', rightEdge - 56, logoY, 48, 48);
      } else {
        pdf.setDrawColor(180, 180, 180);
        pdf.rect(rightEdge - 56, logoY, 48, 48);
      }
      if (teamLogo) {
        pdf.addImage(teamLogo, 'PNG', rightEdge - 112, logoY, 48, 48);
      } else {
        pdf.setDrawColor(180, 180, 180);
        pdf.rect(rightEdge - 112, logoY, 48, 48);
      }
    };

    const drawTableHeader = (y: number, widthScale = 1) => {
      let cursorX = marginX;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);

      columns.forEach((column, index) => {
        const width = columnWidths[index] * widthScale;
        pdf.setFillColor(25, 35, 55);
        pdf.rect(cursorX, y, width, rowHeight, 'F');
        pdf.setDrawColor(90, 100, 120);
        pdf.rect(cursorX, y, width, rowHeight);
        pdf.text(column, cursorX + 6, y + 15);
        cursorX += width;
      });

      return y + rowHeight;
    };

    const drawRow = (y: number, row: TeamFormationRow, widthScale = 1) => {
      const values = [
        row.category || '-',
        row.playerName || '-',
        `₹${(row.bidAmount || 0).toLocaleString('en-IN')}`,
        row.age ? String(row.age) : '-',
        row.handy || '-',
        row.phoneNumber || '-',
      ];

      let cursorX = marginX;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(220, 220, 220);

      values.forEach((value, index) => {
        const width = columnWidths[index] * widthScale;
        pdf.setDrawColor(70, 80, 100);
        pdf.rect(cursorX, y, width, rowHeight);
        const lines = pdf.splitTextToSize(String(value), width - 10);
        pdf.text(lines[0] || '-', cursorX + 5, y + 15);
        cursorX += width;
      });

      return y + rowHeight;
    };

    if (orderedTeams.length === 0) {
      await drawTeamHeader('No teams', null, null, null);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.setTextColor(180, 180, 180);
      pdf.text('No purchased players found for team formation export.', marginX, topY + 20);
      pdf.save('Team_Formation.pdf');
      await waitForDownloadQueue();
      return;
    }

    const maxPlayersInTeam = Math.max(...orderedTeams.map((team) => team.players.length), 0);
    const teamsPerPage = maxPlayersInTeam > 8 ? 2 : maxPlayersInTeam > 5 ? 3 : 4;
    const blockGap = 12;
    const topMargin = 18;
    const bottomMargin = 20;
    const usableHeight = pageHeight - topMargin - bottomMargin - blockGap * (teamsPerPage - 1);
    const blockHeight = usableHeight / teamsPerPage;
    const headerSectionHeight = 66;
    const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const widthScale = Math.min(1, (pdf.internal.pageSize.getWidth() - marginX * 2) / tableWidth);

    for (let teamIndex = 0; teamIndex < orderedTeams.length; teamIndex += 1) {
      if (teamIndex > 0 && teamIndex % teamsPerPage === 0) {
        pdf.addPage();
      }

      const team = orderedTeams[teamIndex];
      const blockIndex = teamIndex % teamsPerPage;
      const blockStartY = topMargin + blockIndex * (blockHeight + blockGap);
      const blockEndY = blockStartY + blockHeight;

      pdf.setDrawColor(190, 200, 220);
      pdf.roundedRect(marginX - 8, blockStartY, pdf.internal.pageSize.getWidth() - marginX * 2 + 16, blockHeight, 10, 10);

      const sortedPlayers = [...team.players].sort((a, b) => {
        const categoryDiff = (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99);
        if (categoryDiff !== 0) return categoryDiff;
        return a.playerName.localeCompare(b.playerName);
      });

      const teamLogo = await loadImageAsDataUrl(team.teamLogoUrl);
      const captainLogo = await loadImageAsDataUrl(team.captainImageUrl);
      const logoY = blockStartY + 6;
      if (teamLogo) {
        pdf.addImage(teamLogo, 'PNG', marginX, logoY, 42, 42);
      } else {
        pdf.rect(marginX, logoY, 42, 42);
      }
      if (captainLogo) {
        pdf.addImage(captainLogo, 'PNG', marginX + 48, logoY, 42, 42);
      } else {
        pdf.rect(marginX + 48, logoY, 42, 42);
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(25, 35, 55);
      pdf.text(`Team: ${team.teamName}`, marginX + 100, blockStartY + 22);
      pdf.setFontSize(10);
      pdf.text(`Captain: ${team.captainName || 'N/A'}`, marginX + 100, blockStartY + 39);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(140, 150, 170);
      pdf.text(`Generated: ${generatedAt}`, marginX + 100, blockStartY + 54);

      let cursorY = drawTableHeader(blockStartY + headerSectionHeight, widthScale);
      const maxRows = Math.max(1, Math.floor((blockEndY - cursorY - 12) / rowHeight));
      const visibleRows = sortedPlayers.slice(0, maxRows);

      visibleRows.forEach((row) => {
        cursorY = drawRow(cursorY, row, widthScale);
      });

      const remaining = sortedPlayers.length - visibleRows.length;
      if (remaining > 0 && cursorY + 14 <= blockEndY - 4) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.setTextColor(120, 130, 150);
        pdf.text(`+${remaining} more player(s)`, marginX + 4, cursorY + 12);
      }
    }

    pdf.save('Team_Formation.pdf');
    await waitForDownloadQueue();
  };

  const createFallbackSnapshot = (): HTMLCanvasElement => {
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 1600;
    fallbackCanvas.height = 900;
    const context = fallbackCanvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to generate dashboard snapshot.');
    }

    context.fillStyle = '#020617';
    context.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
    context.fillStyle = '#e2e8f0';
    context.font = 'bold 54px Arial';
    context.fillText('Dashboard Snapshot Unavailable', 90, 170);
    context.font = '28px Arial';
    context.fillStyle = '#94a3b8';
    context.fillText('Cross-origin assets blocked capture in this browser.', 90, 230);
    context.fillText(`Generated: ${new Date().toLocaleString()}`, 90, 280);

    return fallbackCanvas;
  };

  const exportDashboardSnapshot = async () => {
    const { default: html2canvas } = await import('html2canvas');
    const dashboardUrl = `${window.location.origin}/dashboard`;
    const iframe = document.createElement('iframe');
    iframe.src = dashboardUrl;
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '1440px';
    iframe.style.height = '900px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    let canvas: HTMLCanvasElement;

    try {
      document.body.appendChild(iframe);

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Dashboard snapshot timed out.')), 15000);
        iframe.onload = () => {
          window.clearTimeout(timeout);
          resolve();
        };
        iframe.onerror = () => {
          window.clearTimeout(timeout);
          reject(new Error('Dashboard snapshot failed to load.'));
        };
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const iframeDocument = iframe.contentDocument;
      const iframeWindow = iframe.contentWindow;
      const captureTarget =
        iframeDocument?.querySelector<HTMLElement>('[data-dashboard-root]') ||
        iframeDocument?.body;

      if (!captureTarget || !iframeWindow) {
        throw new Error('Unable to access dashboard DOM for snapshot.');
      }

      const dashboardFonts = iframeDocument?.fonts;
      if (dashboardFonts?.ready) {
        await dashboardFonts.ready;
      }

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

      canvas = await html2canvas(captureTarget, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#020617',
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        imageTimeout: 12000,
        windowWidth: iframeWindow.innerWidth,
        windowHeight: iframeWindow.innerHeight,
      });
    } catch (error) {
      console.warn('Dashboard capture failed, using fallback snapshot.', error);
      canvas = createFallbackSnapshot();
    } finally {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }

    const imageUrl = canvas.toDataURL('image/jpeg', 0.92);
    triggerDataUrlDownload(imageUrl, 'Dashboard_Snapshot.jpg');
    await waitForDownloadQueue();
  };

  const exportMutation = useMutation({
    mutationFn: async () => {
      await exportLogEntriesWorkbook();
      await exportTeamFormationPdf();
      await exportDashboardSnapshot();
    },
    onMutate: () => {
      setExportError(null);
    },
    onSuccess: () => {
      setExportError(null);
      setShowExportModal(false);
    },
    onError: (error) => {
      setExportError(error instanceof Error ? error.message : 'Failed to export backup files.');
    },
  });

  const handleDelete = (log: AuctionLog) => {
    if (log.deleted) return;
    setDeleteConfirm({
      show: true,
      logId: log.id,
      status: log.status,
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
      status: deleteConfirm.status,
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
          onClick={() => {
            setExportError(null);
            setShowExportModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <Download className="w-4 h-4" />
          Export Backup
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
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'sold' | 'unsold' | 'manual')}
            className="bg-slate-900/60 border border-white/5 rounded-xl pl-10 pr-8 py-3 text-sm focus:border-primary/50 focus:bg-slate-900 outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="sold">Confirmed Sale</option>
            <option value="unsold">Final Unsold</option>
            <option value="manual">Manual Sale</option>
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
                        <span className="text-slate-500 text-sm">Final Unsold</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        log.status === 'sold' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                        log.status === 'unsold' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                        'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      }`}>
                        {getAuctionStatusLabel(log.status)}
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
                          title={log.status === 'unsold' ? "Delete final unsold entry" : "Reverse sale"}
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
                <h3 className="font-display text-xl font-black text-white tracking-tight uppercase">
                  {deleteConfirm.status === 'unsold' ? 'Delete Final Unsold Entry' : 'Reverse Sale'}
                </h3>
                <button
                  onClick={() => setDeleteConfirm({ show: false, logId: null, status: null, player: null, team: null, reason: '' })}
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
                      <p className="text-[10px] text-slate-400 uppercase">{deleteConfirm.team?.team_name || 'Final Unsold'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed">
                      {deleteConfirm.status === 'unsold'
                        ? 'This will remove the final unsold log entry from reports and history.'
                        : 'This will reverse the sale, restore player to available status, and refund team purse.'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4 mb-2 block">
                    {deleteConfirm.status === 'unsold' ? 'Reason for deleting final unsold entry' : 'Reason for reversal'}
                  </label>
                  <textarea
                    value={deleteConfirm.reason}
                    onChange={(e) => setDeleteConfirm({ ...deleteConfirm, reason: e.target.value })}
                    placeholder={
                      deleteConfirm.status === 'unsold'
                        ? 'Enter reason for deleting this final unsold entry...'
                        : 'Enter reason for reversing this sale...'
                    }
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-primary/50 focus:bg-slate-900 outline-none transition-all placeholder:text-slate-600 resize-none h-24"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setDeleteConfirm({ show: false, logId: null, status: null, player: null, team: null, reason: '' })}
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
                      {deleteConfirm.status === 'unsold' ? 'Delete Final Unsold' : 'Reverse Sale'}
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
                <h3 className="font-display text-xl font-black text-white tracking-tight uppercase">Export Backup</h3>
                <button
                  onClick={() => {
                    if (exportMutation.isPending) return;
                    setShowExportModal(false);
                  }}
                  disabled={exportMutation.isPending}
                  className="text-slate-400 hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <p className="text-slate-400 text-sm">
                  Download full backup in three files:
                </p>
                <ul className="text-xs text-slate-300 space-y-2 list-disc pl-5">
                  <li><span className="font-bold text-white">LOG_ENTRIES.xlsx</span></li>
                  <li><span className="font-bold text-white">Team_Formation.pdf</span></li>
                  <li><span className="font-bold text-white">Dashboard_Snapshot.jpg</span></li>
                </ul>
                {exportError && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-4 py-3 rounded-xl">
                    {exportError}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowExportModal(false)}
                  disabled={exportMutation.isPending}
                  className="flex-1 py-4 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest text-sm disabled:opacity-50 disabled:pointer-events-none"
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
                      Export 3 Files
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {exportMutation.isPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="max-w-lg w-full bg-slate-950 border border-primary/20 rounded-2xl p-6 text-center"
            >
              <div className="flex items-center justify-center mb-4">
                <div className="animate-spin text-primary text-2xl">⟳</div>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                {EXPORT_RUNNING_MESSAGE}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
