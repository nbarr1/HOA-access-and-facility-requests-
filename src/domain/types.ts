export type Facility = "pool" | "tennis" | "clubhouse";
export type DuesStatus = "paid" | "lapsed" | "unknown";
export type AccessStatus = "pending" | "granted" | "revoked" | "hold";
export type Role = "board_admin" | "board_member" | "resident";
export type Actor = { type: "system"; id: "system" } | { type: "user"; id: string; name: string };

export type Resident = {
  id: string;
  name: string;
  unitAddress: string;
  email: string;
  duesStatus: DuesStatus;
  accessStatus: AccessStatus;
  externalAccessId?: string | null;
  externalBillingId?: string | null;
  lastSyncedAt?: string | null;
  overrideReason?: string | null;
};

export type AuditEntry = {
  actor: Actor;
  action: string;
  targetResidentId?: string;
  reason: string;
  before: unknown;
  after: unknown;
  idempotencyKey: string;
};

export type RequestCategory = "access" | "facilities" | "vendor" | "invoice" | "other";
export type RequestPriority = "urgent" | "high" | "normal" | "low";
export type RequestStatus = "new" | "in_progress" | "done";
export type RequestActionNeeded = "emergency_response" | "access_follow_up" | "facility_repair" | "vendor_follow_up" | "invoice_review" | "board_review";

export type RequestRecord = {
  id: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  action_needed: RequestActionNeeded;
  subject: string;
  from_email: string;
};

export type TriageRequest = {
  fromEmail: string;
  subject: string;
  bodyText: string;
  receivedAt: string;
};

export type AccRequestStatus = "submitted" | "under_review" | "approved" | "denied" | "withdrawn";
export type AccVoteValue = "approve" | "deny" | "abstain";

export type AccRequest = {
  id: string;
  residentId: string | null;
  submittedBy: string | null;
  title: string;
  description: string;
  status: AccRequestStatus;
  decisionReason?: string | null;
  submittedAt: string;
  updatedAt: string;
};

export type AccRequestVote = {
  requestId: string;
  committeeMemberId: string;
  vote: AccVoteValue;
  rationale: string;
  votedAt: string;
};

export type AccCommitteeMember = {
  profileId: string;
  appointedBy?: string | null;
  active: boolean;
  appointedAt: string;
  removedAt?: string | null;
};
