import { createSupabaseServiceClient } from "../src/lib/supabase";

async function main() {
  const supabase = createSupabaseServiceClient();
  const { error: residentsError } = await supabase.from("residents").upsert([
    { name: "Jane Doe", unit_address: "101 Oak Lane", email: "jane@example.com", dues_status: "paid", access_status: "granted", external_access_id: "aa-101", external_billing_id: "va-101" },
    { name: "Sam Rivera", unit_address: "204 Pine Court", email: "sam@example.com", dues_status: "lapsed", access_status: "pending", external_access_id: "aa-204", external_billing_id: "va-204" },
    { name: "Priya Shah", unit_address: "18 Clubhouse Dr", email: "priya@example.com", dues_status: "unknown", access_status: "hold", external_access_id: "aa-018", external_billing_id: "va-018", override_reason: "Board review pending." }
  ], { onConflict: "email" });
  if (residentsError) throw residentsError;

  const { error: requestsError } = await supabase.from("requests").insert([
    { from_email: "lifeguard@example.com", subject: "Pool gate will not latch", body_text: "This is urgent", sanitized_body: "This is urgent", category: "facilities", priority: "urgent" },
    { from_email: "jane@example.com", subject: "Need tennis access after paying dues", body_text: "Can you check my access?", sanitized_body: "Can you check my access?", category: "access", priority: "high" }
  ]);
  if (requestsError) throw requestsError;
}

main().catch((error) => { console.error(error); process.exit(1); });
