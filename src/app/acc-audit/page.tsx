import { Badge } from "@/components/Badge";
import { Nav } from "@/components/Nav";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type AccRequestRow = {
  id: string;
  submitted_at: string;
  property_address: string;
  unit_address: string | null;
  requester_name: string;
  requester_email: string | null;
  requester_phone: string | null;
  title: string;
  summary: string;
  status: string;
  final_disposition: string | null;
  decided_at: string | null;
};

type AccVoteRow = {
  id: string;
  request_id: string;
  committee_member_id: string;
  voter_profile_id: string;
  vote_value: string;
  comment: string;
  voted_at: string;
  acc_committee_members?: { display_name: string; profile_id: string } | { display_name: string; profile_id: string }[] | null;
};

type CommitteeMemberRow = {
  id: string;
  profile_id: string;
  display_name: string;
  is_active: boolean;
};

type ProfileRow = {
  id: string;
  full_name: string;
  role: "board_admin" | "board_member" | "resident";
};

const voteOptions = ["approve", "deny", "abstain", "needs_more_information"];

function decodeSupabaseCookie(value: string) {
  const decoded = value.startsWith("base64-") ? Buffer.from(value.slice(7), "base64").toString("utf8") : value;
  try {
    const parsed = JSON.parse(decoded) as { access_token?: string } | [string, string];
    return Array.isArray(parsed) ? parsed[0] : parsed.access_token;
  } catch {
    return undefined;
  }
}

async function getCurrentUserId(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const cookieStore = await cookies();
  const token = cookieStore.getAll().map((cookie) => decodeSupabaseCookie(cookie.value)).find(Boolean);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user?.id ?? null;
}

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function memberName(vote: AccVoteRow) {
  const member = Array.isArray(vote.acc_committee_members) ? vote.acc_committee_members[0] : vote.acc_committee_members;
  return member?.display_name ?? "Unknown committee member";
}

async function saveAccVote(formData: FormData) {
  "use server";
  const requestId = String(formData.get("request_id") ?? "");
  const voteValue = String(formData.get("vote_value") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  if (!requestId || !voteOptions.includes(voteValue)) throw new Error("A valid ACC request and vote are required.");

  const supabase = createSupabaseServiceClient();
  const voterProfileId = await getCurrentUserId(supabase);
  if (!voterProfileId) throw new Error("You must be signed in to vote on ACC requests.");
  const [{ data: member, error: memberError }, { data: accRequest, error: requestError }] = await Promise.all([
    supabase.from("acc_committee_members").select("id,profile_id,is_active").eq("profile_id", voterProfileId).eq("is_active", true).maybeSingle(),
    supabase.from("acc_requests").select("id").eq("id", requestId).maybeSingle()
  ]);
  if (memberError) throw memberError;
  if (requestError) throw requestError;
  if (!member) throw new Error("Only active ACC committee members may create or update votes.");
  if (!accRequest) throw new Error("ACC request not found.");

  const { error } = await supabase.from("acc_request_votes").upsert({
    request_id: requestId,
    committee_member_id: member.id,
    voter_profile_id: voterProfileId,
    vote_value: voteValue,
    comment,
    voted_at: new Date().toISOString()
  }, { onConflict: "request_id,committee_member_id" });
  if (error) throw error;
  revalidatePath("/acc-audit");
}

export default async function AccAuditPage() {
  const supabase = createSupabaseServiceClient();
  const currentUserId = await getCurrentUserId(supabase);
  const [requestsResult, votesResult, membersResult, profilesResult] = await Promise.all([
    supabase.from("acc_requests").select("id,submitted_at,property_address,unit_address,requester_name,requester_email,requester_phone,title,summary,status,final_disposition,decided_at").order("submitted_at", { ascending: false }).limit(100),
    supabase.from("acc_request_votes").select("id,request_id,committee_member_id,voter_profile_id,vote_value,comment,voted_at,acc_committee_members(display_name,profile_id)").order("voted_at", { ascending: false }),
    supabase.from("acc_committee_members").select("id,profile_id,display_name,is_active").eq("is_active", true).order("display_name"),
    supabase.from("profiles").select("id,full_name,role").in("role", ["board_admin", "board_member"]).order("full_name")
  ]);
  const loadError = requestsResult.error ?? votesResult.error ?? membersResult.error ?? profilesResult.error;
  const requests = (requestsResult.data ?? []) as AccRequestRow[];
  const votes = (votesResult.data ?? []) as AccVoteRow[];
  const activeMembers = (membersResult.data ?? []) as CommitteeMemberRow[];
  const boardProfiles = (profilesResult.data ?? []) as ProfileRow[];
  const currentCommitteeMember = activeMembers.find((member) => member.profile_id === currentUserId);
  const votesByRequest = new Map<string, AccVoteRow[]>();
  for (const vote of votes) votesByRequest.set(vote.request_id, [...(votesByRequest.get(vote.request_id) ?? []), vote]);

  return <><Nav /><main><section className="hero"><div><h1>ACC audit</h1><p>Review architectural control requests, final dispositions, and committee voting history without loading unrelated dashboard data.</p></div></section>{loadError ? <div className="card"><strong>Unable to load ACC audit data</strong><p>{loadError.message}</p></div> : null}<section className="grid"><div className="card"><h2>{requests.length}</h2><p>ACC requests</p></div><div className="card"><h2>{activeMembers.length}</h2><p>Active committee voters</p></div><div className="card"><h2>{votes.length}</h2><p>Recorded votes</p></div></section><div className="card"><strong>Voting access</strong><p>Signed-in active ACC committee members may create or update their own vote. Board members who are not active committee members can review this page, but vote submissions are rejected by the server action authorization check.</p></div><table className="table"><thead><tr><th>Submitted</th><th>Property / Unit</th><th>Requester / Contact</th><th>Request</th><th>Status</th><th>Disposition</th><th>Decided</th><th>Votes</th></tr></thead><tbody>{requests.map((request) => { const requestVotes = votesByRequest.get(request.id) ?? []; return <tr key={request.id}><td>{formatDate(request.submitted_at)}</td><td>{request.property_address}<br /><small>{request.unit_address ?? "No unit specified"}</small></td><td>{request.requester_name}<br /><small>{request.requester_email ?? "No email"}</small><br /><small>{request.requester_phone ?? "No phone"}</small></td><td><strong>{request.title}</strong><br /><small>{request.summary}</small></td><td><Badge value={request.status} /></td><td>{request.final_disposition ?? "Pending"}</td><td>{formatTimestamp(request.decided_at)}</td><td><div className="actions"><details><summary>{requestVotes.length} vote{requestVotes.length === 1 ? "" : "s"}</summary>{requestVotes.length > 0 ? requestVotes.map((vote) => <div className="card" key={vote.id}><strong>{memberName(vote)}: {vote.vote_value}</strong><p>{vote.comment || "No comment provided."}</p><small>{formatTimestamp(vote.voted_at)}</small></div>) : <p>No votes recorded.</p>}{currentCommitteeMember ? <form action={saveAccVote}><input type="hidden" name="request_id" value={request.id} /><p><strong>Voting as {currentCommitteeMember.display_name}</strong></p><label>Vote<select name="vote_value" defaultValue="approve">{voteOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label>Comment<textarea name="comment" rows={3} /></label><button type="submit">Save my vote</button></form> : <p>View only: sign in as an active ACC committee member to vote.</p>}{boardProfiles.length > activeMembers.length ? <small>Board-only reviewers are intentionally view-only unless they are also active ACC committee members.</small> : null}</details></div></td></tr>; })}{requests.length === 0 ? <tr><td colSpan={8}>No ACC requests found. Add rows to the acc_requests table to populate this audit page.</td></tr> : null}</tbody></table></main></>;
}
