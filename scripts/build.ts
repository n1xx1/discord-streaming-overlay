import { build, BuildOptions } from "esbuild";
import { mkdir, writeFile } from "fs/promises";
import path, { dirname } from "path";
import yargs from "yargs/yargs";

function main() {
  yargs(process.argv.slice(2))
    .option("o", {
      alias: "out",
      describe: "the output plugin file",
    })
    .command(
      "watch",
      "watch",
      (yargs) =>
        yargs.default(
          "o",
          path.join(defaultPluginLocation, "DiscordStreamingOverlay.plugin.js")
        ),
      async (argv) => {
        await build({
          ...defaultEsbuildSettings(),
          watch: true,
          plugins: [
            {
              name: "watcher",
              setup(b) {
                b.onEnd(async (res) => {
                  console.log("built!");
                  if (res.errors.length > 0) return;
                  const text = produceManifest() + res.outputFiles![0].text;
                  await writeFile(argv.o, text);
                });
              },
            },
          ],
        });
      }
    )
    .command(
      "build",
      "build",
      (yargs) =>
        yargs.default(
          "o",
          path.join(".", "dist/DiscordStreamingOverlay.plugin.js")
        ),
      async (argv) => {
        const res = await build(defaultEsbuildSettings());
        const text = produceManifest() + res.outputFiles![0].text;

        await mkdir(dirname(argv.o), { recursive: true }).catch(() =>
          Promise.resolve()
        );

        await writeFile(argv.o, text);
      }
    )
    .demandCommand(1)
    .strict()
    .help().argv;
}

function produceManifest() {
  return `/**
 * @name DiscordStreamingOverlay
 * @version 0.0.1
 * @description Just a simple description of the content that may
 * end up being pretty long
 * @author Author
 *
 * @website http://twitter.com/BandagedBD
*/`;
}

const defaultPluginLocation =
  "C:\\Users\\n1xx1\\AppData\\Roaming\\BetterDiscord\\plugins";

function defaultEsbuildSettings(): BuildOptions & { write: false } {
  return {
    entryPoints: ["src/plugin.ts"],
    bundle: true,
    format: "cjs",
    write: false,
  };
}

main();
