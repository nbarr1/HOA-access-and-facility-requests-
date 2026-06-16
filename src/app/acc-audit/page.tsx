import { Nav } from "@/components/Nav";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type AccRequestStatus = "approved" | "denied" | "under_review" | "pending" | "new" | "in_progress" | "done" | string;
type VoteValue = "approve" | "approved" | "deny" | "denied" | "abstain" | "missed" | "no_vote" | string | null;

type AccRequestRow = {
  id: string;
  title?: string | null;
  subject?: string | null;
  status: AccRequestStatus | null;
  submitted_at?: string | null;
  received_at?: string | null;
  disposition_at?: string | null;
  decided_at?: string | null;
  quorum_met?: boolean | null;
};

type AccVoteRow = {
  id: string;
  request_id: string | null;
  committee_member_name?: string | null;
  member_name?: string | null;
  voter_name?: string | null;
  vote: VoteValue;
  created_at?: string | null;
};

type CommitteeTrend = {
  name: string;
  totalVotes: number;
  approve: number;
  deny: number;
  abstain: number;
  missed: number;
};

const reviewStatuses = new Set(["under_review", "pending", "new", "in_progress", "review"]);
const approvedStatuses = new Set(["approved", "approve", "accepted"]);
const deniedStatuses = new Set(["denied", "deny", "rejected"]);
const dispositionStatuses = new Set([...approvedStatuses, ...deniedStatuses, "done"]);

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function formatPercent(numerator: number, denominator: number) {
  if (denominator === 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString();
}

function daysBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  return Math.max(0, Math.round((endMs - startMs) / 86_400_000));
}

function requestSubmittedAt(request: AccRequestRow) {
  return request.submitted_at ?? request.received_at ?? null;
}

function requestDispositionAt(request: AccRequestRow) {
  return request.disposition_at ?? request.decided_at ?? null;
}

function requestLabel(request: AccRequestRow) {
  return request.title ?? request.subject ?? `ACC request ${request.id.slice(0, 8)}`;
}

function buildCommitteeTrends(votes: AccVoteRow[]) {
  const trends = new Map<string, CommitteeTrend>();

  for (const vote of votes) {
    const name = vote.committee_member_name ?? vote.member_name ?? vote.voter_name ?? "Unassigned committee member";
    const trend = trends.get(name) ?? { name, totalVotes: 0, approve: 0, deny: 0, abstain: 0, missed: 0 };
    const normalizedVote = normalize(vote.vote);

    if (approvedStatuses.has(normalizedVote)) {
      trend.approve += 1;
      trend.totalVotes += 1;
    } else if (deniedStatuses.has(normalizedVote)) {
      trend.deny += 1;
      trend.totalVotes += 1;
    } else if (normalizedVote === "abstain") {
      trend.abstain += 1;
      trend.totalVotes += 1;
    } else if (["missed", "no_vote", "not_voted", "none"].includes(normalizedVote) || !normalizedVote) {
      trend.missed += 1;
    } else {
      trend.totalVotes += 1;
    }

    trends.set(name, trend);
  }

  return Array.from(trends.values()).sort((a, b) => b.totalVotes - a.totalVotes || a.name.localeCompare(b.name));
}

export default async function AccAuditPage() {
  const supabase = createSupabaseServiceClient();
  const [requestsResult, votesResult] = await Promise.all([
    supabase.from("acc_requests").select("id,title,subject,status,submitted_at,received_at,disposition_at,decided_at,quorum_met").order("submitted_at", { ascending: false }),
    supabase.from("acc_votes").select("id,request_id,committee_member_name,member_name,voter_name,vote,created_at")
  ]);

  const requests = (requestsResult.data ?? []) as AccRequestRow[];
  const votes = (votesResult.data ?? []) as AccVoteRow[];
  const loadError = requestsResult.error ?? votesResult.error;

  const approved = requests.filter((request) => approvedStatuses.has(normalize(request.status)));
  const denied = requests.filter((request) => deniedStatuses.has(normalize(request.status)));
  const underReview = requests.filter((request) => reviewStatuses.has(normalize(request.status)));
  const dispositioned = requests.filter((request) => dispositionStatuses.has(normalize(request.status)));
  const approvalDenialTotal = approved.length + denied.length;
  const durations = dispositioned.map((request) => daysBetween(requestSubmittedAt(request), requestDispositionAt(request))).filter((duration): duration is number => duration !== null);
  const averageDispositionDays = durations.length > 0 ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length) : null;
  const oldestOpen = underReview
    .map((request) => ({ request, submittedAt: requestSubmittedAt(request) }))
    .filter((entry): entry is { request: AccRequestRow; submittedAt: string } => Boolean(entry.submittedAt))
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())[0];
  const requestIdsWithVotes = new Set(votes.filter((vote) => vote.request_id && !["missed", "no_vote", "not_voted", "none", ""].includes(normalize(vote.vote))).map((vote) => vote.request_id));
  const requestsMissingQuorum = requests.filter((request) => request.quorum_met === false);
  const requestsMissingVotes = underReview.filter((request) => !requestIdsWithVotes.has(request.id));
  const committeeTrends = buildCommitteeTrends(votes);

  return <><Nav /><main><section className="hero"><div><h1>ACC audit</h1><p>Review Architectural Control Committee request outcomes, vote participation, and open-decision risks.</p></div></section>{loadError ? <div className="card"><strong>Unable to load ACC audit data</strong><p>{loadError.message}</p></div> : null}<details className="card dashboard-details" open><summary><span>ACC audit dashboard</span><small>{requests.length} total requests</small></summary><section className="grid dashboard-metrics" aria-label="ACC request metrics"><div><strong>{requests.length}</strong><span>Total ACC requests</span></div><div><strong>{approved.length}</strong><span>Approved requests</span></div><div><strong>{denied.length}</strong><span>Denied requests</span></div><div><strong>{underReview.length}</strong><span>Under review</span></div><div><strong>{formatPercent(approved.length, approvalDenialTotal)} / {formatPercent(denied.length, approvalDenialTotal)}</strong><span>Approval / denial rate</span></div><div><strong>{averageDispositionDays === null ? "—" : `${averageDispositionDays} days`}</strong><span>Avg. submission to disposition</span></div><div><strong>{oldestOpen ? requestLabel(oldestOpen.request) : "None"}</strong><span>Oldest open request{oldestOpen ? ` · submitted ${formatDate(oldestOpen.submittedAt)}` : ""}</span></div><div><strong>{requestsMissingQuorum.length}</strong><span>Missing quorum</span></div><div><strong>{requestsMissingVotes.length}</strong><span>Open requests missing votes</span></div></section><h2>Committee voting trends</h2><table className="table"><thead><tr><th>Committee member</th><th>Total votes cast</th><th>Approve</th><th>Deny</th><th>Abstain</th><th>Missed/no vote</th></tr></thead><tbody>{committeeTrends.map((trend) => <tr key={trend.name}><td>{trend.name}</td><td>{trend.totalVotes}</td><td>{trend.approve}</td><td>{trend.deny}</td><td>{trend.abstain}</td><td>{trend.missed}</td></tr>)}{committeeTrends.length === 0 ? <tr><td colSpan={6}>No ACC vote rows found. Committee member trends will appear after votes are recorded.</td></tr> : null}</tbody></table></details><h2>Recent ACC requests</h2><table className="table"><thead><tr><th>Request</th><th>Status</th><th>Submitted</th><th>Disposition</th><th>Quorum</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td>{requestLabel(request)}</td><td>{request.status ?? "Unknown"}</td><td>{formatDate(requestSubmittedAt(request))}</td><td>{formatDate(requestDispositionAt(request))}</td><td>{request.quorum_met === null || request.quorum_met === undefined ? "Not recorded" : request.quorum_met ? "Met" : "Missing"}</td></tr>)}{requests.length === 0 ? <tr><td colSpan={5}>No ACC requests found.</td></tr> : null}</tbody></table></main></>;
}
