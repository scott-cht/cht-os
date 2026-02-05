import { cn } from '@/lib/utils/cn';

type ConditionGrade = 'mint' | 'excellent' | 'good' | 'fair' | 'poor';

interface ConditionGradeSelectorProps {
  value: ConditionGrade | null;
  onChange: (value: ConditionGrade) => void;
  required?: boolean;
  className?: string;
}

const conditions: { value: ConditionGrade; label: string; description: string; color: string }[] = [
  {
    value: 'mint',
    label: 'Mint',
    description: 'Like new, no visible wear',
    color: 'emerald',
  },
  {
    value: 'excellent',
    label: 'Excellent',
    description: 'Minor signs of use, fully functional',
    color: 'green',
  },
  {
    value: 'good',
    label: 'Good',
    description: 'Normal wear, works perfectly',
    color: 'amber',
  },
  {
    value: 'fair',
    label: 'Fair',
    description: 'Visible wear, fully functional',
    color: 'orange',
  },
  {
    value: 'poor',
    label: 'Poor',
    description: 'Heavy wear or minor issues',
    color: 'red',
  },
];

const colorStyles: Record<string, { selected: string; unselected: string }> = {
  emerald: {
    selected: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
    unselected: 'border-zinc-200 dark:border-zinc-700 hover:border-emerald-300',
  },
  green: {
    selected: 'border-green-500 bg-green-50 dark:bg-green-900/20',
    unselected: 'border-zinc-200 dark:border-zinc-700 hover:border-green-300',
  },
  amber: {
    selected: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
    unselected: 'border-zinc-200 dark:border-zinc-700 hover:border-amber-300',
  },
  orange: {
    selected: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
    unselected: 'border-zinc-200 dark:border-zinc-700 hover:border-orange-300',
  },
  red: {
    selected: 'border-red-500 bg-red-50 dark:bg-red-900/20',
    unselected: 'border-zinc-200 dark:border-zinc-700 hover:border-red-300',
  },
};

export function ConditionGradeSelector({
  value,
  onChange,
  required = false,
  className,
}: ConditionGradeSelectorProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
        Condition Grade{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="grid grid-cols-5 gap-2">
        {conditions.map((condition) => {
          const isSelected = value === condition.value;
          const styles = colorStyles[condition.color];
          
          return (
            <button
              key={condition.value}
              type="button"
              onClick={() => onChange(condition.value)}
              className={cn(
                'p-3 rounded-lg border-2 text-center transition-all',
                isSelected ? styles.selected : styles.unselected
              )}
            >
              <span className={cn(
                'block text-sm font-medium',
                isSelected ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'
              )}>
                {condition.label}
              </span>
            </button>
          );
        })}
      </div>
      {value && (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {conditions.find(c => c.value === value)?.description}
        </p>
      )}
    </div>
  );
}

// Display-only badge version
export function ConditionGradeBadge({ condition }: { condition: ConditionGrade }) {
  const conditionData = conditions.find(c => c.value === condition);
  
  const badgeColors: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      badgeColors[conditionData?.color || 'emerald']
    )}>
      {conditionData?.label || condition}
    </span>
  );
}
