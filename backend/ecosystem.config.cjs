module.exports = {
  apps: [
    {
      name: 'backend-pan-canasto',
      script: 'src/server.js',
      env: {
        NODE_ENV: 'production',
        DB_HOST: '127.0.0.1',
      },
    },
  ],
};
