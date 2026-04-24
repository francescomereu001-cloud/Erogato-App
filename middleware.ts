export default function middleware(request: Request) {
  const username = process.env.APP_USERNAME;
  const password = process.env.APP_PASSWORD;

  if (!username || !password) {
    return new Response("Credenziali non configurate", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const basicAuth = authHeader.split(" ")[1];
    const [user, pass] = atob(basicAuth).split(":");

    if (user === username && pass === password) {
      return;
    }
  }

  return new Response("Accesso riservato", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Area riservata"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
