export function revalidateAuctionViews() {
  // Auction surfaces are client-rendered and stay fresh through Supabase
  // realtime + React Query. Avoiding server cache revalidation keeps admin
  // actions noticeably faster during live bidding.
}
