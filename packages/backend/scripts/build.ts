import esbuild from "esbuild";
import fs from "fs/promises";
import path from "path";

const banner_js_esm = `
import { createRequire as topLevelCreateRequire } from 'module';
const require = topLevelCreateRequire(import.meta.url);
const __dirname = '.';
`.trim();

// https://github.com/evanw/esbuild/issues/946#issuecomment-911869872
const common: esbuild.BuildOptions = {
  // 클래스 이름이 뭉개지면 문제가 생길수 있다
  minifyIdentifiers: false,
  minifySyntax: true,
  minifyWhitespace: true,
  bundle: true,
  sourcemap: true,
  treeShaking: true,
  platform: "node",
  target: "node16",
  external: ["aws-sdk"],
  format: "esm",
  banner: {
    js: banner_js_esm,
  },
};

async function writeEsmPackageJson(dirname: string) {
  const packageJson = {
    type: "module",
  };
  const file = path.resolve(dirname, "package.json");
  const data = JSON.stringify(packageJson, null, 2);
  await fs.writeFile(file, data);
}

async function mybuild(opts: esbuild.BuildOptions) {
  const result = await esbuild.build(opts);

  const fp_bundle = opts.outfile!;
  const fp_sourcemap = fp_bundle + ".map";

  function readableSize(val: number) {
    const mb = val / 1024 / 1024;
    return mb.toPrecision(2);
  }

  if (true) {
    const stat_bundle = await fs.stat(fp_bundle);
    console.log(`${fp_bundle}\t${readableSize(stat_bundle.size)}MB`);
  }

  if (opts.sourcemap !== undefined && opts.sourcemap !== false) {
    const stat_sourcemap = await fs.stat(fp_sourcemap);
    console.log(`${fp_sourcemap}\t${readableSize(stat_sourcemap.size)}MB`);
  }

  // out.mjs      3.4mb
  // out.mjs.map  4.0mb
  // console.log({
  //   result,
  // });
}

const fn_http = async () => {
  const fp_entrypoint = "./src/handlers/http.js";
  const fp_outfile = "./output/http.js";
  await mybuild({
    ...common,
    entryPoints: [fp_entrypoint],
    outfile: fp_outfile,
  });
};

const fn_websocket = async () => {
  const fp_entrypoint = "./src/handlers/websocket.js";
  const fp_outfile = "./output/websocket.js";
  await mybuild({
    ...common,
    entryPoints: [fp_entrypoint],
    outfile: fp_outfile,
  });
};

async function main() {
  await Promise.allSettled([fn_http(), fn_websocket()]);
  await writeEsmPackageJson("./output");
}
await main();
