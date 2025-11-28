import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/Auth";
import AQWorlds from "./pages/AQWorlds";
import Chat from "./pages/Chat";
import Spending from "./pages/Spending";
import Analytics from "./pages/Analytics";
import Archived from "./pages/Archived";
import Settings from "./pages/Settings";
import Budgets from "./pages/Budgets";
import Bills from "./pages/Bills";
import Insights from "./pages/Insights";
import Goals from "./pages/Goals";
import { withAuth } from "./components/ProtectedRoute";

// Wrap protected pages with authentication
const ProtectedDashboard = withAuth(Dashboard);
const ProtectedAQWorlds = withAuth(AQWorlds);
const ProtectedChat = withAuth(Chat);
const ProtectedSpending = withAuth(Spending);
const ProtectedAnalytics = withAuth(Analytics);
const ProtectedArchived = withAuth(Archived);
const ProtectedSettings = withAuth(Settings);
const ProtectedBudgets = withAuth(Budgets);
const ProtectedBills = withAuth(Bills);
const ProtectedInsights = withAuth(Insights);
const ProtectedGoals = withAuth(Goals);

function Router() {
  return (
    <Switch>
      {/* Rota de Autenticação (Pública) */}
      <Route path={"/auth"} component={AuthPage} />

      {/* Rotas Protegidas */}
      <Route path={"/"} component={ProtectedDashboard} />
      <Route path={"/aqworlds"} component={ProtectedAQWorlds} />
      <Route path={"/chat"} component={ProtectedChat} />
      <Route path={"/spending"} component={ProtectedSpending} />
      <Route path={"/analytics"} component={ProtectedAnalytics} />
      <Route path={"/archived"} component={ProtectedArchived} />
      <Route path={"/settings"} component={ProtectedSettings} />
      <Route path={"/budgets"} component={ProtectedBudgets} />
      <Route path={"/bills"} component={ProtectedBills} />
      <Route path={"/insights"} component={ProtectedInsights} />
      <Route path={"/goals"} component={ProtectedGoals} />

      {/* Rotas de Erro (Públicas) */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
