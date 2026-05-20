#!/usr/bin/env node

const dotenv = require("dotenv");
dotenv.config();

const { createServer } = require("./app");

const port = Number(process.env.PORT || process.env.API_PORT || 3000);
const host = String(process.env.API_HOST || "0.0.0.0");

const server = createServer();
server.listen(port, host, () => {
  console.log(`VamShop Spec API listening on ${host}:${port}`);
});
