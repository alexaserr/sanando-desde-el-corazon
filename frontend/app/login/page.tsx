"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { loginUser } from "@/lib/api/auth";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setServerError(null);
    try {
      await loginUser(data.email, data.password);
      router.replace("/clinica");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError("Error al iniciar sesión. Intente de nuevo.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-terra-50 p-4">
      <Card className="w-full max-w-lg shadow-[0_4px_24px_rgba(61,26,15,0.08)] rounded-2xl border border-terra-100">
        <CardHeader className="space-y-1 text-center pb-6 pt-10 px-10">
          <div className="flex justify-center mb-4">
            <img
              src="/images/sdc-logo.png"
              alt="Sanando desde el Corazón"
              className="h-20 w-auto mx-auto"
            />
          </div>
          <CardDescription className="text-terra-500">
            Ingresa tus credenciales para continuar
          </CardDescription>
        </CardHeader>
        <CardContent className="px-10 pb-10">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-terra-800">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="correo@ejemplo.com"
                className="h-12 rounded-lg border-terra-200 focus:border-terra-400 focus:ring-terra-400/20"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-terra-800">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-12 rounded-lg border-terra-200 focus:border-terra-400 focus:ring-terra-400/20"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {serverError && (
              <p className="text-sm text-destructive text-center">
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11 min-h-[44px] bg-terra-700 hover:bg-terra-600 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
