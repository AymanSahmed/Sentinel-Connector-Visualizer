import { useEffect, useMemo, useState } from 'react'
import { History, Layers } from 'lucide-react'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * ⌘K / Ctrl+K palette for the solution catalogue: search-as-you-type with fuzzy matching and keyboard navigation.
 */
export function SolutionPicker({
  open,
  onOpenChange,
  solutions,
  loading,
  recent,
  current,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  solutions: string[]
  loading: boolean
  recent: string[]
  current: string
  onSelect: (solution: string) => void
}) {
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])
  const others = useMemo(() => (query ? solutions : solutions.filter((s) => !recent.includes(s))), [solutions, recent, query])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Choose a solution" description="Search the solution catalogue">
      <CommandInput value={query} onValueChange={setQuery} placeholder={`Search ${solutions.length || ''} Microsoft Sentinel solutions…`} />
      <CommandList className="max-h-[60vh]">
        {loading && !solutions.length ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <>
            <CommandEmpty>No solution matches your search.</CommandEmpty>
            {recent.length > 0 && !query && (
              <CommandGroup heading="Recent">
                {recent.map((s) => (
                  <CommandItem key={`recent-${s}`} value={`recent ${s}`} keywords={[s]} onSelect={() => onSelect(s)}>
                    <History className="text-muted-foreground" />
                    <span className="truncate">{s}</span>
                    {s === current && <span className="text-primary ml-auto text-xs">current</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading={`All solutions (${others.length})`}>
              {others.map((s) => (
                <CommandItem key={s} value={s} onSelect={() => onSelect(s)}>
                  <Layers className="text-muted-foreground" />
                  <span className="truncate">{s}</span>
                  {s === current && <span className="text-primary ml-auto text-xs">current</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
