import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const requireFromNext = createRequire(require.resolve("next/package.json"));
const requireFromPrisma = createRequire(require.resolve("@prisma/config/package.json"));

const postcss = requireFromNext("postcss");
const css = await postcss([]).process("a { color: red }", { from: undefined });
assert.match(css.css, /color: red/u);

const sharp = requireFromNext("sharp");
const image = await sharp({
  create: { width: 1, height: 1, channels: 4, background: "#000000" },
}).png().toBuffer({ resolveWithObject: true });
assert.equal(image.info.width, 1);
assert.equal(image.info.height, 1);

const { deepmerge } = requireFromPrisma("deepmerge-ts");
assert.deepEqual(deepmerge({ prisma: true }, { sqlite: true }), {
  prisma: true,
  sqlite: true,
});

process.stdout.write("Overrides de dependencias: OK\n");
