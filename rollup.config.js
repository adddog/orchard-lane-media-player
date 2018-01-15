import babel from "rollup-plugin-babel"
import commonjs from "rollup-plugin-commonjs"
import nodeResolve from "rollup-plugin-node-resolve"
import strip from "rollup-plugin-strip"
import uglify from "rollup-plugin-uglify"

const prod = process.env.NODE_ENV === "production"

export default {
    entry: "src/index.js",
    format: "umd",
    indent: '\t',
    moduleName: "orchard-lane-media-player",
    dest: prod
        ? "dist/orchard-lane-media-player.min.js"
        : "dist/orchard-lane-media-player.js",
    sourceMap: !prod,
    plugins: [
        nodeResolve({
            jsnext: true,
            main: true,
            preferBuiltins: false,
        }),
        commonjs({
            include: [
                'node_modules/bluebird/**',
                'node_modules/signals/**',
                'node_modules/lodash.isobject/**',
            ]
        }),
        babel({
            babelrc: false,
            exclude: "node_modules/**",
            presets: [
                ["es2015", { loose: true, modules: false }],
                ["stage-0"],
                ["stage-1"],
                ["stage-2"],
            ],
            plugins: ["external-helpers"],
        }),
        prod && strip({ sourceMap: false }),
        prod && uglify(),
    ],
}
