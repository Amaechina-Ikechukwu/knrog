module.exports = {
  apps: [
    {
      name: "knrog-server",
      script: "./index.ts",
      interpreter: "bun", // or "node"
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
