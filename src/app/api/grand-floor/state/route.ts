import { NextResponse } from 'next/server';

/** THE GRAND FLOOR 廃止 */
export async function GET() {
  return NextResponse.json(
    { error: 'THE GRAND FLOOR is discontinued. ギルドランキングはギルド実力（週間集計）に移行しました。' },
    { status: 410 }
  );
}
