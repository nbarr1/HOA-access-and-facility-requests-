import { Badge } from "@/components/Badge";
import type { DuesStatus } from "@/domain/types";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { reconcileBillingStatus } from "@/services/dues-reconciliation-service";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type VantacaReviewRow = {
  id: string;
  external_billing_id: string | null;
  unit_address: string | null;
  resident_name: string | null;
  email: string | null;
  balance: number;
  dues_status: DuesStatus;
  balance_reference: string;
  source: string;
  status: "pending" | "approved" | "ignored" | "error";
  error_message: string | null;
  imported_at: string;
  matched_resident_id: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

async function approveReview(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("vantaca_balance_reviews")
    .select("id,external_billing_id,email,unit_address,balance,dues_status,balance_reference,imported_at,matched_resident_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Vantaca review row not found.");
  if (!data.external_billing_id) throw new Error("Approved Vantaca review requires an external billing ID to reconcile.");

  const result = await reconcileBillingStatus(supabase, {
    externalBillingId: data.external_billing_id,
    duesStatus: data.dues_status,
    balanceReference: data.balance_reference,
    asOf: data.imported_at
  });

  const update = await supabase
    .from("vantaca_balance_reviews")
    .update({
      status: result.status === "error" || result.status === "unmatched" ? "error" : "approved",
      error_message: result.error ?? (result.status === "unmatched" ? "No resident matched this external billing ID." : null),
      reviewed_at: new Date().toISOString()
    })
    .eq("id", id);
  if (update.error) throw update.error;
  revalidatePath("/vantaca");
  revalidatePath("/dashboard");
  revalidatePath("/audit");
}

async function ignoreReview(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("vantaca_balance_reviews")
    .update({ status: "ignored", reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/vantaca");
}

export default async function VantacaPage() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("vantaca_balance_reviews")
    .select("id,external_billing_id,unit_address,resident_name,email,balance,dues_status,balance_reference,source,status,error_message,imported_at,matched_resident_id")
    .order("imported_at", { ascending: false })
    .limit(100);
  const reviews = (data ?? []) as VantacaReviewRow[];
  const pending = reviews.filter((review) => review.status === "pending");

  return <main><section className="hero"><div><h1>Vantaca review queue</h1><p>Imported balances are staged for board review before dues status changes create access tasks.</p></div></section>{error ? <div className="card"><strong>Unable to load Vantaca reviews</strong><p>{error.message}</p></div> : null}<section className="grid"><div className="card"><h2>{pending.length}</h2><p>Pending review</p></div><div className="card"><h2>{reviews.filter((review) => review.matched_resident_id).length}</h2><p>Matched residents</p></div><div className="card"><h2>{reviews.filter((review) => review.status === "error").length}</h2><p>Needs cleanup</p></div></section><h2>Balance imports</h2><table className="table"><thead><tr><th>Status</th><th>Resident</th><th>Unit</th><th>Balance</th><th>Dues</th><th>Imported</th><th>Action</th></tr></thead><tbody>{reviews.map((review) => <tr key={review.id}><td><Badge value={review.status} /></td><td>{review.resident_name ?? "Unknown"}<br /><small>{review.external_billing_id ?? review.email ?? "No billing ID"}</small></td><td>{review.unit_address ?? "Unknown"}</td><td>{formatCurrency(review.balance)}<br /><small>{review.balance_reference || review.source}</small></td><td><Badge value={review.dues_status} /></td><td>{formatTimestamp(review.imported_at)}</td><td>{review.status === "pending" ? <div className="actions"><form action={approveReview}><input type="hidden" name="id" value={review.id} /><button type="submit">Approve</button></form><form action={ignoreReview}><input type="hidden" name="id" value={review.id} /><button type="submit">Ignore</button></form></div> : review.error_message ?? "Reviewed"}</td></tr>)}{reviews.length === 0 ? <tr><td colSpan={7}>No Vantaca imports found. Manual CSV imports and Playwright reads will appear here.</td></tr> : null}</tbody></table></main>;
}
