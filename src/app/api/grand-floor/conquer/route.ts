import { NextRequest, NextResponse } from 'next/server';

/** THE GRAND FLOOR 廃止 */
export async function GET() {
  return NextResponse.json(
    { error: 'THE GRAND FLOOR is discontinued.' },
    { status: 410 }
  );
}

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'THE GRAND FLOOR is discontinued.' },
    { status: 410 }
  );
}
