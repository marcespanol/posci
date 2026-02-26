"use client";

import styles from "@/components/editor/header-footer-editors.module.css";
import RichTextMarksEditor from "@/components/editor/tiptap/RichTextMarksEditor";
import { selectPosterReadFooterContent, selectPosterReadHeaderContent } from "@/lib/store/poster-read-selectors";
import { usePosterEditorStore } from "@/lib/store/poster-store";

interface HeaderFooterEditorsProps {
  editable?: boolean;
}

export default function HeaderFooterEditors({ editable = true }: HeaderFooterEditorsProps) {
  const headerContent = usePosterEditorStore(selectPosterReadHeaderContent);
  const footerContent = usePosterEditorStore(selectPosterReadFooterContent);
  const setHeaderContent = usePosterEditorStore((state) => state.setHeaderContent);
  const setFooterContent = usePosterEditorStore((state) => state.setFooterContent);

  if (!headerContent || !footerContent) {
    return null;
  }

  return (
    <div className={styles.container}>
      <section>
        <h2 className={styles.sectionTitle}>Header</h2>
        <p className={styles.helper}>Supports bold, italic, and underline only.</p>
        <RichTextMarksEditor content={headerContent} onChange={setHeaderContent} editable={editable} />
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Footer</h2>
        <p className={styles.helper}>Single line only. Supports bold, italic, and underline only.</p>
        <RichTextMarksEditor content={footerContent} onChange={setFooterContent} singleLine editable={editable} />
      </section>
    </div>
  );
}
