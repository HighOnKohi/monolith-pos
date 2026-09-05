import { type InputHTMLAttributes, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  const id = useId()

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-primary">
        {label}
      </label>
      <input
        id={id}
        className={[
          'w-full rounded-lg border px-3 py-2 text-sm text-primary',
          'bg-white placeholder:text-muted',
          'transition-colors duration-150',
          error
            ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger'
            : 'border-secondary/30 focus:border-secondary focus:ring-1 focus:ring-secondary/30',
          'outline-none',
          className,
        ].join(' ')}
        {...props}
      />
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : null}
    </div>
  )
}
