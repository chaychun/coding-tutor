declare module "constrained-editor-plugin" {
  import type * as Monaco from "monaco-editor";

  interface Restriction {
    range: [number, number, number, number];
    label: string;
    allowMultiline?: boolean;
  }

  interface ConstrainedInstance {
    initializeIn(editor: Monaco.editor.IStandaloneCodeEditor): void;
    addRestrictionsTo(model: Monaco.editor.ITextModel, restrictions: Restriction[]): void;
    disposeConstrainer(): void;
  }

  export default function constrainedEditor(monaco: typeof Monaco): ConstrainedInstance;
}
