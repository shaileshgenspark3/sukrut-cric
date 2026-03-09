import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("auction_log")
    .select(
      "id, player_id, team_id, status, sale_price, category, logged_at, deleted, is_manual, player:players(id, name, player_number, image_url, category), team:teams(id, team_name, captain_name, captain_image_url, team_logo_url)"
    )
    .eq("deleted", false)
    .order("logged_at", { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json(data || [], {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
