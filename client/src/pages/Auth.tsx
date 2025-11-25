// /home/ubuntu/money-goal-app/client/src/pages/Auth.tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { trpc } from "@/lib/trpc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Loader2 } from "lucide-react";

type LoginForm = { email: string; password: string };
type RegisterForm = { name: string; email: string; password: string };

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const loginMutation = trpc.auth.login.useMutation({
  onSuccess: async (data) => {
    if (data.token) {
      localStorage.setItem('sessionToken', data.token);
    }
    toast.success("Login successful!");
    // Small delay to ensure token is persisted
    await new Promise(resolve => setTimeout(resolve, 100));
    // Invalidate and refetch
    await queryClient.invalidateQueries();
    navigate("/");
  },
  onError: (error) => {
    console.error('loginMutation error object:', error);
    toast.error(`Login Error: ${error.message}`);
  },
});

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (data) => {
      if (data.token) {
        localStorage.setItem('sessionToken', data.token);
      }
      toast.success("Registration successful! You will be logged in automatically.");
      // Small delay to ensure token is persisted
      await new Promise(resolve => setTimeout(resolve, 100));
      // Invalidate and refetch
      await queryClient.invalidateQueries();
      navigate("/");
    },
    onError: (error) => {
      toast.error(`Registration Error: ${error.message}`);
    },
  });

  const loginForm = useForm<LoginForm>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterForm>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const handleLogin = (data: LoginForm) => {
  console.log('handleLogin called with:', data);
  loginMutation.mutate(data);
};

  const handleRegister = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  const isLoading = loginMutation.isLoading || registerMutation.isLoading;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <Card className="w-[350px] bg-gray-800 text-white border-gray-700">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {isLogin ? "Sign In" : "Create Account"}
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            {isLogin
              ? "Enter your credentials to access your dashboard."
              : "Fill in the fields to create your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLogin ? (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  {...loginForm.register("email")}
                  className="bg-gray-700 border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  {...loginForm.register("password")}
                  className="bg-gray-700 border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 transition-all" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-name">Name</Label>
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Your Name"
                  {...registerForm.register("name")}
                  className="bg-gray-700 border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="you@example.com"
                  {...registerForm.register("email")}
                  className="bg-gray-700 border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <Input
                  id="register-password"
                  type="password"
                  {...registerForm.register("password")}
                  className="bg-gray-700 border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 transition-all" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            variant="link"
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-400 hover:text-indigo-300"
            disabled={isLoading}
          >
            {isLogin
              ? "Don't have an account? Sign up."
              : "Already have an account? Sign in."}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AuthPage;
