import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/Auth";
import AQWorlds from "./pages/AQWorlds";
import Chat from "./pages/Chat";
import Spending from "./pages/Spending";
import Analytics from "./pages/Analytics";
import Archived from "./pages/Archived";
import Settings from "./pages/Settings";
import ProtectedRoute from "./components/ProtectedRoute"; // <-- NOVO IMPORT

function Router() {
  return (
    <Switch>
      {/* Rota de Autenticação (Pública) */}
      <Route path={"/auth"} component={AuthPage} />

      {/* Rotas Protegidas (Usam ProtectedRoute) */}
      <ProtectedRoute path={"/"} component={Dashboard} />
      <ProtectedRoute path={"/aqworlds"} component={AQWorlds} />
      <ProtectedRoute path={"/chat"} component={Chat} />
      <ProtectedRoute path={"/spending"} component={Spending} />
      <ProtectedRoute path={"/analytics"} component={Analytics} />
      <ProtectedRoute path={"/archived"} component={Archived} />
      <ProtectedRoute path={"/settings"} component={Settings} />

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
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
