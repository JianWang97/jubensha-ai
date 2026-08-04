import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-6 text-center",
      className
    )}>
      {icon && (
        <div className="mb-4 text-5xl text-brass">
          {icon}
        </div>
      )}
      <h3 className="font-dossier text-lg font-semibold text-paper mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-mist max-w-sm mb-6">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 bg-brass/10 border border-brass/40 text-brass hover:bg-brass/20 text-sm font-medium rounded-sm transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
