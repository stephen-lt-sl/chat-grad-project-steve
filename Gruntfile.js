module.exports = function(grunt) {
    grunt.loadNpmTasks("grunt-webpack");
    if (process.env.NODE_ENV !== "production") {
        grunt.loadNpmTasks("grunt-contrib-jshint");
        grunt.loadNpmTasks("grunt-jscs");
        grunt.loadNpmTasks("grunt-mocha-test");
        grunt.loadNpmTasks("grunt-mocha-istanbul");
        grunt.loadNpmTasks("grunt-concurrent");
    }

    var files = [
        "Gruntfile.js", "server.js", "server/**/*.js", "test/**/*.js", "public/**/*.js", "!public/build/*.js"
    ];
    var artifactsLocation = "build_artifacts";

    var webpack = require("webpack");

    grunt.initConfig({
        jshint: {
            all: files,
            options: {
                jshintrc: true
            }
        },
        jscs: {
            all: files
        },
        webpack: {
            chatApp: {
                entry: "./public/chatApp.js",
                output: {
                    path: "./public/build",
                    filename: "chatApp.bundle.js"
                },
                module: {
                    loaders: [
                        {test: /\.css$/, loader: "style!css"}
                    ]
                },
                plugins: [
                    new webpack.optimize.UglifyJsPlugin({minimize: true})
                ]
            },
            chatAppDev: {
                entry: "./public/chatApp.js",
                output: {
                    path: "./public/build",
                    filename: "chatApp.bundle.js"
                },
                module: {
                    loaders: [
                        {test: /\.css$/, loader: "style!css"}
                    ]
                }
            },
            chatAppDevWatch: {
                entry: "./public/chatApp.js",
                output: {
                    path: "./public/build",
                    filename: "chatApp.bundle.js"
                },
                watch: true,
                keepalive: true,
                module: {
                    loaders: [
                        {test: /\.css$/, loader: "style!css"}
                    ]
                }
            }
        },
        concurrent: {
            devServer: {
                tasks: ["serve", "webpack:chatAppDevWatch"],
                options: {
                    logConcurrentOutput: true
                }
            }
        },
        mochaTest: {
            test: {
                src: ["test/**/*.js"]
            }
        },
        "mocha_istanbul": {
            test: {
                src: ["test/**/*.js"]
            },
            options: {
                coverageFolder: artifactsLocation,
                reportFormats: ["none"],
                print: "none"
            }
        },
        "istanbul_report": {
            test: {

            },
            options: {
                coverageFolder: artifactsLocation
            }
        },
        "istanbul_check_coverage": {
            test: {

            },
            options: {
                coverageFolder: artifactsLocation,
                check: true
            }
        }
    });

    grunt.registerTask("serve", "Task that runs the server.", function () {
        var done = this.async();
        var cmd = process.execPath;
        process.env.DEV_MODE = true;
        var serveProc = grunt.util.spawn({
            cmd: cmd,
            args: ["server.js"]
        }, function(err) {
            if (err) {
                return done(err);
            }
            done();
        });
        serveProc.stdout.pipe(process.stdout);
        serveProc.stderr.pipe(process.stderr);
    });

    grunt.registerMultiTask("istanbul_report", "Solo task for generating a report over multiple files.", function () {
        var done = this.async();
        var cmd = process.execPath;
        var istanbulPath = require.resolve("istanbul/lib/cli");
        var options = this.options({
            coverageFolder: "coverage"
        });
        grunt.util.spawn({
            cmd: cmd,
            args: [istanbulPath, "report", "--dir=" + options.coverageFolder]
        }, function(err) {
            if (err) {
                return done(err);
            }
            done();
        });
    });

    if (process.env.NODE_ENV === "production") {
        grunt.registerTask("build", ["webpack:chatApp"]);
    } else {
        grunt.registerTask("build", ["webpack:chatAppDev"]);
    }
    grunt.registerTask("check", ["jshint", "jscs"]);
    grunt.registerTask("test", ["check", "build", "mochaTest", "mocha_istanbul", "istanbul_report",
        "istanbul_check_coverage"]);
    grunt.registerTask("default", "test");
};
