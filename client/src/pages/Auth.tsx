import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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

  const loginMutation = trpc.auth.login.useMutation({
  onSuccess: () => {
    toast.success("Login bem-sucedido!");
    navigate("/");
    // preferível evitar forced reload; mas se precisar, mantenha:
    window.location.reload();
  },
  onError: (error) => {
    console.error('loginMutation error object:', error);
    toast.error(`Erro de Login: ${error.message}`);
  },
});

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success("Registro bem-sucedido! Você será logado automaticamente.");
      // Após o registro, faz o login automático e redireciona para a raiz
      navigate("/");
      window.location.reload(); // Força o recarregamento para buscar o estado de autenticação
    },
    onError: (error) => {
      // Apenas exibe o erro e não faz mais nada
      toast.error(`Erro de Registro: ${error.message}`);
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
            {isLogin ? "Entrar" : "Criar Conta"}
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            {isLogin
              ? "Insira suas credenciais para acessar o painel."
              : "Preencha os campos para criar sua conta."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLogin ? (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">E-mail</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="m@exemplo.com"
                  {...loginForm.register("email")}
                  className="bg-gray-700 border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  {...loginForm.register("password")}
                  className="bg-gray-700 border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          ) : (
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-name">Nome</Label>
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Seu Nome"
                  {...registerForm.register("name")}
                  className="bg-gray-700 border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-email">E-mail</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="m@exemplo.com"
                  {...registerForm.register("email")}
                  className="bg-gray-700 border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Senha</Label>
                <Input
                  id="register-password"
                  type="password"
                  {...registerForm.register("password")}
                  className="bg-gray-700 border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Criar Conta"}
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
              ? "Não tem uma conta? Crie uma."
              : "Já tem uma conta? Faça login."}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AuthPage;
