import fs from "node:fs/promises";
import esbuild from "esbuild";

const banner_js_esm = `
import { createRequire as topLevelCreateRequire } from 'module';
const require = topLevelCreateRequire(import.meta.url);
const __dirname = '.';
`.trim();

// https://github.com/evanw/esbuild/issues/946#issuecomment-911869872
const opts_common: esbuild.BuildOptions = {
  // identifiers까지 minifiy 적용하면 소스맵에 들어가는 이름도 뭉개진다
  // 적용할 경우 'at Ap (/var/task/src/apis.ts:71:9)' 같이 나온다.
  // 타입스크립트 파일명과 라인은 제대로 나와서 못 쓸 물건은 아니다 이름까지 제대로 나오면 좋겠다
  // minifyIdentifiers: false,
  // minifySyntax: true,
  // 번들 자체를 뜯어보기 편해서. 프로덕션에서는 true로 써야한다.
  // minifyWhitespace: false,

  // for production
  minify: true,

  bundle: true,
  sourcemap: true,
  treeShaking: true,
  platform: "node",
  external: [
    "@aws-sdk/client-apigatewaymanagementapi",
    "@aws-sdk/client-lambda",
    "@aws-sdk/client-sqs",
  ],
  target: "node20",
  format: "esm",
  mainFields: ["module", "main"],
  banner: {
    js: banner_js_esm,
  },
};

function readableSize(val: number) {
  const mb = val / 1024 / 1024;
  return mb.toPrecision(2);
}

async function mybuild(opts: esbuild.BuildOptions) {
  const result = await esbuild.build(opts);

  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  const fp_bundle = opts.outfile!;
  const fp_sourcemap = `${fp_bundle}.map`;

  // biome-ignore lint/correctness/noConstantCondition: <explanation>
  if (true) {
    const stat_bundle = await fs.stat(fp_bundle);
    console.log(`${fp_bundle}\t${readableSize(stat_bundle.size)}MB`);
  }

  if (opts.sourcemap !== undefined && opts.sourcemap !== false) {
    const stat_sourcemap = await fs.stat(fp_sourcemap);
    console.log(`${fp_sourcemap}\t${readableSize(stat_sourcemap.size)}MB`);
  }

  return result;
}

const build = async (
  fp_entrypoint: string,
  filename: string,
  opts: esbuild.BuildOptions,
) => {
  const fp_outfile =
    opts.format === "esm"
      ? `./artifact/${filename.replace(".js", ".mjs")}`
      : `./artifact/${filename}`;

  await mybuild({
    ...opts,
    entryPoints: [fp_entrypoint],
    outfile: fp_outfile,
  });
};

await Promise.allSettled([
  build("./src/handlers/http_main.js", "http_main.js", opts_common),
  build("./src/handlers/ws_main.js", "ws_main.js", opts_common),
]);
