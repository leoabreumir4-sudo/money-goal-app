import { createContext, useContext, ReactNode } from "react";
import { useAuth as useAuthHook } from "@/_core/hooks/useAuth";

type AuthContextType = ReturnType<typeof useAuthHook>;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuthHook();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
