"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearUsuario } from "../actions";
import type { Perfil } from "../schemas";
import type { RolUsuario } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { formatFecha } from "@/components/ui/format";
import { useToast } from "@/components/ui/toast";

const ROL_LABEL: Record<RolUsuario, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
};

const ROL_OPCIONES = [
  { value: "admin", label: "Administrador" },
  { value: "vendedor", label: "Vendedor" },
];

function iniciales(nombre: string | null, correo: string | null): string {
  const base = nombre?.trim() || correo?.split("@")[0] || "U";
  return base.slice(0, 2).toUpperCase();
}

export function UsuariosPanel({
  usuarios,
  miId,
}: {
  usuarios: Perfil[];
  miId: string;
}) {
  const toast = useToast();
  const router = useRouter();

  const [lista, setLista] = useState<Perfil[]>(usuarios);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    correo: "",
    password: "",
    rol: "vendedor" as RolUsuario,
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [creando, startCrear] = useTransition();

  function abrir() {
    setForm({ nombre: "", correo: "", password: "", rol: "vendedor" });
    setErrores({});
    setAbierto(true);
  }

  function crear(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrores({});
    startCrear(async () => {
      const res = await crearUsuario(form);
      if (res.ok) {
        setLista((actual) => [...actual, res.data]);
        setAbierto(false);
        toast.success("Usuario creado");
        router.refresh();
      } else {
        setErrores(res.error.fieldErrors ?? {});
        toast.error(res.error.message);
      }
    });
  }

  return (
    <Card
      title="Usuarios"
      subtitle={`${lista.length} usuario${lista.length === 1 ? "" : "s"} con acceso al sistema.`}
      action={
        <Button icon="person_add" onClick={abrir}>
          Nuevo usuario
        </Button>
      }
      contentClassName="p-0"
    >
      <ul className="divide-y divide-outline-variant">
        {lista.map((usuario) => (
          <li key={usuario.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-label-lg text-primary">
              {iniciales(usuario.nombre, usuario.correo)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-label-lg text-on-surface">
                <span className="truncate">{usuario.nombre ?? "Sin nombre"}</span>
                {usuario.id === miId && (
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-label-sm text-on-surface-variant">
                    Tú
                  </span>
                )}
              </p>
              <p className="truncate text-body-sm text-on-surface-variant">
                {usuario.correo ?? "Sin correo"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={
                  usuario.rol === "admin"
                    ? "rounded-full bg-primary/10 px-2.5 py-1 text-label-md text-primary"
                    : "rounded-full bg-surface-container px-2.5 py-1 text-label-md text-on-surface-variant"
                }
              >
                {ROL_LABEL[usuario.rol]}
              </span>
              <span className="text-label-sm text-on-surface-variant">
                {formatFecha(usuario.created_at)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Nuevo usuario"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              className="w-full sm:flex-1"
              disabled={creando}
              onClick={() => setAbierto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-nuevo-usuario"
              icon="person_add"
              loading={creando}
              className="w-full sm:flex-1"
            >
              Crear usuario
            </Button>
          </div>
        }
      >
        <form id="form-nuevo-usuario" onSubmit={crear} className="flex flex-col gap-4" noValidate>
          <Input
            label="Nombre"
            name="nombre"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            error={errores.nombre}
            icon="person"
            required
          />
          <Input
            label="Correo"
            name="correo"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={form.correo}
            onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
            error={errores.correo}
            icon="mail"
            required
          />
          <Input
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            error={errores.password}
            hint="Mínimo 8 caracteres."
            icon="lock"
            required
          />
          <Select
            label="Rol"
            name="rol"
            options={ROL_OPCIONES}
            value={form.rol}
            onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value as RolUsuario }))}
            error={errores.rol}
          />
        </form>
      </Modal>
    </Card>
  );
}
