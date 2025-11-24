import { trpc } from "@/lib/trpc";
import { Redirect, Route, RouteProps } from "wouter";
import FullPageLoader from "./FullPageLoader";

interface ProtectedRouteProps extends RouteProps {
  component: React.ComponentType<any>;
}

export default function ProtectedRoute({ component: Component, ...rest }: ProtectedRouteProps) {
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return <Route {...rest} component={Component} />;
}
