import type { Role } from "@/domain/types";

export function canAccessBoardViews(role: Role | null | undefined) {
  return role === "board_admin" || role === "board_member";
}

export function canManageBoardSettings(role: Role | null | undefined) {
  return role === "board_admin";
}

export function canAccessAccCommitteeViews(role: Role | null | undefined, isAccCommitteeMember: boolean) {
  return canAccessBoardViews(role) || isAccCommitteeMember;
}
