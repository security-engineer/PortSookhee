import * as React from "react"
import { cn } from "../../lib/utils"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: { value: string; label: string }[];
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, options, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      >
        {options 
          ? options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          : children}
      </select>
    )
  }
)
Select.displayName = "Select"

// 기본 HTML option 엘리먼트 사용
const SelectItem = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement>
>(({ className, ...props }, ref) => (
  <option
    ref={ref}
    className={cn("", className)}
    {...props}
  />
))
SelectItem.displayName = "SelectItem"

// 단순 호환성을 위한 컴포넌트들
const SelectTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>
const SelectValue = ({ children }: { children: React.ReactNode }) => <>{children}</>
const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>

export {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectContent
} 