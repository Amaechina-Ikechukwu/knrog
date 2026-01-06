module.exports = {
  apps: [
    {
      name: "knrog-server",
      script: "./server/src/index.ts",
      interpreter: "bun", // or "node"
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
