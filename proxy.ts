import { NextResponse } from "next/server";

import { auth } from "@/auth";

type Role =
  | "ADMIN"
  | "COMMERCIAL"
  | "VIEWER";

type AuthenticatedUser = {
  id?: string;
  role?: Role;
};

const protectedPrefixes = [
  "/dashboard",
  "/inventory",
  "/projects",
  "/purchases",
  "/reports",
  "/users",
  "/account",
] as const;

function matchesPrefix(
  pathname: string,
  prefix: string,
): boolean {
  return (
    pathname === prefix ||
    pathname.startsWith(`${prefix}/`)
  );
}

function isProtectedRoute(
  pathname: string,
): boolean {
  return protectedPrefixes.some(
    (prefix) =>
      matchesPrefix(pathname, prefix),
  );
}

function isViewerBlockedRoute(
  pathname: string,
): boolean {
  if (
    matchesPrefix(pathname, "/projects") ||
    matchesPrefix(pathname, "/purchases") ||
    matchesPrefix(pathname, "/users")
  ) {
    return true;
  }

  if (pathname === "/inventory/new") {
    return true;
  }

  return /^\/inventory\/[^/]+\/edit$/.test(
    pathname,
  );
}

function isCommercialBlockedRoute(
  pathname: string,
): boolean {
  return matchesPrefix(
    pathname,
    "/users",
  );
}

/*
 * Não tipar o parâmetro como NextRequest.
 * O auth() fornece o tipo que inclui request.auth.
 */
export default auth((request) => {
  const pathname =
    request.nextUrl.pathname;

  const user = request.auth
    ?.user as AuthenticatedUser | undefined;

  if (
    isProtectedRoute(pathname) &&
    !user?.id
  ) {
    const loginUrl = new URL(
      "/login",
      request.url,
    );

    loginUrl.searchParams.set(
      "callbackUrl",
      pathname,
    );

    return NextResponse.redirect(
      loginUrl,
    );
  }

  if (
    pathname === "/login" &&
    user?.id
  ) {
    return NextResponse.redirect(
      new URL(
        "/dashboard",
        request.url,
      ),
    );
  }

  if (
    user?.role === "VIEWER" &&
    isViewerBlockedRoute(pathname)
  ) {
    return NextResponse.redirect(
      new URL(
        "/dashboard",
        request.url,
      ),
    );
  }

  if (
    user?.role === "COMMERCIAL" &&
    isCommercialBlockedRoute(pathname)
  ) {
    return NextResponse.redirect(
      new URL(
        "/dashboard",
        request.url,
      ),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};