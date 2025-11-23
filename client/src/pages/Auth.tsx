import { useState } from "react";
import { Link } from "react-router-dom";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "../trpc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const registerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [, navigate] = useLocation();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      // Redirecionar para o dashboard após o login
      navigate("/dashboard");
      window.location.reload(); // Forçar o recarregamento para buscar o usuário
    },
    onError: (error) => {
      alert(`Erro de Login: ${error.message}`);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      // Após o registro, faz o login automático
      alert("Registro bem-sucedido! Você será logado automaticamente.");
      navigate("/dashboard");
      window.location.reload(); // Forçar o recarregamento para buscar o usuário
    },
    onError: (error) => {
      alert(`Erro de Registro: ${error.message}`);
    },
  });

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const handleLogin = (data: LoginForm) => {
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
                />
                {loginForm.formState.errors.email && (
                  <p className="text-red-400 text-sm">
                    {loginForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  {...loginForm.register("password")}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                {loginForm.formState.errors.password && (
                  <p className="text-red-400 text-sm">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
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
                />
                {registerForm.formState.errors.name && (
                  <p className="text-red-400 text-sm">
                    {registerForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-email">E-mail</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="m@exemplo.com"
                  {...registerForm.register("email")}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                {registerForm.formState.errors.email && (
                  <p className="text-red-400 text-sm">
                    {registerForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Senha</Label>
                <Input
                  id="register-password"
                  type="password"
                  {...registerForm.register("password")}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                {registerForm.formState.errors.password && (
                  <p className="text-red-400 text-sm">
                    {registerForm.formState.errors.password.message}
                  </p>
                )}
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
