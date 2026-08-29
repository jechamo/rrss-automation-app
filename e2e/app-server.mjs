import http from "node:http";
import { fileURLToPath } from "node:url";
import next from "next";

const host = "127.0.0.1";
const appPort = Number(process.env.RRSS_E2E_APP_PORT);
const fixturePort = Number(process.env.RRSS_E2E_FIXTURE_PORT);
const app = next({
  dev: process.env.RRSS_E2E_NEXT_DEV === "true",
  dir: fileURLToPath(new URL("..", import.meta.url)),
  hostname: host,
  port: appPort,
});
await app.prepare();

const appServer = http.createServer((request, response) => app.getRequestHandler()(request, response));
const fixtureHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>App Fixture E2E</title><meta name="description" content="Aplicación ficticia local"></head>
<body><nav><a href="/funciones">Funciones</a><a href="/precios">Precios</a></nav><main>
<h1>Automatiza contenido con control local</h1><h2>Dossier y estrategia</h2>
<p>Convierte una appweb en contenido revisable, sin publicar automáticamente.</p>
<button>Crear proyecto</button></main></body></html>`;
const privateHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Zona privada</title></head>
<body><main><h1>Panel privado fixture</h1><button id="crear">Crear contenido</button></main></body></html>`;
const loginHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acceso</title></head>
<body><main><h1>Acceso fixture</h1><form method="post" action="/login"><label>Usuario<input name="username" autocomplete="username"></label><label>Contraseña<input type="password" name="password" autocomplete="current-password"></label><button type="submit">Iniciar sesión</button></form></main></body></html>`;
const fixtureServer = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"status":"ready"}');
    return;
  }
  if (request.url === "/private") {
    if (String(request.headers.cookie ?? "").includes("rrss_e2e_session=ok")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(privateHtml);
    } else {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(loginHtml);
    }
    return;
  }
  if (request.url === "/login" && request.method === "POST") {
    request.resume();
    request.on("end", () => {
      response.writeHead(303, {
        Location: "/private",
        "Set-Cookie": "rrss_e2e_session=ok; Path=/; HttpOnly; SameSite=Lax",
      });
      response.end();
    });
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(fixtureHtml);
});

await Promise.all([
  new Promise((resolve) => appServer.listen(appPort, host, resolve)),
  new Promise((resolve) => fixtureServer.listen(fixturePort, host, resolve)),
]);
process.stdout.write(`e2e-servers-ready:${appPort}:${fixturePort}\n`);

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  appServer.closeAllConnections?.();
  fixtureServer.closeAllConnections?.();
  appServer.close();
  fixtureServer.close();
  await Promise.race([
    app.close(),
    new Promise((resolve) => setTimeout(resolve, 1_500)),
  ]);
  process.exit(0);
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
