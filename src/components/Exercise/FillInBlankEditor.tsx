"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useTheme } from "@/components/theme-provider";
import { languageMap } from "./languageMap";

interface BlankPosition {
  index: number;
  line: number; // 1-based
  startColumn: number; // 1-based
  endColumn: number; // 1-based, exclusive
}

const MIN_BLANK_WIDTH = 3;
// Zero-width space used as an anchor when a blank has no user input yet.
// Without it the decoration range would be zero-width and Monaco wouldn't
// render the after-injected padding that shows the minimum blank width.
const ZWS = "\u200B";

const BLANK_PATTERN = /(?<![_])___(?![_])/g;

/** Parse starterCode to find all ___ positions (exactly 3 underscores, not part of longer runs) */
function findBlanks(code: string): BlankPosition[] {
  const blanks: BlankPosition[] = [];
  const lines = code.split("\n");
  let blankIndex = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    BLANK_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BLANK_PATTERN.exec(line)) !== null) {
      blanks.push({
        index: blankIndex++,
        line: lineIdx + 1,
        startColumn: match.index + 1,
        endColumn: match.index + 4, // ___ is 3 chars
      });
    }
  }
  return blanks;
}

/**
 * Replace every ___ with the corresponding initial value (or a zero-width space
 * anchor when no value exists). Returns the resulting code and adjusted blank ranges.
 */
function buildInitialState(
  starterCode: string,
  blanks: BlankPosition[],
  initialValues?: Record<string, string>
): { code: string; ranges: BlankPosition[] } {
  const lines = starterCode.split("\n");
  const adjustedRanges: BlankPosition[] = [];

  // Group blanks by line for position adjustment
  const blanksByLine = new Map<number, BlankPosition[]>();
  for (const blank of blanks) {
    const lineGroup = blanksByLine.get(blank.line) || [];
    lineGroup.push(blank);
    blanksByLine.set(blank.line, lineGroup);
  }

  for (const [lineNum, lineBlanks] of blanksByLine) {
    let line = lines[lineNum - 1];
    let columnShift = 0;

    for (const blank of lineBlanks) {
      // Use initial value if available, otherwise a zero-width space anchor
      // (ZWS gives the decoration a non-zero range so padding renders)
      const value = initialValues?.[String(blank.index)] || ZWS;
      const adjustedStart = blank.startColumn + columnShift;
      const adjustedEnd = adjustedStart + value.length;

      const beforeBlank = line.substring(0, adjustedStart - 1);
      const afterBlank = line.substring(adjustedStart - 1 + 3); // skip original ___
      line = beforeBlank + value + afterBlank;

      adjustedRanges.push({
        index: blank.index,
        line: lineNum,
        startColumn: adjustedStart,
        endColumn: adjustedEnd,
      });

      columnShift += value.length - 3;
    }

    lines[lineNum - 1] = line;
  }

  // Safety: add blanks not on grouped lines
  for (const blank of blanks) {
    if (!adjustedRanges.find((r) => r.index === blank.index)) {
      adjustedRanges.push(blank);
    }
  }

  adjustedRanges.sort((a, b) => a.index - b.index);
  return { code: lines.join("\n"), ranges: adjustedRanges };
}

interface FillInBlankEditorProps {
  starterCode: string;
  language: string;
  onBlankValuesChange: (blankValues: Record<string, string>) => void;
  initialBlankValues?: Record<string, string>;
}

export default function FillInBlankEditor({
  starterCode,
  language,
  onBlankValuesChange,
  initialBlankValues,
}: FillInBlankEditorProps) {
  const [initError, setInitError] = useState<string | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const constrainedInstanceRef = useRef<any>(null);
  // Tracking collection: range tracking via stickiness (grows with edits), used to read blank values
  const trackingCollectionRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  // Visual collection: rebuilt on each content change for styling + min-width padding
  const visualCollectionRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const blankCountRef = useRef(0);
  const modelListenerRef = useRef<Monaco.IDisposable | null>(null);
  const { resolvedTheme } = useTheme();

  const monacoLanguage = languageMap[language.toLowerCase()] || "plaintext";

  const blanks = findBlanks(starterCode);
  const { code: initialCode, ranges: initialRanges } = buildInitialState(
    starterCode,
    blanks,
    initialBlankValues
  );

  /** Extract current blank values from tracking decoration ranges */
  const extractBlankValues = useCallback(() => {
    const editor = editorRef.current;
    const tracking = trackingCollectionRef.current;
    if (!editor || !tracking) return;

    const model = editor.getModel();
    if (!model) return;

    const values: Record<string, string> = {};
    for (let i = 0; i < blankCountRef.current; i++) {
      const range = tracking.getRange(i);
      if (range) {
        // Strip zero-width space anchor from extracted values
        values[String(i)] = model.getValueInRange(range).replaceAll(ZWS, "");
      }
    }
    onBlankValuesChange(values);
  }, [onBlankValuesChange]);

  const handleEditorMount: OnMount = async (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    blankCountRef.current = blanks.length;

    try {
      const { default: constrainedEditor } = await import("constrained-editor-plugin");
      const instance = constrainedEditor(monaco);
      constrainedInstanceRef.current = instance;
      instance.initializeIn(editor);

      const model = editor.getModel();
      if (!model) {
        console.error("FillInBlankEditor: editor model is null after init");
        instance.disposeConstrainer();
        constrainedInstanceRef.current = null;
        setInitError("Editor failed to initialize");
        return;
      }

      // Set up restriction zones (editable areas, everything else is read-only)
      const restrictions = initialRanges.map((range, idx) => ({
        range: [range.line, range.startColumn, range.line, range.endColumn] as [
          number,
          number,
          number,
          number,
        ],
        label: `blank-${idx}`,
        allowMultiline: false,
      }));
      instance.addRestrictionsTo(model, restrictions);

      // Tracking collection: stable range tracking via stickiness
      const trackingDecorations = initialRanges.map((range) => ({
        range: new monaco.Range(range.line, range.startColumn, range.line, range.endColumn),
        options: {
          stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
        },
      }));
      trackingCollectionRef.current = editor.createDecorationsCollection(trackingDecorations);

      // Visual collection: dynamic styling with min-width padding
      visualCollectionRef.current = editor.createDecorationsCollection([]);

      const updateVisuals = () => {
        const tracking = trackingCollectionRef.current;
        const visual = visualCollectionRef.current;
        if (!tracking || !visual) return;

        const decos: Monaco.editor.IModelDeltaDecoration[] = [];
        for (let i = 0; i < blankCountRef.current; i++) {
          const range = tracking.getRange(i);
          if (!range) continue;
          const rawValue = model.getValueInRange(range);
          const visibleLength = rawValue.replaceAll(ZWS, "").length;
          const padChars = Math.max(0, MIN_BLANK_WIDTH - visibleLength);

          decos.push({
            range,
            options: {
              className: "fill-in-blank-editable",
              ...(padChars > 0
                ? {
                    after: {
                      content: "\u00A0".repeat(padChars),
                      inlineClassName: "fill-in-blank-padding",
                    },
                  }
                : {}),
            },
          });
        }
        visual.set(decos);
      };

      // Listen for content changes directly on the model
      modelListenerRef.current = model.onDidChangeContent(() => {
        requestAnimationFrame(() => {
          updateVisuals();
          extractBlankValues();
        });
      });

      // Focus the first blank
      if (initialRanges.length > 0) {
        editor.setPosition({
          lineNumber: initialRanges[0].line,
          column: initialRanges[0].startColumn,
        });
        editor.focus();
      }

      // Tab / Shift+Tab navigation between blanks
      const jumpToBlank = (ed: Monaco.editor.ICodeEditor, direction: 1 | -1) => {
        const tracking = trackingCollectionRef.current;
        if (!tracking) return;

        const pos = ed.getPosition();
        if (!pos) return;

        let currentIdx = -1;
        for (let i = 0; i < blankCountRef.current; i++) {
          const range = tracking.getRange(i);
          if (range && range.containsPosition(pos)) {
            currentIdx = i;
            break;
          }
        }

        const count = blankCountRef.current;
        const nextIdx = (currentIdx + direction + count) % count;
        const nextRange = tracking.getRange(nextIdx);
        if (nextRange) {
          ed.setPosition({
            lineNumber: nextRange.startLineNumber,
            column: nextRange.startColumn,
          });
        }
      };

      editor.addAction({
        id: "next-blank",
        label: "Jump to next blank",
        keybindings: [monaco.KeyCode.Tab],
        run: (ed) => jumpToBlank(ed, 1),
      });

      editor.addAction({
        id: "prev-blank",
        label: "Jump to previous blank",
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Tab],
        run: (ed) => jumpToBlank(ed, -1),
      });

      // Initial visual update and value extraction
      requestAnimationFrame(() => {
        updateVisuals();
        extractBlankValues();
      });
    } catch (err) {
      console.error("Failed to initialize constrained editor:", err);
      setInitError("Failed to load editor plugin");
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      modelListenerRef.current?.dispose();
      if (constrainedInstanceRef.current) {
        try {
          constrainedInstanceRef.current.disposeConstrainer();
        } catch (e) {
          console.warn("Constrained editor dispose failed (may already be disposed):", e);
        }
      }
    };
  }, []);

  if (initError) {
    return (
      <div className="h-[200px] border-b border-border flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{initError}</p>
      </div>
    );
  }

  return (
    <div className="h-[200px] border-b border-border">
      <Editor
        height="100%"
        language={monacoLanguage}
        defaultValue={initialCode}
        onMount={handleEditorMount}
        theme={resolvedTheme === "dark" ? "vs-dark" : "vs-light"}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 8, bottom: 8 },
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
      />
    </div>
  );
}
