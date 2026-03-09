"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { calculateRemainingSeconds, formatTimerDisplay } from "@/lib/services/timer/timerService";

interface TimerState {
  timer_end: string | null;
  is_paused: boolean;
  paused_at: string | null;
  first_bid_timer_seconds: number;
  subsequent_bid_timer_seconds: number;
  initial_timer_seconds: number;
}

interface UseTimerReturn {
  totalSeconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  isRunning: boolean;
  isPaused: boolean;
  pause: () => void;
  resume: () => void;
  start: (initialSeconds?: number) => void;
  isExpired: boolean;
}

/**
 * React hook for managing auction timer with database sync
 *
 * Features:
 * - Server-side timer_end as source of truth
 * - Client-side display with local countdown
 * - Periodic sync (every 5s) to prevent drift
 * - Pause/resume state synchronization
 * - On expiry, dispatches custom event
 */
export function useTimer(): UseTimerReturn {
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const expiryDispatchedRef = useRef(false);

  // Fetch auction state from database
  const { data: auctionState, refetch } = useQuery({
    queryKey: ["auction_state"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auction_state")
        .select(
          "timer_end, is_paused, paused_at, first_bid_timer_seconds, subsequent_bid_timer_seconds, initial_timer_seconds, status"
        )
        .single();

      if (error) throw error;
      return data as unknown as TimerState & { status: string };
    },
    refetchInterval: 5000, // Sync every 5 seconds
    refetchIntervalInBackground: false,
  });

  // Calculate initial remaining seconds from database
  const getInitialRemainingSeconds = useCallback((): number => {
    if (!auctionState?.timer_end) return 0;

    return calculateRemainingSeconds(
      auctionState.timer_end,
      auctionState.is_paused,
      auctionState.paused_at
    );
  }, [auctionState]);

  // Local timer state
  const [localTimer, setLocalTimer] = useState(() => {
    const initial = getInitialRemainingSeconds();
    return formatTimerDisplay(Math.max(0, initial));
  });

  const [isRunning, setIsRunning] = useState(false);

  // Sync timer with database periodically
  useEffect(() => {
    syncIntervalRef.current = setInterval(() => {
      refetch();
    }, 5000); // Sync every 5 seconds

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [refetch]);

  // Local countdown timer
  useEffect(() => {
    if (!auctionState?.timer_end || auctionState.is_paused) {
      setIsRunning(false);
      return;
    }

    setIsRunning(true);

    const interval = setInterval(() => {
      const remaining = getInitialRemainingSeconds();

      if (remaining <= 0) {
        setLocalTimer(formatTimerDisplay(0));
        setIsRunning(false);
        clearInterval(interval);
      } else {
        setLocalTimer(formatTimerDisplay(remaining));
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [auctionState, getInitialRemainingSeconds]);

  // Handle timer expiry
  useEffect(() => {
    if (!auctionState?.timer_end) {
      expiryDispatchedRef.current = false;
      return;
    }

    if (localTimer.totalSeconds === 0 && !expiryDispatchedRef.current) {
      expiryDispatchedRef.current = true;

      // Dispatch custom event for parent component to handle
      if (typeof window !== "undefined") {
        const event = new CustomEvent("timer-expiry", {
          detail: { auctionState },
        });
        window.dispatchEvent(event);
      }

      // Reset expiry flag when timer restarts
      const resetFlag = () => {
        expiryDispatchedRef.current = false;
      };

      if (typeof window !== "undefined") {
        window.addEventListener("timer-restart", resetFlag);

        return () => {
          window.removeEventListener("timer-restart", resetFlag);
        };
      }
    }
  }, [localTimer.totalSeconds, auctionState]);

  // Pause timer
  const pause = useCallback(async () => {
    try {
      const { error } = await supabase.rpc("pause_auction_timer");
      if (error) throw error;

      setIsRunning(false);
      refetch();
    } catch (error) {
      console.error("Failed to pause timer:", error);
    }
  }, [refetch]);

  // Resume timer
  const resume = useCallback(async () => {
    try {
      const { error } = await supabase.rpc("resume_auction_timer");
      if (error) throw error;

      setIsRunning(true);
      refetch();

      // Dispatch restart event to reset expiry flag
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("timer-restart"));
      }
    } catch (error) {
      console.error("Failed to resume timer:", error);
    }
  }, [refetch]);

  // Start timer with optional initial seconds
  const start = useCallback(
    async (initialSeconds?: number) => {
      try {
        const { error } = await supabase.rpc("start_auction_timer", {
          p_initial_seconds: initialSeconds,
        });

        if (error) throw error;

        refetch();

        // Dispatch restart event to reset expiry flag
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("timer-restart"));
        }
      } catch (error) {
        console.error("Failed to start timer:", error);
      }
    },
    [refetch]
  );

  // Check if timer is expired
  const isExpired = !!auctionState?.timer_end && localTimer.totalSeconds <= 0;

  return {
    totalSeconds: localTimer.totalSeconds,
    seconds: localTimer.seconds,
    minutes: localTimer.minutes,
    hours: localTimer.hours,
    days: localTimer.days,
    isRunning,
    isPaused: auctionState?.is_paused || false,
    pause,
    resume,
    start,
    isExpired,
  };
}
