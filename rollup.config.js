import resolve from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';
import commonjs from 'rollup-plugin-commonjs';
import svelte from 'rollup-plugin-svelte';
import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';
import config from 'sapper/config/rollup.js';
import pkg from './package.json';
import getPreprocessor from 'svelte-preprocess'
import postcss from 'rollup-plugin-postcss'
import path from 'path'
const mode = process.env.NODE_ENV;
const dev = mode === 'development';
const legacy = !!process.env.SAPPER_LEGACY_BUILD;

class SvelteExtractor {
	static extract(content) {
		return content.match(/[A-Za-z0-9-_:\/]+/g) || [];
	}
}


const postcssPlugins = (purgecss=false) => {
	return [
		require("postcss-import")(),
		require("postcss-url")(),
		require("tailwindcss")("./tailwind.config.js"),
		require("autoprefixer")({ browsers: "last 3 version" }),
		// Do not purge the CSS in dev mode to be able to play with classes in the browser dev-tools.
		purgecss &&
				require('@fullhuman/postcss-purgecss')({
					content: ['./**/*.svelte'],
					extractors: [
						{
							extractor: SvelteExtractor,

							// Specify the file extensions to include when scanning for
							// class names.
							extensions: ['svelte'],
						},
					],
					// Whitelist selectors to stop Purgecss from removing them from your CSS.
					whitelist: ['html', 'body'],
				}),
	].filter(Boolean)
}

const preprocess = getPreprocessor({
	transformers: {
		postcss: {
			plugins: postcssPlugins() // Don't need purgecss because Svelte handle unused css for you.
		}
	}
});

export default {
	client: {
		input: config.client.input(),
		output: config.client.output(),
		plugins: [
			replace({
				'process.browser': true,
				'process.env.NODE_ENV': JSON.stringify(mode)
			}),
			svelte({
				dev,
				hydratable: true,
				emitCss: true,
				preprocess
			}),
			resolve(),
			commonjs(),

			legacy && babel({
				extensions: ['.js', '.mjs', '.html', '.svelte'],
				runtimeHelpers: true,
				exclude: ['node_modules/@babel/**'],
				presets: [
					['@babel/preset-env', {
						targets: '> 0.25%, not dead'
					}]
				],
				plugins: [
					'@babel/plugin-syntax-dynamic-import',
					['@babel/plugin-transform-runtime', {
						useESModules: true
					}]
				]
			}),

			!dev && terser({
				module: true
			})
		],
	},

	server: {
		input: config.server.input(),
		output: config.server.output(),
		plugins: [
			replace({
				'process.browser': false,
				'process.env.NODE_ENV': JSON.stringify(mode)
			}),
			svelte({
				generate: 'ssr',
				dev,
				preprocess
			}),
			resolve(),
			commonjs(),
			postcss({
				plugins: postcssPlugins(!dev),
				extract: path.resolve(__dirname, './static/global.css')
			})
		],
		external: Object.keys(pkg.dependencies).concat(
			require('module').builtinModules || Object.keys(process.binding('natives'))
		),
	},

	serviceworker: {
		input: config.serviceworker.input(),
		output: config.serviceworker.output(),
		plugins: [
			resolve(),
			replace({
				'process.browser': true,
				'process.env.NODE_ENV': JSON.stringify(mode)
			}),
			commonjs(),
			!dev && terser()
		]
	}
};
