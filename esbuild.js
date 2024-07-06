const { build } = require("esbuild");

const baseConfig = {
	bundle: true,
	minify: true,
	sourcemap: false,
};

const extensionConfig = {
	...baseConfig,
	platform: "node",
	mainFields: ["module", "main"],
	format: "cjs",
	entryPoints: ["./src/extension.ts"],
	outfile: "./out/extension.js",
	external: ["vscode", "better-sqlite3"],
};

const webComponentConfig = {
	...baseConfig,
	platform: "browser",
	format: "esm",
	entryPoints: ["./src/component.ts"],
	outfile: "./media/component.js",
};

(async () => {
	try {
		await build(extensionConfig);
		await build(webComponentConfig);
		console.log("build complete");
	} catch (err) {
		process.stderr.write(err.stderr);
		process.exit(1);
	}
})();
