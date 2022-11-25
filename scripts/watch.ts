import { build } from "esbuild";
import { writeFile } from "fs/promises";
import path from "path";

const outFolder = "C:\\Users\\n1xx1\\AppData\\Roaming\\BetterDiscord\\plugins";

build({
  entryPoints: ["src/plugin.ts"],
  bundle: true,
  format: "cjs",
  watch: true,
  write: false,
  plugins: [
    {
      name: "watcher",
      setup(b) {
        b.onEnd(async (e) => {
          console.log("built!");
          if (e.errors.length > 0) return;
          const text = produceManifest() + e.outputFiles![0].text;
          await writeFile(path.join(outFolder, "test.plugin.js"), text);
        });
      },
    },
  ],
});

function produceManifest() {
  return `/**
 * @name PluginOrThemeName
 * @version 0.0.1
 * @description Just a simple description of the content that may
 * end up being pretty long
 * @author Author
 *
 * @website http://twitter.com/BandagedBD
*/`;
}
