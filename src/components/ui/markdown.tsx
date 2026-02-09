import { marked } from "marked";
import { memo, useId, useMemo } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock, CodeBlockCode, CodeBlockHeader, InlineCode } from "./code-block";
import { MermaidBlock } from "./mermaid-block";
import { ScrollArea } from "./scroll-area";

export type MarkdownProps = {
  children: string;
  id?: string;
  className?: string;
  components?: Partial<Components>;
};

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

function extractLanguage(className?: string): string {
  if (!className) return "";
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : "";
}

const INITIAL_COMPONENTS: Partial<Components> = {
  h1: ({ children }) => <h1 className="text-lg font-semibold mt-6 mb-3 first:mt-0">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="text-base font-semibold mt-5 mb-2.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-4 mb-2 first:mt-0">{children}</h3>,
  h4: ({ children }) => (
    <h4 className="text-xs font-semibold mt-3 mb-1.5 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc ml-5 mb-3 space-y-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal ml-5 mb-3 space-y-1.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary hover:underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/50 pl-4 py-1 my-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line;

    if (isInline) {
      return <InlineCode>{children}</InlineCode>;
    }

    const language = extractLanguage(className);
    const codeString = String(children).replace(/\n$/, "");

    if (language === "mermaid") {
      return <MermaidBlock code={codeString} />;
    }

    return (
      <div className="my-4">
        <CodeBlock>
          <CodeBlockHeader language={language} code={codeString} />
          <CodeBlockCode code={codeString} language={language || "text"} />
        </CodeBlock>
      </div>
    );
  },
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <ScrollArea orientation="horizontal" className="my-4">
      <table className="w-full border-collapse text-xs">{children}</table>
    </ScrollArea>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-border px-3 py-2 font-semibold text-left">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
  hr: () => <hr className="my-6 border-border" />,
};

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string;
    components?: Partial<Components>;
  }) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    );
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content;
  }
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

function MarkdownComponent({
  children,
  id,
  className,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  const generatedId = useId();
  const blockId = id ?? generatedId;
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children]);

  return (
    <div className={className}>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-block-${index}`}
          content={block}
          components={components}
        />
      ))}
    </div>
  );
}

const Markdown = memo(MarkdownComponent);
Markdown.displayName = "Markdown";

export { Markdown };
