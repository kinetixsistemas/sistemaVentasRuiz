"use server";

import { updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { errorResult, fromZodError, type ActionResult } from "@/lib/result";
import { TAG_CLIENTES } from "@/lib/tags";
import {
  actualizarClienteService,
  crearClienteService,
  eliminarClienteService,
  listarClientesService,
  obtenerClienteService,
} from "./service";
import {
  actualizarClienteSchema,
  crearClienteSchema,
  listarClientesSchema,
  type Cliente,
  type ListarClientesResult,
} from "./schemas";

export async function crearCliente(input: unknown): Promise<ActionResult<Cliente>> {
  await requireUser();
  const parsed = crearClienteSchema.safeParse(input);
  if (!parsed.success) return fromZodError<Cliente>(parsed.error);

  const result = await crearClienteService(parsed.data);
  if (result.ok) updateTag(TAG_CLIENTES);
  return result;
}

export async function actualizarCliente(input: unknown): Promise<ActionResult<Cliente>> {
  await requireUser();
  const parsed = actualizarClienteSchema.safeParse(input);
  if (!parsed.success) return fromZodError<Cliente>(parsed.error);

  const result = await actualizarClienteService(parsed.data);
  if (result.ok) updateTag(TAG_CLIENTES);
  return result;
}

export async function eliminarCliente(clienteId: unknown): Promise<ActionResult<null>> {
  await requireUser();
  if (typeof clienteId !== "string" || !clienteId.trim()) {
    return errorResult("VALIDATION", "Falta el identificador del cliente.");
  }

  const result = await eliminarClienteService(clienteId.trim());
  if (result.ok) updateTag(TAG_CLIENTES);
  return result;
}

export async function obtenerCliente(clienteId: unknown): Promise<ActionResult<Cliente>> {
  await requireUser();
  if (typeof clienteId !== "string" || !clienteId.trim()) {
    return errorResult("VALIDATION", "Falta el identificador del cliente.");
  }
  return obtenerClienteService(clienteId.trim());
}

export async function listarClientes(input?: unknown): Promise<ActionResult<ListarClientesResult>> {
  await requireUser();
  const parsed = listarClientesSchema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError<ListarClientesResult>(parsed.error);
  return listarClientesService(parsed.data);
}