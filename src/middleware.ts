import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const مسار = req.nextUrl.pathname;

    // فرض تغيير كلمة المرور المؤقتة قبل استخدام النظام
    if (
      token?.mustChangePassword &&
      مسار !== "/change-password" &&
      !مسار.startsWith("/api")
    ) {
      return NextResponse.redirect(new URL("/change-password", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: { authorized: ({ token }) => !!token },
    pages: { signIn: "/login" },
  }
);

// حماية كل المسارات الداخلية، مع استثناء صفحة الدخول والأصول الثابتة وواجهة المصادقة
export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
};
