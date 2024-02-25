const { build } = require("esbuild");

const baseConfig = {
	bundle: true,
	minify: process.env.NODE_ENV !== "test",
	sourcemap: process.env.NODE_ENV === "test",
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

const webviewConfig = {
	...baseConfig,
	target: "esnext",
	format: "esm",
	entryPoints: ["./src/media/webView.js"],
	outfile: "./media/webView.js",
};

const cssConfig = {
	...baseConfig,
	entryPoints: ["./src/media/style.css"],
	outfile: "./media/style.css",
};

(async () => {
	try {
		await build(extensionConfig);
		await build(webviewConfig);
		await build(cssConfig);
		console.log("build complete");
	} catch (err) {
		process.stderr.write(err.stderr);
		process.exit(1);
	}
})();
