import { trpc } from "@/lib/trpc";
import { Redirect, Route, RouteProps } from "wouter";
import FullPageLoader from "./FullPageLoader";

interface ProtectedRouteProps extends RouteProps {
  component: React.ComponentType<any>;
}

export default function ProtectedRoute({ component: Component, ...rest }: ProtectedRouteProps) {
  return (
    <Route {...rest}>
      {(params) => <ProtectedContent Component={Component} params={params} />}
    </Route>
  );
}

function ProtectedContent({ Component, params }: { Component: React.ComponentType<any>; params: any }) {
  // Check if token exists before making the query
  const hasToken = !!localStorage.getItem('sessionToken');
  
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    enabled: hasToken, // Only run query if token exists
  });

  // If no token, redirect immediately
  if (!hasToken) {
    return <Redirect to="/auth" />;
  }

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return <Component {...params} />;
}
