// @ts-check
import * as esbuild from 'esbuild';

/** @type {import('esbuild').BuildOptions} */
const baseConfig = {
	bundle: true,
	minify: true,
	sourcemap: false,
	drop: ['console'],
};

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
	...baseConfig,
	platform: 'node',
	mainFields: ['module', 'main'],
	format: 'cjs',
	entryPoints: ['./src/extension.ts'],
	outfile: './out/extension.js',
	external: ['vscode', 'better-sqlite3'],
};

/** @type {import('esbuild').BuildOptions} */
const webComponentConfig = {
	...baseConfig,
	platform: 'browser',
	format: 'esm',
	entryPoints: ['./src/component.ts'],
	outfile: './media/component.js',
};

(async () => {
	try {
		await esbuild.build(extensionConfig);
		await esbuild.build(webComponentConfig);
		console.log('build complete');
	} catch (err) {
		process.stderr.write(err.stderr);
		process.exit(1);
	}
})();
