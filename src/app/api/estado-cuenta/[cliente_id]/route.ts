import { NextResponse } from "next/server";
import { createSupabaseContext } from "@/lib/supabase/context";
import { renderEstadoCuentaPdf } from "@/lib/pdf/render-estado-cuenta";

export const dynamic = "force-dynamic";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ cliente_id: string }> }
) {
  const { error } = await createSupabaseContext();
  if (error) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { cliente_id } = await context.params;

  // Rango de emisión opcional (?desde=YYYY-MM-DD&hasta=YYYY-MM-DD).
  const url = new URL(request.url);
  const desde = url.searchParams.get("desde") ?? undefined;
  const hasta = url.searchParams.get("hasta") ?? undefined;
  const rangoInvalido =
    (desde === undefined) !== (hasta === undefined) ||
    (desde !== undefined && !FECHA_RE.test(desde)) ||
    (hasta !== undefined && !FECHA_RE.test(hasta)) ||
    (desde !== undefined && hasta !== undefined && desde > hasta);
  if (rangoInvalido) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  try {
    const buffer = await renderEstadoCuentaPdf(
      cliente_id,
      desde && hasta ? { desde, hasta } : undefined
    );
    const sufijo = desde && hasta ? `-${desde}_${hasta}` : "";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="estado-cuenta-${cliente_id}${sufijo}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo generar el estado de cuenta del cliente." },
      { status: 500 }
    );
  }
}