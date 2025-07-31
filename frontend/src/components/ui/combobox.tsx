"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface ComboboxOption {
  value: string
  label: string
  description?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "选择选项...",
  searchPlaceholder = "搜索...",
  emptyText = "未找到选项",
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (option.description && option.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [options, searchTerm])

  const selectedOption = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-slate-800/50 border-purple-500/30 text-purple-100 hover:bg-slate-700/50 focus:border-purple-400",
            !value && "text-purple-400/50",
            className
          )}
          disabled={disabled}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-slate-800 border-purple-500/30">
        <div className="p-2">
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-700/50 border-purple-500/30 text-purple-100 placeholder-purple-400/50 focus:border-purple-400"
          />
        </div>
        <ScrollArea className="max-h-60">
          <div className="p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-purple-400/70">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-purple-600/20 focus:bg-purple-600/20 text-purple-100",
                    value === option.value && "bg-purple-600/30"
                  )}
                  onClick={() => {
                    onValueChange?.(option.value === value ? "" : option.value)
                    setOpen(false)
                    setSearchTerm("")
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-purple-400/70">
                        {option.description}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}