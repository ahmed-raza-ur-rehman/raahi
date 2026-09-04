import { NextResponse } from "next/server";
import { organizations } from "@/data/catalog";
export async function GET() { return NextResponse.json({ results: organizations }); }