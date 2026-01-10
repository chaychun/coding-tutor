"use client";

import { useRef, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";

// Map language names to Monaco language identifiers
const languageMap: Record<string, string> = {
  swift: "swift",
  python: "python",
  typescript: "typescript",
  javascript: "javascript",
  ts: "typescript",
  js: "javascript",
  py: "python",
  java: "java",
  go: "go",
  rust: "rust",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  csharp: "csharp",
  "c#": "csharp",
  ruby: "ruby",
  php: "php",
  html: "html",
  css: "css",
  json: "json",
  sql: "sql",
};

interface CodeEditorProps {
  code: string;
  language: string;
  onChange: (code: string) => void;
  readOnly?: boolean;
  className?: string;
}

export default function CodeEditor({
  code,
  language,
  onChange,
  readOnly = false,
  className = "",
}: CodeEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  // Update editor value when code prop changes
  useEffect(() => {
    if (editorRef.current) {
      const currentValue = editorRef.current.getValue();
      if (currentValue !== code) {
        editorRef.current.setValue(code);
      }
    }
  }, [code]);

  const monacoLanguage = languageMap[language.toLowerCase()] || "plaintext";

  return (
    <div className={`h-full ${className}`}>
      <Editor
        height="100%"
        language={monacoLanguage}
        value={code}
        onChange={(value) => onChange(value || "")}
        onMount={handleEditorMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 16 },
          readOnly,
        }}
      />
    </div>
  );
}
