import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];
const PUBLIC_PREFIXES = ["/_next", "/favicon.ico", "/robots.txt"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();
  if (request.cookies.has("miaoshou_session")) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "UNAUTHORIZED", message: "请先登录" }, { status: 401 });
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!.*\\..*).*)"] };
