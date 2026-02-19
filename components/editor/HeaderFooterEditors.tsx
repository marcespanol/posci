"use client";

import styles from "@/components/editor/header-footer-editors.module.css";
import RichTextMarksEditor from "@/components/editor/tiptap/RichTextMarksEditor";
import { usePosterEditorStore } from "@/lib/store/poster-store";

export default function HeaderFooterEditors() {
  const doc = usePosterEditorStore((state) => state.doc);
  const setHeaderContent = usePosterEditorStore((state) => state.setHeaderContent);
  const setFooterContent = usePosterEditorStore((state) => state.setFooterContent);

  if (!doc) {
    return null;
  }

  return (
    <div className={styles.container}>
      <section>
        <h2 className={styles.sectionTitle}>Header</h2>
        <p className={styles.helper}>Supports bold, italic, and underline only.</p>
        <RichTextMarksEditor content={doc.sections.header.content} onChange={setHeaderContent} />
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Footer</h2>
        <p className={styles.helper}>Single line only. Supports bold, italic, and underline only.</p>
        <RichTextMarksEditor content={doc.sections.footer.content} onChange={setFooterContent} singleLine />
      </section>
    </div>
  );
}
