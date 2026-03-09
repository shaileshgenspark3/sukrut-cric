const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function removeFromAuction() {
  try {
    // First, check current state
    const { data: state } = await supabase.from('auction_state').select('*').single();
    console.log('Current state:', state.status, '| Player ID:', state.current_player_id);

    // Get player name
    if (state.current_player_id) {
      const { data: player } = await supabase
        .from('players')
        .select('name')
        .eq('id', state.current_player_id)
        .single();
      console.log('Current player:', player?.name);
    }

    // Reset auction to idle
    const { error } = await supabase.from('auction_state').update({
      status: 'idle',
      current_player_id: null,
      current_base_price: null,
      current_bid_amount: null,
      current_bidder_team_id: null,
      bid_count: 0
    }).eq('id', state.id);

    if (error) {
      console.error('Error:', error.message);
    } else {
      console.log('✅ Player removed from auction - auction state reset to idle');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

removeFromAuction();
