const express = require('express');

function createApp() {
  const app = express();
  app.get('/', (_req, res) => res.send('ok'));
  return app;
}

module.exports = { createApp };
