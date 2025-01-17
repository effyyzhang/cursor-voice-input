const path = require("path");

module.exports = {
  mode: "development",
  target: "node",
  entry: "./src/extension.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
  externals: {
    vscode: "commonjs vscode",
    "@babel/parser": "commonjs @babel/parser",
    "@babel/traverse": "commonjs @babel/traverse",
  },
  stats: {
    errorDetails: true,
  },
};
