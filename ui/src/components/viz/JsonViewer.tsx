interface JsonViewerProps {
  data: any;
  className?: string;
}

export function JsonViewer({ data, className }: JsonViewerProps) {
  return (
    <pre className={`p-4 rounded-md bg-code-surface border border-border overflow-x-auto text-xs font-mono text-slate-700 ${className || ''}`}>
      <code className="text-slate-800">{JSON.stringify(data, null, 2)}</code>
    </pre>
  );
}
