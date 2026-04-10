export const runtime = "nodejs";

export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "diplom-sed",
      time: new Date().toISOString(),
    },
    { status: 200 },
  );
}

