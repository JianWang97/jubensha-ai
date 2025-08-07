import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

// Context for search functionality
interface SelectSearchContextType {
  searchable?: boolean
  searchPlaceholder?: string
  emptyText?: string
  searchTerm: string
  setSearchTerm: (term: string) => void
  filteredChildren: React.ReactNode
}

const SelectSearchContext = React.createContext<SelectSearchContextType | null>(null)

interface SelectProps extends React.ComponentProps<typeof SelectPrimitive.Root> {
  searchable?: boolean
  searchPlaceholder?: string
  emptyText?: string
  children?: React.ReactNode
}

function Select({
  searchable = false,
  searchPlaceholder = "搜索...",
  emptyText = "未找到选项",
  children,
  ...props
}: SelectProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  
  const filteredChildren = React.useMemo(() => {
    if (!searchable || !searchTerm) return children
    
    return React.Children.map(children, (child) => {
      if (React.isValidElement(child) && child.type === SelectContent) {
        const childElement = child as React.ReactElement<any>
        return React.cloneElement(childElement, {
          ...childElement.props,
          children: React.Children.map((childElement.props as any).children as React.ReactNode, (contentChild) => {
            if (React.isValidElement(contentChild) && contentChild.type === SelectItem) {
              const itemText = React.Children.toArray((contentChild.props as any).children as React.ReactNode).join('').toLowerCase()
              if (itemText.includes(searchTerm.toLowerCase())) {
                return contentChild
              }
              return null
            }
            return contentChild
          })
        })
      }
      return child
    })
  }, [children, searchable, searchTerm])
  
  const contextValue = React.useMemo(() => ({
    searchable,
    searchPlaceholder,
    emptyText,
    searchTerm,
    setSearchTerm,
    filteredChildren
  }), [searchable, searchPlaceholder, emptyText, searchTerm, filteredChildren])
  
  return (
    <SelectSearchContext.Provider value={contextValue}>
      <SelectPrimitive.Root data-slot="select" {...props}>
        {filteredChildren}
      </SelectPrimitive.Root>
    </SelectSearchContext.Provider>
  )
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "data-[placeholder]:text-gray-300 [&_svg:not([class*='text-'])]:text-gray-300 text-white focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-slate-700/80 dark:hover:bg-slate-600/80 flex w-fit items-center justify-between gap-2 rounded-md bg-slate-700/80 px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  const context = React.useContext(SelectSearchContext)
  
  const hasVisibleItems = React.useMemo(() => {
    if (!context?.searchable || !context.searchTerm) return true
    
    return React.Children.toArray(children).some(child => 
      React.isValidElement(child) && child.type === SelectItem
    )
  }, [children, context?.searchable, context?.searchTerm])
  
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "bg-slate-700/80 text-white data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md shadow-md",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}
      >
        {context?.searchable && (
          <div className="p-2">
            <Input
              placeholder={context.searchPlaceholder}
              value={context.searchTerm}
              onChange={(e) => context.setSearchTerm(e.target.value)}
              className="h-8 text-sm bg-slate-600/80 border-0 text-white placeholder:text-gray-300"
              autoFocus
            />
          </div>
        )}
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1"
          )}
        >
          {hasVisibleItems ? children : (
            context?.searchable && context.searchTerm && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {context.emptyText}
              </div>
            )
          )}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-slate-600/80 focus:text-white hover:bg-slate-600/50 [&_svg:not([class*='text-'])]:text-gray-300 relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_span:last-child]:flex [&_span:last-child]:items-center [&_span:last-child]:gap-2",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
