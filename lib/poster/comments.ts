export type PosterCommentAnchorType = "region" | "floating" | "header" | "headerSubtitle" | "footer";

export interface PosterCommentAnchorTarget {
  type: PosterCommentAnchorType;
  id: string | null;
}

export type PosterCommentStatus = "open" | "resolved";

export interface PosterCommentRecord {
  id: string;
  posterId: string;
  authorId: string;
  anchor: PosterCommentAnchorTarget;
  body: string;
  status: PosterCommentStatus;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const commentAnchorKey = (anchor: PosterCommentAnchorTarget): string => {
  return `${anchor.type}:${anchor.id ?? ""}`;
};

export const commentAnchorLabel = (anchor: PosterCommentAnchorTarget): string => {
  switch (anchor.type) {
    case "region":
      return anchor.id ? `Region ${anchor.id.slice(0, 8)}` : "Region";
    case "floating":
      return anchor.id ? `Floating ${anchor.id.slice(0, 8)}` : "Floating paragraph";
    case "header":
      return "Header";
    case "headerSubtitle":
      return "Header subtitle";
    case "footer":
      return "Footer";
  }
};

