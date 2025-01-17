const esbuild = require("esbuild");

const isWatch = process.argv.includes("--watch");
const isProduction = process.argv.includes("--production");

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ["./src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  sourcemap: !isProduction,
  minify: isProduction,
};

async function build() {
  try {
    if (isWatch) {
      const context = await esbuild.context(buildOptions);
      await context.watch();
    } else {
      await esbuild.build(buildOptions);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

build();
