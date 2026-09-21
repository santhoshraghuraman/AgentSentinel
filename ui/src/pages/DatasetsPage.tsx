import { useQuery } from '@tanstack/react-query';
import { researchService } from '../api/services';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { FileCode, HardDrive, Hash, Layers } from 'lucide-react';

export function DatasetsPage() {
  const { data: datasets, isLoading, error } = useQuery({
    queryKey: ['researchDatasets'],
    queryFn: researchService.getDatasets,
  });

  return (
    <div className="flex flex-col gap-5 h-full pb-10">
      {/* Top Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono mb-1">
            <span className="text-slate-400 uppercase tracking-wider font-semibold">RESEARCH & GOVERNANCE</span>
            <span className="text-slate-300">//</span>
            <span className="text-blue-700 font-bold uppercase tracking-tight">CORPUS</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Datasets & Benchmark Corpus</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Verified empirical agent trajectory corpora supporting research baseline modeling and forensic analysis.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200">
            Loading datasets metadata...
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-mono">
            Error loading datasets from research service. API may be unreachable.
          </div>
        ) : datasets ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {datasets.map((ds: any) => (
              <Card key={ds.id} className="flex flex-col bg-white border-slate-200 shadow-xs rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
                <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <FileCode className="h-5 w-5 text-blue-600" />
                        {ds.name}
                      </CardTitle>
                      <Badge variant="outline" className="mt-2 font-mono text-[11px] bg-white border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
                        {ds.role}
                      </Badge>
                    </div>
                    <Badge variant="allow" className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[11px] font-mono font-bold uppercase tracking-wider">
                      {ds.format}
                    </Badge>
                  </div>
                  <CardDescription className="mt-3 text-xs text-slate-600 font-medium leading-relaxed">
                    {ds.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-5 space-y-4">
                  <div className="bg-white rounded-lg p-3 space-y-2 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-wider">
                        <HardDrive className="w-3.5 h-3.5 text-slate-400" /> Source Path
                      </span>
                      <span className="text-slate-900 truncate max-w-[240px]" title={ds.source_path}>
                        {ds.source_path}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-wider">
                        <Layers className="w-3.5 h-3.5 text-slate-400" /> File Size
                      </span>
                      <span className="text-slate-900">
                        {(ds.size_bytes / (1024 * 1024)).toFixed(2)} MB <span className="text-slate-400">({ds.size_bytes.toLocaleString()} bytes)</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-wider">
                        <Hash className="w-3.5 h-3.5 text-slate-400" /> SHA-256
                      </span>
                      <span className="text-slate-500 truncate max-w-[240px]" title={ds.sha256}>
                        {ds.sha256}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                      <p className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">Trajectories</p>
                      <p className="text-2xl font-extrabold font-mono text-slate-900 mt-1">{ds.trajectory_count.toLocaleString()}</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center flex flex-col justify-center">
                      <p className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">ML Target</p>
                      <p className="text-[11px] font-bold font-mono text-blue-700 mt-2">{ds.ml_model_target}</p>
                    </div>
                  </div>

                  {ds.label_distribution && (
                    <div className="pt-2">
                      <p className="text-[11px] uppercase font-bold text-slate-500 tracking-wider mb-2">Class Distribution</p>
                      <div className="bg-white rounded-lg p-3 space-y-2 border border-slate-200 text-[11px] font-mono shadow-sm">
                        {Object.entries(ds.label_distribution).map(([lbl, count]: any) => (
                          <div key={lbl} className="flex justify-between items-center border-b border-slate-100 last:border-0 pb-1.5 last:pb-0">
                            <span className="capitalize text-slate-600 font-semibold">{lbl.replace('_', ' ')}</span>
                            <span className="font-bold text-slate-900">{count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
