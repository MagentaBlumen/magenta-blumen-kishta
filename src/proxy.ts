import { auth } from "@/auth";

// Next.js 16 renamed `middleware.ts` -> `proxy.ts`. Signature and
// behaviour are identical; only the filename changed.
//
// Auth.js v5 exposes auth() as proxy directly. The `authorized`
// callback in src/auth.ts decides who gets in.
export default auth((req) => {
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  if (isAdminRoute && !req.auth?.user) {
    const signInUrl = new URL("/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  // Only run the proxy on paths that could need auth. The static
  // catch-all excludes /_next/static, /_next/image, favicon, and any
  // top-level file with a dot in the name (images, fonts, etc.).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
