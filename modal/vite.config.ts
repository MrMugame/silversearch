import type { UserConfig } from "vite"
import fs from "fs/promises";
import { svelte } from "@sveltejs/vite-plugin-svelte";

async function wrapFile(path: string) {
    const content = await fs.readFile(path, "utf8");

    const text = `export default ${JSON.stringify(content)}`;

    await fs.writeFile(`${path}.ts`, text);

    await fs.rm(path);
}

export default {
    build: {
        lib: {
            name: "silversearch",
            entry: ["modal.ts"],
            formats: ["iife"],
            cssFileName: "modal",
            fileName: "modal"
        },
        minify: true,
    },
    plugins: [
        {
            name: "bundle",
            closeBundle: async () => {
                // // Prepare HTML file by combining it with the css
                const css = await fs.readFile("dist/modal.css", "utf8");
                const html = await fs.readFile("modal.html", "utf8");

                const content = `<style>${css.replaceAll("\n", "")}</style>\n${html}`;

                await fs.writeFile("dist/modal.html", content);

                // Prepare
                wrapFile("dist/modal.html");
                wrapFile("dist/modal.iife.js");
            }
        },
        svelte()
    ]
} satisfies UserConfig