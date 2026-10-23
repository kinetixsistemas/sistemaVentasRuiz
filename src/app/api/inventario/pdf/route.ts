import { NextResponse } from "next/server";
import { createSupabaseContext } from "@/lib/supabase/context";
import { renderInventarioPdf } from "@/lib/pdf/render-inventario";
import { categoriaFiltroSchema, existenciaFiltroSchema } from "@/features/inventario/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { error } = await createSupabaseContext();
  if (error) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const busqueda = (url.searchParams.get("q") ?? "").trim();
  if (busqueda.length > 60) {
    return NextResponse.json({ error: "Búsqueda demasiado larga" }, { status: 400 });
  }

  const existencia = existenciaFiltroSchema.safeParse(
    url.searchParams.get("existencia") ?? undefined
  );
  if (!existencia.success) {
    return NextResponse.json({ error: "Filtro de existencia inválido" }, { status: 400 });
  }

  const categoria = categoriaFiltroSchema.parse(url.searchParams.get("categoria") ?? null);

  try {
    const buffer = await renderInventarioPdf({
      busqueda: busqueda || undefined,
      existencia: existencia.data,
      categoria,
    });
    const fecha = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="inventario-${fecha}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo generar el PDF del inventario." },
      { status: 500 }
    );
  }
}
