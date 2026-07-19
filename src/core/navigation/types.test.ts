import test from "node:test";
import assert from "node:assert/strict";
import { coerceNavigationMap, flattenNavigation, navigationToMarkdown } from "./types.js";

test("conserva varias superficies y limita el árbol a tres niveles", () => {
  const map = coerceNavigationMap({
    audience: "Cliente normal, no admin",
    roots: [
      {
        label: "Inicio",
        route: "/",
        surface: "bottom-nav",
        children: [{
          label: "Perfil",
          route: "/profile",
          surface: "sidebar-left",
          children: [{
            label: "Inventario",
            route: "/profile/inventory",
            surface: "tabs",
            children: [{ label: "No debe aparecer", route: "/nivel-4" }],
          }],
        }],
      },
      { label: "Descubrir", route: "/discover", surface: "navbar" },
    ],
  });
  assert.deepEqual(map.roots.map((node) => node.surface), ["bottom-nav", "navbar"]);
  assert.equal(flattenNavigation(map.roots).length, 4);
  assert.equal(map.roots[0].children[0].children[0].children.length, 0);
});

test("exporta una estructura Markdown con rutas y botones", () => {
  const map = coerceNavigationMap({
    roots: [{
      label: "Más",
      route: "/more",
      surface: "drawer",
      actions: [{ label: "Sugerencias", target: "/suggestions", kind: "navigate" }],
    }],
  });
  const markdown = navigationToMarkdown(map);
  assert.match(markdown, /## Más/);
  assert.match(markdown, /`\/more`/);
  assert.match(markdown, /Sugerencias → \/suggestions/);
});
