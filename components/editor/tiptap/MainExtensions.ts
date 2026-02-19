import { Node } from "@tiptap/core";
import Bold from "@tiptap/extension-bold";
import Heading from "@tiptap/extension-heading";
import Image from "@tiptap/extension-image";
import Italic from "@tiptap/extension-italic";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Underline from "@tiptap/extension-underline";

export const MainDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "block+"
});

export const InlineImage = Image.extend({
  name: "inlineImage",
  group: "inline",
  inline: true,
  draggable: false,
  addAttributes() {
    return {
      ...this.parent?.(),
      inline: {
        default: true
      }
    };
  },
  parseHTML() {
    return [{ tag: 'img[data-inline-image="true"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", { ...HTMLAttributes, "data-inline-image": "true" }];
  }
});

export const mainExtensions = [
  MainDocument,
  Paragraph,
  Text,
  Heading.configure({ levels: [2] }),
  Bold,
  Italic,
  Underline,
  Image,
  InlineImage
];
