// =============================================================================
// Campus Arena — App Shell with Animated Page Transitions
// =============================================================================

import React from "react";
import { animated, useTransition } from "@react-spring/web";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminPortal from "./pages/AdminPortal";
import AdminNotifications from "./pages/AdminNotifications";
import FormBuilder from "./pages/FormBuilder";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ProfilePage from "./pages/ProfilePage";

/** Map of location -> background for transitions */
function usePageTransition() {
  const [location] = useLocation();

  const transitions = useTransition(location, {
    from: { opacity: 0, transform: "translateY(18px)" },
    enter: { opacity: 1, transform: "translateY(0px)" },
    leave: { opacity: 0, transform: "translateY(-12px)", position: "absolute" as const, width: "100%", top: 0, left: 0 },
    config: { tension: 280, friction: 32 },
  });

  return transitions;
}

function Router() {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  const transitions = usePageTransition();

  // Full-screen loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f8f4] dark:bg-[#0e1410]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#172017] flex items-center justify-center shadow-[0_4px_0_#7eaa2a]">
            <svg className="h-6 w-6 animate-spin text-[#b8f34a]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="font-display text-sm font-bold tracking-[-0.03em] text-[#719d2a]">campus<span className="text-[#253025] dark:text-[#e8efe3]">arena</span></p>
        </div>
      </div>
    );
  }

  // No user → show Login for all routes
  if (!user) {
    return (
      <div className="relative overflow-hidden">
        {transitions((style, loc) => (
          <animated.div style={style} key={loc}>
            <Login />
          </animated.div>
        ))}
      </div>
    );
  }

  // Admin → AdminPortal
  if (user.role === "admin") {
    return (
      <div className="relative overflow-hidden">
        {transitions((style, loc) => (
          <animated.div style={style} key={loc}>
            <Switch>
              <Route path="/profile" component={ProfilePage} />
              <Route path="/admin/forms" component={FormBuilder} />
              <Route path="/admin/notifications" component={AdminNotifications} />
              <Route path="/admin" component={AdminPortal} />
              <Route component={AdminPortal} />
            </Switch>
          </animated.div>
        ))}
      </div>
    );
  }

  // All other authenticated users
  return (
    <div className="relative overflow-hidden">
      {transitions((style, loc) => (
        <animated.div style={style} key={loc}>
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/" component={Home} />
            <Route component={Home} />
          </Switch>
        </animated.div>
      ))}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <AuthProvider>
          <TooltipProvider>
            <Toaster position="bottom-right" richColors closeButton />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
