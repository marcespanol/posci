export type PosterMemberRole = "owner" | "editor" | "commenter" | "viewer";

export interface PosterCapabilities {
  canView: boolean;
  canEdit: boolean;
  canComment: boolean;
  canManageMembers: boolean;
  canTakeOverLock: boolean;
}

export const getPosterCapabilities = (role: PosterMemberRole): PosterCapabilities => {
  switch (role) {
    case "owner":
      return {
        canView: true,
        canEdit: true,
        canComment: true,
        canManageMembers: true,
        canTakeOverLock: true
      };
    case "editor":
      return {
        canView: true,
        canEdit: true,
        canComment: true,
        canManageMembers: false,
        canTakeOverLock: false
      };
    case "commenter":
      return {
        canView: true,
        canEdit: false,
        canComment: true,
        canManageMembers: false,
        canTakeOverLock: false
      };
    case "viewer":
      return {
        canView: true,
        canEdit: false,
        canComment: false,
        canManageMembers: false,
        canTakeOverLock: false
      };
  }
};
