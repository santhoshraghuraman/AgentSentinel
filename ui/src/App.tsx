
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from './components/layout/MainLayout';
import { StartupScreen } from './components/layout/StartupScreen';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { TrajectoriesPage } from './pages/TrajectoriesPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { TasksPage } from './pages/TasksPage';
import { DashboardPage } from './pages/DashboardPage';
import { LiveMonitorPage } from './pages/LiveMonitorPage';
import { AgentsPage } from './pages/AgentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DatasetsPage } from './pages/DatasetsPage';
import { ReportsPage } from './pages/ReportsPage';
import { EvaluationPage } from './pages/EvaluationPage';
import { AuditPage } from './pages/AuditPage';
import { DecisionExplorerPage } from './pages/DecisionExplorerPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <StartupScreen>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/monitor" element={<LiveMonitorPage />} />
            <Route path="/live" element={<LiveMonitorPage />} />
            <Route path="/playground" element={<PlaygroundPage />} />
            <Route path="/trajectories" element={<TrajectoriesPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/decision-explorer" element={<DecisionExplorerPage />} />
            <Route path="/datasets" element={<DatasetsPage />} />
            <Route path="/evaluation" element={<EvaluationPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/system/diagnostics" element={<DiagnosticsPage />} />
          </Route>
        </Routes>
        </StartupScreen>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
