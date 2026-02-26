"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import styles from "@/components/editor/comments-panel.module.css";
import {
  createPosterCommentAction,
  listPosterCommentsAction,
  updatePosterCommentStatusAction
} from "@/app/editor/[id]/comment-actions";
import {
  commentAnchorKey,
  commentAnchorLabel,
  type PosterCommentAnchorTarget,
  type PosterCommentRecord
} from "@/lib/poster/comments";

interface CommentsPanelProps {
  posterId: string;
  canComment: boolean;
  commentMode: boolean;
  selectedAnchor: PosterCommentAnchorTarget | null;
  onToggleCommentMode: () => void;
  onClearSelectedAnchor: () => void;
  onCommentsUpdated?: (comments: PosterCommentRecord[]) => void;
}

export default function CommentsPanel({
  posterId,
  canComment,
  commentMode,
  selectedAnchor,
  onToggleCommentMode,
  onClearSelectedAnchor,
  onCommentsUpdated
}: CommentsPanelProps) {
  const [comments, setComments] = useState<PosterCommentRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadComments = useCallback(() => {
    setIsLoading(true);
    setErrorMessage(null);
    startTransition(() => {
      void (async () => {
        try {
          const rows = await listPosterCommentsAction(posterId);
          setComments(rows);
          onCommentsUpdated?.(rows);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load comments");
        } finally {
          setIsLoading(false);
        }
      })();
    });
  }, [onCommentsUpdated, posterId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const filteredComments = useMemo(() => {
    const statusFiltered = comments.filter((comment) => (showResolved ? true : comment.status === "open"));
    if (!selectedAnchor) {
      return statusFiltered;
    }

    const selectedKey = commentAnchorKey(selectedAnchor);
    return statusFiltered.filter((comment) => commentAnchorKey(comment.anchor) === selectedKey);
  }, [comments, selectedAnchor, showResolved]);

  const selectedAnchorKey = selectedAnchor ? commentAnchorKey(selectedAnchor) : null;

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <h3 className={styles.title}>Comments</h3>
        <button type="button" className={styles.secondaryButton} onClick={loadComments} disabled={isPending}>
          Refresh
        </button>
      </div>

      <div className={styles.modeRow}>
        <button
          type="button"
          className={`${styles.toggleButton} ${commentMode ? styles.toggleButtonActive : ""}`}
          onClick={onToggleCommentMode}
          disabled={!canComment}
        >
          {commentMode ? "Comment mode on" : "Comment mode off"}
        </button>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(event) => setShowResolved(event.target.checked)}
          />
          Show resolved
        </label>
      </div>

      {!canComment ? <p className={styles.helper}>You can view comments but cannot add or resolve them.</p> : null}

      <div className={styles.anchorBox}>
        <div className={styles.anchorHeader}>
          <span className={styles.anchorLabel}>Selected anchor</span>
          {selectedAnchor ? (
            <button type="button" className={styles.linkButton} onClick={onClearSelectedAnchor}>
              Clear
            </button>
          ) : null}
        </div>
        <p className={styles.anchorValue}>
          {selectedAnchor ? commentAnchorLabel(selectedAnchor) : "No anchor selected. Enable comment mode and click a region, floating block, header, or footer."}
        </p>
        {selectedAnchor ? <p className={styles.helper}>Showing comments filtered to the selected anchor.</p> : null}
      </div>

      <div className={styles.composeBox}>
        <textarea
          className={styles.textarea}
          rows={4}
          placeholder={canComment ? "Write a comment…" : "Read-only comments"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!canComment || isPending}
        />
        <button
          type="button"
          className={styles.primaryButton}
          disabled={!canComment || isPending || !selectedAnchor || draft.trim().length === 0}
          onClick={() => {
            if (!selectedAnchor) {
              return;
            }
            setMessage(null);
            setErrorMessage(null);
            startTransition(() => {
              void (async () => {
                const result = await createPosterCommentAction({
                  posterId,
                  anchor: selectedAnchor,
                  body: draft
                });
                if (!result.ok) {
                  setErrorMessage(result.message);
                  return;
                }
                setDraft("");
                setMessage("Comment added.");
                loadComments();
              })();
            });
          }}
        >
          Add comment
        </button>
      </div>

      {message ? <p className={styles.successText}>{message}</p> : null}
      {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

      {isLoading ? <p className={styles.helper}>Loading comments…</p> : null}
      {!isLoading && filteredComments.length === 0 ? (
        <p className={styles.helper}>{selectedAnchor ? "No comments for the selected anchor." : "No comments yet."}</p>
      ) : null}

      {!isLoading && filteredComments.length > 0 ? (
        <ul className={styles.commentList}>
          {filteredComments.map((comment) => {
            const isSelectedAnchor = selectedAnchorKey === commentAnchorKey(comment.anchor);
            return (
              <li
                key={comment.id}
                className={`${styles.commentRow} ${isSelectedAnchor ? styles.commentRowSelectedAnchor : ""}`}
              >
                <div className={styles.commentMetaRow}>
                  <span className={styles.anchorChip}>{commentAnchorLabel(comment.anchor)}</span>
                  <span className={styles.statusChip}>{comment.status}</span>
                </div>
                <p className={styles.commentBody}>{comment.body}</p>
                <div className={styles.commentFooter}>
                  <span className={styles.authorText}>{comment.authorId}</span>
                  <span className={styles.authorText}>{new Date(comment.createdAt).toLocaleString()}</span>
                  {canComment ? (
                    <button
                      type="button"
                      className={styles.linkButton}
                      disabled={isPending}
                      onClick={() => {
                        startTransition(() => {
                          void (async () => {
                            const result = await updatePosterCommentStatusAction({
                              commentId: comment.id,
                              status: comment.status === "open" ? "resolved" : "open"
                            });
                            if (!result.ok) {
                              setErrorMessage(result.message);
                              return;
                            }
                            setMessage(comment.status === "open" ? "Comment resolved." : "Comment reopened.");
                            loadComments();
                          })();
                        });
                      }}
                    >
                      {comment.status === "open" ? "Resolve" : "Reopen"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
