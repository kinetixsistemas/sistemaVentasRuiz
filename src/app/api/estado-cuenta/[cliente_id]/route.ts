import { NextResponse } from "next/server";
import { createSupabaseContext } from "@/lib/supabase/context";
import { renderEstadoCuentaPdf } from "@/lib/pdf/render-estado-cuenta";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ cliente_id: string }> }
) {
  const { error } = await createSupabaseContext();
  if (error) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { cliente_id } = await context.params;

  try {
    const buffer = await renderEstadoCuentaPdf(cliente_id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="estado-cuenta-${cliente_id}.pdf"`,
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