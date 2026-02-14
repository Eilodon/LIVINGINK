import { startTelemetry } from "./utils/Telemetry";

// Initialize Telemetry before importing other modules
startTelemetry();

import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { NguHanhRoom } from "./rooms/NguHanhRoom";
import { monitor } from "@colyseus/monitor";

const port = Number(process.env.PORT || 2567);
const host = process.env.HOST || 'localhost';
const app = express();

app.use(cors());
app.use(express.json());

// Attach monitor
app.use("/colyseus", monitor());

const gameServer = new Server({
    server: createServer(app),
});

gameServer.define("ngu_hanh", NguHanhRoom);

gameServer.listen(port).then(() => {
    console.log(`Listening on ws://${host}:${port}`);
    console.log(`Monitor available at http://${host}:${port}/colyseus`);
});
