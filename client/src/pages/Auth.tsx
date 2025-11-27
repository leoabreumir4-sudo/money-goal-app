// /home/ubuntu/money-goal-app/client/src/pages/Auth.tsx
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { trpc } from "@/lib/trpc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Loader2, LogIn, UserPlus } from "lucide-react";

type LoginForm = { email: string; password: string };
type RegisterForm = { name: string; email: string; password: string };

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      if (data.token) {
        localStorage.setItem('sessionToken', data.token);
        // Force localStorage to commit
        const savedToken = localStorage.getItem('sessionToken');
        console.log('[Auth] Token saved:', savedToken ? 'YES' : 'NO');
      }
      
      // Save credentials if remember me is checked
      if (rememberMe) {
        const currentEmail = loginForm.getValues('email');
        const currentPassword = loginForm.getValues('password');
        localStorage.setItem('rememberedEmail', currentEmail);
        localStorage.setItem('rememberedPassword', currentPassword);
      } else {
        localStorage.removeItem('rememberedEmail');
        localStorage.removeItem('rememberedPassword');
      }
      
      toast.success("Login successful! Redirecting...");
      
      // Wait longer for token persistence and invalidation
      await queryClient.invalidateQueries();
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
        // Force localStorage to commit
        const savedToken = localStorage.getItem('sessionToken');
        console.log('[Auth] Token saved:', savedToken ? 'YES' : 'NO');
      }
      toast.success("Registration successful! Redirecting...");
      
      // Wait longer for token persistence and invalidation
      await queryClient.invalidateQueries();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      navigate("/");
    },
    onError: (error) => {
      toast.error(`Registration Error: ${error.message}`);
    },
  });

  // Load saved credentials on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedPassword = localStorage.getItem('rememberedPassword');
    if (savedEmail && savedPassword) {
      loginForm.setValue('email', savedEmail);
      loginForm.setValue('password', savedPassword);
      setRememberMe(true);
    }
  }, []);

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
      <Card className="w-[420px] bg-gray-800 text-white border-gray-700">
        <CardHeader className="space-y-3 pb-6">
          <div className="w-16 h-16 mx-auto bg-primary rounded-2xl flex items-center justify-center">
            {isLogin ? <LogIn className="w-8 h-8 text-white" /> : <UserPlus className="w-8 h-8 text-white" />}
          </div>
          <CardTitle className="text-3xl text-center font-bold text-white">
            {isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <CardDescription className="text-center text-gray-400 text-base">
            {isLogin
              ? "Enter your credentials to access your dashboard"
              : "Fill in the information below to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6">
          {isLogin ? (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-sm font-medium">Email Address</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  {...loginForm.register("email")}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 h-11"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-sm font-medium">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  {...loginForm.register("password")}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 h-11"
                  disabled={isLoading}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  disabled={isLoading}
                  className="border-gray-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label 
                  htmlFor="remember" 
                  className="text-sm text-gray-400 cursor-pointer select-none"
                >
                  Remember my credentials
                </Label>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 h-11 text-base font-semibold transition-all" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="register-name" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="register-name"
                  type="text"
                  placeholder="John Doe"
                  {...registerForm.register("name")}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 h-11"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-email" className="text-sm font-medium">Email Address</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="you@example.com"
                  {...registerForm.register("email")}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 h-11"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password" className="text-sm font-medium">Password</Label>
                <Input
                  id="register-password"
                  type="password"
                  placeholder="••••••••"
                  {...registerForm.register("password")}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 h-11"
                  disabled={isLoading}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 h-11 text-base font-semibold transition-all" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-5 w-5" />
                    Create Account
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center pt-2 pb-6">
          <Button
            variant="link"
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:text-primary/80 text-base"
            disabled={isLoading}
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AuthPage;
