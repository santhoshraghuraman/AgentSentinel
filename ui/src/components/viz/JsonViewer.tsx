interface JsonViewerProps {
  data: any;
  className?: string;
}

export function JsonViewer({ data, className }: JsonViewerProps) {
  return (
    <pre className={`p-4 rounded-md bg-[#0F1420] border border-border overflow-x-auto text-xs font-mono text-muted-foreground ${className || ''}`}>
      <code className="text-primary">{JSON.stringify(data, null, 2)}</code>
    </pre>
  );
}
