export const AUCTION_BID_INCREMENT = 25000;

type AuctionBidState = {
  current_bid_amount?: number | null;
  current_base_price?: number | null;
  current_bid?: number | null;
} | null | undefined;

export function getLiveAuctionBidAmount(state: AuctionBidState): number {
  return state?.current_bid_amount ?? state?.current_base_price ?? state?.current_bid ?? 0;
}

export function getNextAuctionBidAmount(
  state: AuctionBidState,
  increment: number = AUCTION_BID_INCREMENT
): number {
  return getLiveAuctionBidAmount(state) + increment;
}
