import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { researchService } from '../api/services';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { 
  RotateCw, 
  Activity, 
  Target, 
  ShieldCheck, 
  TrendingUp
} from 'lucide-react';
import { cn } from '../utils/cn';
import { formatDateTime } from '../utils/datetime';

export function EvaluationPage() {
  const queryClient = useQueryClient();
  const [trainingAlgorithm, setTrainingAlgorithm] = useState<'random_forest' | 'logistic_regression'>('random_forest');

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['researchEvaluation'],
    queryFn: researchService.getEvaluation,
  });

  const trainMutation = useMutation({
    mutationFn: (algo: string) => researchService.trainModel(algo),
    onSuccess: (newMetrics) => {
      queryClient.setQueryData(['researchEvaluation'], newMetrics);
    },
  });

  const handleRetrain = () => {
    trainMutation.mutate(trainingAlgorithm);
  };

  return (
    <div className="flex flex-col gap-5 h-full pb-10">
      {/* Top Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono mb-1">
            <span className="text-slate-400 uppercase tracking-wider font-semibold">RESEARCH & GOVERNANCE</span>
            <span className="text-slate-300">//</span>
            <span className="text-blue-700 font-bold uppercase tracking-tight">MODEL EVALUATION</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Research Model Evaluation</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervised baseline evaluation on empirical agent trajectory benchmarks (ATBench).
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <select 
            value={trainingAlgorithm}
            onChange={(e) => setTrainingAlgorithm(e.target.value as any)}
            className="h-8 rounded-md border border-slate-200 bg-slate-50/50 px-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="random_forest">Random Forest Classifier</option>
            <option value="logistic_regression">Logistic Regression Baseline</option>
          </select>
          <Button 
            onClick={handleRetrain} 
            disabled={trainMutation.isPending}
            className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-1.5 whitespace-nowrap"
          >
            <RotateCw className={cn("h-3.5 w-3.5", trainMutation.isPending && "motion-safe:animate-spin")} />
            <span>{trainMutation.isPending ? 'Training Model...' : 'Retrain Baseline'}</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200">
            Loading research evaluation metrics...
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-mono">
            Error retrieving evaluation metrics. API may be unreachable.
          </div>
        ) : metrics ? (
          <div className="space-y-5">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between items-center text-center">
                <Target className="h-6 w-6 text-blue-500 mb-2" />
                <p className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">Accuracy</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-slate-900">
                    {(metrics.accuracy * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-400">Held-out test split</div>
              </Card>

              <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between items-center text-center">
                <ShieldCheck className="h-6 w-6 text-emerald-600 mb-2" />
                <p className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">Precision</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-emerald-600">
                    {(metrics.precision * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-400">Positive predictive value</div>
              </Card>

              <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between items-center text-center">
                <TrendingUp className="h-6 w-6 text-blue-600 mb-2" />
                <p className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">Recall (Sensitivity)</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-blue-700">
                    {(metrics.recall * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-400">Attack detection rate</div>
              </Card>

              <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between items-center text-center">
                <Activity className="h-6 w-6 text-amber-500 mb-2" />
                <p className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">F1 Score (Balanced)</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-amber-600">
                    {metrics.f1_score.toFixed(4)}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-400">Harmonic mean</div>
              </Card>
            </div>

            {/* Secondary stats row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-slate-200 shadow-xs bg-white">
                <CardHeader className="p-4 pb-2 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-[11px] font-bold font-mono uppercase tracking-wider text-slate-500">
                    Area Under ROC (AUC)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="text-2xl font-extrabold font-mono text-blue-700">{(metrics.roc_auc * 100).toFixed(2)}%</div>
                  <p className="text-[11px] font-mono text-slate-400 mt-1">Separability of benign vs attack trajectories</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-xs bg-white">
                <CardHeader className="p-4 pb-2 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-[11px] font-bold font-mono uppercase tracking-wider text-slate-500">
                    False Positive Rate (FPR)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="text-2xl font-extrabold font-mono text-amber-600">{(metrics.false_positive_rate * 100).toFixed(2)}%</div>
                  <p className="text-[11px] font-mono text-slate-400 mt-1">Benign trajectories flagged as risky</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-xs bg-white">
                <CardHeader className="p-4 pb-2 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-[11px] font-bold font-mono uppercase tracking-wider text-slate-500">
                    False Negative Rate (FNR)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="text-2xl font-extrabold font-mono text-rose-600">{(metrics.false_negative_rate * 100).toFixed(2)}%</div>
                  <p className="text-[11px] font-mono text-slate-400 mt-1">Attack trajectories missed by model</p>
                </CardContent>
              </Card>
            </div>

            {/* Confusion Matrix & Dataset Characteristics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Confusion Matrix */}
              <Card className="border-slate-200 shadow-xs bg-white">
                <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Confusion Matrix
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-[11px] bg-white border-slate-200 text-slate-600">
                      N = {metrics.evaluation_samples}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-1">
                    Empirical classification outcomes on 25% stratified test split.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                      <p className="text-[11px] font-bold font-mono text-emerald-700 uppercase tracking-wider">True Negative (Safe)</p>
                      <p className="text-3xl font-extrabold font-mono text-emerald-600 mt-2">{metrics.confusion_matrix.true_negative}</p>
                      <p className="text-[11px] font-mono text-emerald-600/70 mt-1">Correctly classified safe</p>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-center">
                      <p className="text-[11px] font-bold font-mono text-amber-700 uppercase tracking-wider">False Positive (Type I)</p>
                      <p className="text-3xl font-extrabold font-mono text-amber-600 mt-2">{metrics.confusion_matrix.false_positive}</p>
                      <p className="text-[11px] font-mono text-amber-600/70 mt-1">Safe misclassified as attack</p>
                    </div>

                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-center">
                      <p className="text-[11px] font-bold font-mono text-rose-700 uppercase tracking-wider">False Negative (Type II)</p>
                      <p className="text-3xl font-extrabold font-mono text-rose-600 mt-2">{metrics.confusion_matrix.false_negative}</p>
                      <p className="text-[11px] font-mono text-rose-600/70 mt-1">Attack misclassified as safe</p>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-center">
                      <p className="text-[11px] font-bold font-mono text-blue-700 uppercase tracking-wider">True Positive (Attack)</p>
                      <p className="text-3xl font-extrabold font-mono text-blue-700 mt-2">{metrics.confusion_matrix.true_positive}</p>
                      <p className="text-[11px] font-mono text-blue-700/70 mt-1">Correctly identified attack</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Model Provenance & Dataset Info */}
              <Card className="border-slate-200 shadow-xs bg-white">
                <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Model Provenance & Configuration
                    </CardTitle>
                    <Badge variant="allow" className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[11px] font-mono uppercase tracking-wider font-bold">
                      {metrics.model_type}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-1">
                    Reproducible training parameters and pipeline topology.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-[11px] font-mono">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-bold uppercase tracking-wider">Dataset Source</span>
                    <span className="text-blue-700 font-bold">{metrics.dataset_source}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-bold uppercase tracking-wider">Total Ground Truth Trajectories</span>
                    <span className="text-slate-900 font-bold">{metrics.total_dataset_records}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-bold uppercase tracking-wider">Class Split</span>
                    <span className="text-slate-700">
                      {metrics.class_distribution?.safe_samples} Safe / {metrics.class_distribution?.unsafe_samples} Unsafe
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-bold uppercase tracking-wider">Train / Test Split</span>
                    <span className="text-slate-700">
                      {metrics.training_samples} Train (75%) / {metrics.evaluation_samples} Test (25%)
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-bold uppercase tracking-wider">Random Seed</span>
                    <span className="text-slate-700">{metrics.random_seed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold uppercase tracking-wider">Trained Timestamp</span>
                    <span className="text-slate-700">{formatDateTime(metrics.trained_at)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Feature Importances */}
            {metrics.feature_importances && Object.keys(metrics.feature_importances).length > 0 && (
              <Card className="border-slate-200 shadow-xs bg-white">
                <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-sm font-bold text-slate-900">Ranked Feature Importances</CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-1">
                    Contribution of each behavioral dimension in the trained classifier.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {Object.entries(metrics.feature_importances)
                      .sort(([, a]: any, [, b]: any) => b - a)
                      .slice(0, 10)
                      .map(([feat, imp]: [string, any]) => (
                        <div key={feat} className="space-y-1.5">
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="capitalize text-slate-600 font-bold">{feat.replace(/_/g, ' ')}</span>
                            <span className="font-bold text-blue-700">{(imp * 100).toFixed(2)}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full" 
                              style={{ width: `${Math.min(100, imp * 100 * 2.5)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
