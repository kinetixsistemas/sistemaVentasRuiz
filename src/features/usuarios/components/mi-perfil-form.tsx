"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarMiPerfil } from "../actions";
import type { Perfil } from "../schemas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function MiPerfilForm({
  perfil,
  email,
}: {
  perfil: Perfil | null;
  email?: string;
}) {
  const toast = useToast();
  const router = useRouter();

  const [nombre, setNombre] = useState(perfil?.nombre ?? "");
  const [correo, setCorreo] = useState(perfil?.correo ?? email ?? "");
  const [password, setPassword] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, startGuardar] = useTransition();

  function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrores({});
    startGuardar(async () => {
      const res = await actualizarMiPerfil({ nombre, correo, password });
      if (res.ok) {
        setPassword("");
        toast.success("Tu cuenta se actualizó correctamente");
        router.refresh();
      } else {
        setErrores(res.error.fieldErrors ?? {});
        toast.error(res.error.message);
      }
    });
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4" noValidate>
      <Card
        title="Mi usuario"
        subtitle="Datos de acceso de tu cuenta."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nombre"
            name="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            error={errores.nombre}
            icon="person"
            required
          />
          <Input
            label="Correo"
            name="correo"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            error={errores.correo}
            icon="mail"
          />
          <div className="sm:col-span-2">
            <Input
              label="Nueva contraseña"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errores.password}
              hint="Déjala en blanco para no cambiarla. Mínimo 8 caracteres."
              icon="lock"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-outline-variant pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-sm text-on-surface-variant">
            Si cambias el correo o la contraseña, puede pedirse un nuevo inicio de sesión.
          </p>
          <Button type="submit" icon="save" loading={guardando}>
            Guardar
          </Button>
        </div>
      </Card>
    </form>
  );
}
