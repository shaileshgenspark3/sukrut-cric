import { z } from "zod";

/**
 * Calculate remaining seconds accounting for pause state
 * @param timerEnd - Timer expiry timestamp from database
 * @param isPaused - Whether timer is paused
 * @param pausedAt - Timestamp when timer was paused (optional)
 * @returns Remaining seconds (can be negative if expired)
 */
export function calculateRemainingSeconds(
  timerEnd: string | null,
  isPaused: boolean,
  pausedAt?: string | null
): number {
  if (!timerEnd) return 0;

  const endTime = new Date(timerEnd).getTime();
  const now = Date.now();

  if (isPaused && pausedAt) {
    // If paused, use paused_at as the "current" time for calculation
    const pausedTime = new Date(pausedAt).getTime();
    return Math.max(0, Math.floor((endTime - pausedTime) / 1000));
  }

  return Math.max(0, Math.floor((endTime - now) / 1000));
}

/**
 * Format timer display values
 * @param totalSeconds - Total seconds to format
 * @returns Object with days, hours, minutes, seconds, and totalSeconds
 */
export function formatTimerDisplay(totalSeconds: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
} {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
  };
}

/**
 * Check if timer has expired
 * @param timerEnd - Timer expiry timestamp from database
 * @param isPaused - Whether timer is paused
 * @returns true if timer has expired
 */
export function isTimerExpired(
  timerEnd: string | null,
  isPaused: boolean
): boolean {
  if (!timerEnd || isPaused) return false;

  const endTime = new Date(timerEnd).getTime();
  const now = Date.now();

  return endTime <= now;
}

/**
 * Format seconds as MM:SS string
 * @param seconds - Total seconds
 * @returns Formatted string (e.g., "05:30")
 */
export function formatMinutesSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secsValue = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secsValue
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Format seconds as HH:MM:SS string (if hours > 0)
 * @param seconds - Total seconds
 * @returns Formatted string (e.g., "01:05:30" or "05:30")
 */
export function formatHoursMinutesSeconds(seconds: number): string {
  const { hours, minutes, seconds: secsValue } = formatTimerDisplay(seconds);

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secsValue.toString().padStart(2, "0")}`;
  }

  return formatMinutesSeconds(seconds);
}
