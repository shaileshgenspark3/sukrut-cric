import { revalidatePath } from "next/cache";

export function revalidateAuctionViews() {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/captain");
}
