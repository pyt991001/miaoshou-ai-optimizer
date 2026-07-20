import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATH_PREFIXES = ["/_next", "/favicon.ico", "/robots.txt"];

export function middleware(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    const inputPassword = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";
    if (inputPassword === password) return NextResponse.next();
  }

  return new NextResponse("需要密码才能访问商品 AI 优化系统", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Miaoshou AI Optimizer", charset="UTF-8"'
    }
  });
}

export const config = {
  matcher: ["/((?!api/health).*)"]
};
