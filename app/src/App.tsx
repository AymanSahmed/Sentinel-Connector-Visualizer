import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Boxes, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { AppHeader, type Settings } from '@/components/layout/app-header'
import { SidebarPanels } from '@/components/layout/sidebar-panels'
import { SolutionPicker } from '@/components/layout/solution-picker'
import { ReportView } from '@/components/report/report-view'
import { FlowMap } from '@/components/flow/flow-map'
import { ArtifactTable } from '@/components/artifacts/artifact-table'
import { EmptyState } from '@/components/shared/empty-state'
import { useAnalysis } from '@/hooks/use-analysis'
import { usePersistentState } from '@/hooks/use-persistent-state'
import { useSolutions } from '@/hooks/use-solutions'
import { downloadJson } from '@/lib/format'

function LoadingReport() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-6">
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

export default function App() {
  const [settings, setSettings] = usePersistentState<Settings>('scv.settings', { repo: 'Azure/Azure-Sentinel', branch: 'master' })
  const [token, setToken] = usePersistentState('scv.token', '', 'session')
  const [recent, setRecent] = usePersistentState<string[]>('scv.recent', [])
  const [selected, setSelected] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tab, setTab] = useState('report')

  const catalogue = useSolutions(settings.repo, settings.branch, token)
  const analysis = useAnalysis({ ...settings, token })
  const { run } = analysis

  const choose = useCallback(
    (name: string) => {
      setPickerOpen(false)
      setSelected(name)
      setRecent((r) => [name, ...r.filter((x) => x !== name)].slice(0, 6))
      history.replaceState(null, '', `?solution=${encodeURIComponent(name)}`)
      void run(name)
    },
    [run, setRecent],
  )

  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get('solution')
    if (fromUrl) choose(fromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { result, status } = analysis
  const ready = !!result && status !== 'loading'

  return (
    <div className="bg-background flex h-screen flex-col">
      <AppHeader
        settings={settings}
        onSettingsChange={setSettings}
        token={token}
        onTokenChange={setToken}
        current={selected}
        solutionCount={catalogue.solutions.length}
        status={status}
        progress={analysis.progress}
        phase={analysis.phase}
        rateLimit={analysis.rateLimit}
        onOpenPicker={() => setPickerOpen(true)}
        onVisualize={() => void run(selected)}
        onReloadSolutions={catalogue.reload}
        onExport={() => result && downloadJson(`${result.solution}-insights.json`, result.insights)}
        canExport={!!result}
      />

      <SolutionPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        solutions={catalogue.solutions}
        loading={catalogue.loading}
        recent={recent}
        current={selected}
        onSelect={choose}
      />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="24%" minSize="16%" maxSize="40%" className="bg-card/40">
          <SidebarPanels result={result} status={status} logs={analysis.logs} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="76%" minSize="40%">
          {status === 'error' ? (
            <div className="p-6">
              <EmptyState
                icon={AlertCircle}
                title="Could not analyse this solution"
                description={analysis.error ?? 'Unknown error'}
                action={<Button size="sm" onClick={() => void run(selected)}>Try again</Button>}
              />
            </div>
          ) : !result && status !== 'loading' ? (
            <div className="grid h-full place-items-center p-6">
              <EmptyState
                icon={Boxes}
                title="Pick a solution to visualise"
                description="See how it collects data, which tables it writes, and the detections, workbooks and playbooks it ships."
                action={<Button onClick={() => setPickerOpen(true)} className="gap-1.5"><Search className="size-4" /> Browse solutions</Button>}
                className="max-w-lg"
              />
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="flex h-full min-h-0 flex-col gap-0">
              <div className="bg-background/60 border-b px-4 py-2">
                <TabsList>
                  <TabsTrigger value="report">Report</TabsTrigger>
                  <TabsTrigger value="flow">Flow map</TabsTrigger>
                  <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
                </TabsList>
              </div>
              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
                <TabsContent value="report" className="mt-0">{ready ? <ReportView result={result} /> : <LoadingReport />}</TabsContent>
                <TabsContent value="flow" className="mt-0">{ready ? <FlowMap insights={result.insights} /> : <LoadingReport />}</TabsContent>
                <TabsContent value="artifacts" className="mt-0">{ready ? <ArtifactTable artifacts={result.artifacts} /> : <LoadingReport />}</TabsContent>
              </div>
            </Tabs>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
