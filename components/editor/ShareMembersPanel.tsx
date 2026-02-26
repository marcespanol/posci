"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import styles from "@/components/editor/share-members-panel.module.css";
import {
  addPosterMemberByEmailAction,
  listPosterMembersAction,
  removePosterMemberAction,
  updatePosterMemberRoleAction,
  type PosterMemberListItem
} from "@/app/editor/[id]/member-actions";
import type { PosterMemberRole } from "@/lib/poster/capabilities";

interface ShareMembersPanelProps {
  posterId: string;
  canManageMembers: boolean;
}

const ASSIGNABLE_ROLES: PosterMemberRole[] = ["editor", "commenter", "viewer"];

export default function ShareMembersPanel({ posterId, canManageMembers }: ShareMembersPanelProps) {
  const [members, setMembers] = useState<PosterMemberListItem[]>([]);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<PosterMemberRole>("editor");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  const loadMembers = useCallback(() => {
    setIsLoading(true);
    setErrorMessage(null);
    startTransition(() => {
      void (async () => {
        try {
          const data = await listPosterMembersAction(posterId);
          setMembers(data);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load members");
        } finally {
          setIsLoading(false);
        }
      })();
    });
  }, [posterId]);

  useEffect(() => {
    if (!canManageMembers) {
      setIsLoading(false);
      return;
    }
    loadMembers();
  }, [canManageMembers, loadMembers]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.role === "owner") {
        return -1;
      }
      if (b.role === "owner") {
        return 1;
      }
      return (a.email ?? a.userId).localeCompare(b.email ?? b.userId);
    });
  }, [members]);

  if (!canManageMembers) {
    return (
      <div className={styles.panel}>
        <h3 className={styles.title}>Sharing</h3>
        <p className={styles.helper}>Only the poster owner can manage members.</p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <h3 className={styles.title}>Sharing</h3>
        <button type="button" className={styles.secondaryButton} onClick={loadMembers} disabled={isPending}>
          Refresh
        </button>
      </div>
      <p className={styles.helper}>
        Add collaborators by email. Requires <code>SUPABASE_SERVICE_ROLE_KEY</code> to resolve emails.
      </p>

      <div className={styles.addRow}>
        <input
          type="email"
          className={styles.input}
          placeholder="collaborator@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isPending}
        />
        <select
          className={styles.select}
          value={newRole}
          onChange={(event) => setNewRole(event.target.value as PosterMemberRole)}
          disabled={isPending}
        >
          {ASSIGNABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={isPending || email.trim().length === 0}
          onClick={() => {
            setMessage(null);
            setErrorMessage(null);
            startTransition(() => {
              void (async () => {
                const result = await addPosterMemberByEmailAction({
                  posterId,
                  email,
                  role: newRole
                });

                if (!result.ok) {
                  setErrorMessage(result.message);
                  return;
                }

                setEmail("");
                setMessage("Member added.");
                loadMembers();
              })();
            });
          }}
        >
          Add
        </button>
      </div>

      {message ? <p className={styles.successText}>{message}</p> : null}
      {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

      {isLoading ? <p className={styles.helper}>Loading members...</p> : null}
      {!isLoading && sortedMembers.length === 0 ? <p className={styles.helper}>No members found.</p> : null}

      {!isLoading && sortedMembers.length > 0 ? (
        <ul className={styles.memberList}>
          {sortedMembers.map((member) => (
            <li key={member.userId} className={styles.memberRow}>
              <div className={styles.memberInfo}>
                <strong className={styles.memberEmail}>{member.email ?? member.userId}</strong>
                {member.email ? <span className={styles.memberMeta}>{member.userId}</span> : null}
              </div>
              {member.isOwner ? (
                <span className={styles.ownerBadge}>owner</span>
              ) : (
                <div className={styles.memberActions}>
                  <select
                    className={styles.select}
                    value={member.role}
                    disabled={isPending}
                    onChange={(event) => {
                      const nextRole = event.target.value as PosterMemberRole;
                      setMessage(null);
                      setErrorMessage(null);
                      startTransition(() => {
                        void (async () => {
                          const result = await updatePosterMemberRoleAction({
                            posterId,
                            userId: member.userId,
                            role: nextRole
                          });
                          if (!result.ok) {
                            setErrorMessage(result.message);
                            return;
                          }
                          setMessage("Role updated.");
                          loadMembers();
                        })();
                      });
                    }}
                  >
                    {ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    disabled={isPending}
                    onClick={() => {
                      setMessage(null);
                      setErrorMessage(null);
                      startTransition(() => {
                        void (async () => {
                          const result = await removePosterMemberAction({
                            posterId,
                            userId: member.userId
                          });
                          if (!result.ok) {
                            setErrorMessage(result.message);
                            return;
                          }
                          setMessage("Member removed.");
                          loadMembers();
                        })();
                      });
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
