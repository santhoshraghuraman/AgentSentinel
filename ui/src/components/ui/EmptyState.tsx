import { FileCode2 } from 'lucide-react';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ElementType;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({ 
  title, 
  description, 
  icon: Icon = FileCode2,
  className,
  children
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed bg-card/50", className)}>
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary mb-4">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 mb-6 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {children}
    </div>
  );
}
