import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";
import FullPageLoader from "./FullPageLoader";
import { ComponentType } from "react";

export function withAuth<P extends object>(Component: ComponentType<P>) {
  return function ProtectedComponent(props: P) {
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

    return <Component {...props} />;
  };
}
