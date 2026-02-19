import Link from "next/link";
import { redirect } from "next/navigation";

import styles from "@/app/dashboard/dashboard.module.css";
import { createPosterAction, signOutAction } from "@/app/dashboard/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PosterListItem } from "@/lib/supabase/types";

const formatDate = (value: string): string => {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("posters")
    .select("id,title,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch posters: ${error.message}`);
  }

  const posters: PosterListItem[] = data ?? [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your Posters</h1>
        <div className={styles.actions}>
          <form>
            <button className={`${styles.button} ${styles.primary}`} formAction={createPosterAction} type="submit">
              Create poster
            </button>
          </form>
          <form>
            <button className={styles.button} formAction={signOutAction} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {posters.length === 0 ? <p>No posters yet. Create your first poster.</p> : null}

      <ul className={styles.list}>
        {posters.map((poster) => (
          <li key={poster.id} className={styles.card}>
            <div>
              <p className={styles.cardTitle}>{poster.title}</p>
              <p className={styles.meta}>Updated {formatDate(poster.updated_at)}</p>
            </div>
            <Link className={styles.link} href={`/editor/${poster.id}`}>
              Open editor
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
