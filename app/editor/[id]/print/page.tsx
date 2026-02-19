import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PrintActions from "@/app/editor/[id]/print/print-actions";
import styles from "@/app/editor/[id]/print/print.module.css";
import { renderPosterBlockToHtml, renderTipTapDocToHtml } from "@/lib/poster/render-html";
import type { PosterDoc, PosterFloatingParagraphBlock } from "@/lib/poster/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PosterRow } from "@/lib/supabase/types";

interface PrintPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    autoprint?: string;
  }>;
}

const posterClassName = (doc: PosterDoc): string => {
  if (doc.meta.sizePreset === "A1") {
    return doc.meta.orientation === "landscape" ? styles.a1Landscape : styles.a1Portrait;
  }

  return doc.meta.orientation === "landscape" ? styles.screenLandscape : styles.screenPortrait;
};

export default async function PrintPage({ params, searchParams }: PrintPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const autoprint = query.autoprint === "1";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("posters")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      notFound();
    }

    throw new Error(`Failed to load poster for export: ${error.message}`);
  }

  const poster = data as PosterRow;
  const doc = poster.doc;
  const floatingBlocks = Object.values(doc.blocks).filter(
    (block): block is PosterFloatingParagraphBlock => block.type === "floatingParagraph"
  );

  return (
    <main className={styles.page}>
      <PrintActions autoprint={autoprint} />

      <header className={styles.toolbar}>
        <p className={styles.meta}>
          Export preview for <strong>{poster.title}</strong> (v1 print-friendly HTML). Use browser print dialog to save PDF.
        </p>
        <div className={styles.actions}>
          <Link className={styles.button} href={`/editor/${poster.id}`}>
            Back to editor
          </Link>
          <Link className={styles.button} href={`/editor/${poster.id}/print?autoprint=1`}>
            Print / Save PDF
          </Link>
        </div>
      </header>

      <section className={styles.canvasWrap}>
        <article className={`${styles.poster} ${posterClassName(doc)}`}>
          <header className={`${styles.header} ${styles.rich}`} dangerouslySetInnerHTML={{ __html: renderTipTapDocToHtml(doc.sections.header.content) }} />

          <section className={styles.main}>
            <div className={styles.columns}>
              {doc.sections.main.columnIds.map((columnId) => {
                const column = doc.sections.main.columns[columnId];
                if (!column) {
                  return null;
                }

                return (
                  <div key={column.id} className={styles.column} style={{ flexGrow: column.widthRatio }}>
                    {column.segments.map((segment) => (
                      <section key={segment.id} className={styles.segment}>
                        {segment.blockIds.map((blockId) => {
                          const block = doc.blocks[blockId];
                          if (!block || block.type === "floatingParagraph") {
                            return null;
                          }

                          return (
                            <div
                              key={block.id}
                              className={styles.rich}
                              dangerouslySetInnerHTML={{ __html: renderPosterBlockToHtml(block) }}
                            />
                          );
                        })}
                      </section>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className={styles.floatingLayer}>
              {floatingBlocks.map((block) => (
                <div
                  key={block.id}
                  className={`${styles.floatingBlock} ${styles.rich}`}
                  style={{ left: `${block.position.x}px`, top: `${block.position.y}px` }}
                  dangerouslySetInnerHTML={{ __html: renderPosterBlockToHtml(block) }}
                />
              ))}
            </div>
          </section>

          {doc.meta.footerVisible ? (
            <footer
              className={`${styles.footer} ${styles.rich}`}
              dangerouslySetInnerHTML={{ __html: renderTipTapDocToHtml(doc.sections.footer.content) }}
            />
          ) : null}
        </article>
      </section>
    </main>
  );
}
