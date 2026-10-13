"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { login } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/ui/icon";
import type { ActionResult } from "@/lib/result";

type LoginState = ActionResult<null>;

async function loginDesdeFormulario(_prev: LoginState, formData: FormData): Promise<LoginState> {
  return login({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
}

const estadoInicial: LoginState = { ok: false, error: { code: "", message: "" } };

export function LoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginDesdeFormulario, estadoInicial);
  const [verContrasena, setVerContrasena] = useState(false);

  useEffect(() => {
    if (state.ok) {
      router.push("/");
      router.refresh();
    }
  }, [state, router]);

  const fieldErrors = state.ok ? undefined : state.error.fieldErrors;
  const mensajeError = state.ok ? undefined : state.error.message;

  return (
    <form
      action={formAction}
      className="rounded-2xl bg-surface-container-lowest p-6 shadow-card sm:p-8"
      noValidate
    >
      <h1 className="text-headline-lg-mobile text-on-surface sm:text-headline-lg">
        Iniciar sesión
      </h1>
      <p className="mt-1 text-body-md text-on-surface-variant">
        Accede a tu inventario, ventas y cobranza.
      </p>

      {mensajeError && (
        <Alert tone="error" className="mt-4">
          {mensajeError}
        </Alert>
      )}

      <div className="mt-6 flex flex-col gap-4">
        <Input
          id="email"
          name="email"
          type="email"
          label="Correo electrónico"
          placeholder="usuario@negocio.com"
          inputMode="email"
          autoComplete="email"
          icon="mail"
          required
          disabled={pending}
          error={fieldErrors?.email}
        />
        <Input
          id="password"
          name="password"
          type={verContrasena ? "text" : "password"}
          label="Contraseña"
          placeholder="••••••••"
          autoComplete="current-password"
          icon="lock"
          required
          disabled={pending}
          error={fieldErrors?.password}
          endAdornment={
            <button
              type="button"
              onClick={() => setVerContrasena((v) => !v)}
              aria-label={verContrasena ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Icon name={verContrasena ? "visibility_off" : "visibility"} size={20} />
            </button>
          }
        />

        <Button type="submit" size="lg" loading={pending} className="mt-2 w-full">
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </div>
    </form>
  );
}