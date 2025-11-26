import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";
import FullPageLoader from "./FullPageLoader";
import { ComponentType } from "react";

export function withAuth<P extends object>(Component: ComponentType<P>) {
  return function ProtectedComponent(props: P) {
    const { user, loading } = useAuth();

    if (loading) {
      return <FullPageLoader />;
    }

    if (!user) {
      return <Redirect to="/auth" />;
    }

    return <Component {...props} />;
  };
}
