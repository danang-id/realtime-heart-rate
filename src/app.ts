/**
 * Copyright 2019, Danang Galuh Tegar Prasetyo & Mokhamad Mustaqim.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Import dependencies
import path from 'path';
import http from 'http';
import express from 'express';
import { json, urlencoded } from 'body-parser';
import moment from 'moment';
import WebSocket from 'ws';

// Import internal functions
import { getConfig } from './config';
import { docs } from './docs';
import { getDatabase } from "./helpers/database";
import { router, favicon, notFound } from "./helpers/express";
import { IDeviceModel } from './models/IDeviceModel';
import { IPulseModel } from './models/IPulseModel';

// Declare and define variables
const config = getConfig();
const app = express();
const onApp = router.use(app);
const server = new http.Server(app);
const webSocketServer = new WebSocket.Server({ server });
const port = config.PORT || process.env.PORT || 9000;

function createPayload(event: WebSocketEvent, data?: WebSocketData): string {
	return JSON.stringify({ event, data })
}

function serverSend(socket: WebSocket, event: WebSocketEvent, data?: WebSocketData) {
	socket.send(createPayload(event, data))
}

function serverBroadcast(event: WebSocketEvent, data?: WebSocketData) {
	webSocketServer.clients.forEach(function each(client) {
		if (client.readyState === WebSocket.OPEN) {
			serverSend(client, event, data)
		}
	});
}

async function onRequestDevices(socket: WebSocket) {
	try {
		const database = await getDatabase();
		const devices: IDeviceModel[] = await database.query(
			'SELECT * FROM devices'
		);
		await database.end();
		serverSend(socket, WebSocketEvent.onRetrieveDevices, devices);
	} catch (error) {
		serverSend(socket, WebSocketEvent.onError, error);
	}
}

async function onRequestHeartRates(socket: WebSocket, deviceId: number) {
	try {
		const database = await getDatabase();
		const pulses: IPulseModel[] = await database.query(
			'SELECT * FROM pulses WHERE ?',
			{ device_id: deviceId }
		);
		await database.end();
		serverSend(socket, WebSocketEvent.onRetrieveHeartRates, pulses);
	} catch (error) {
		serverSend(socket, WebSocketEvent.onError, error);
	}
}

docs(app); // Show Swagger UI as documentation on '/docs' path
app.use(json()); // Use JSON parser to parse JSON body as JavaScript object
app.use(urlencoded({ extended: false })); // Parse body as URL Encoded format

// Let HTTP Server serve front-end on "public" folder
app.use(favicon(path.join(__dirname, '..', 'public', 'favicon.ico'))); // Serve favicon
app.use(express.static(path.join(__dirname, '..', 'public'))); // Static serve 'public' folder
onApp.get('/', true) // Serve front-end's "index.html"
	.handle(async (request, response) => {
		return response.send(
			path.join(__dirname, '..', 'public', 'index.html')
		);
	});

// HTTP REST API to be called by pulse sensor device
// whenever pulse sensor device should emit a new pulse value
onApp.get('/emit-pulse')
	.handle(async (request, response) => {
		const requiredField = ['deviceId', 'pulse', 'timestamp'];
		for (const field of requiredField) {
			if (!request.query[field]) {
				return response.status(400).json({
					success: false,
					code: 400,
					message: 'Parameter "' + field + '" is required!'
				});
			}
		}
		let pulse: IPulseModel = {
			device_id: parseInt(request.query.deviceId),
			pulse: parseFloat(request.query.pulse),
			emitted_at: moment(new Date(parseInt(request.query.timestamp)))
				.utc()
				.format('YYYY-MM-DD HH:mm:ss')
		};
		try {
			const database = await getDatabase();
			const devices: IDeviceModel[] = await database.query(
				'SELECT * FROM devices WHERE ?',
				{ id: pulse.device_id }
			);
			const device = devices.find(dev => dev.id === pulse.device_id);
			if (device === void 0) {
				return response.status(404).json({
					success: false,
					code: 404,
					message:
						'Device with ID ' + pulse.device_id + ' is not found.'
				});
			}
			const { insertId } = await database.query(
				'INSERT INTO pulses SET ?',
				pulse
			);
			const pulses: IPulseModel[] = await database.query(
				'SELECT * FROM pulses WHERE ?',
				{ id: insertId }
			);
			await database.end();
			pulse = pulses[0];
			serverBroadcast(WebSocketEvent.onEmitHeartRate, pulse);
			return response.json({
				success: true,
				code: 200,
				message: 'New pulse data recorded successfully!',
				data: pulse
			});
		} catch (error) {
			return response.status(500).json({
				success: false,
				code: 500,
				message: error.message,
				error
			});
		}
	})

// Handle not found error
app.use(notFound);

// Configure web socket for front-end
webSocketServer.on('connection', function(socket) {
	serverSend(socket, WebSocketEvent.onConnection, 'Connected to Real-Time server using Web Socket.');
	socket.on('message', (message) => {
		try {
			const { event, data } = JSON.parse(message.toString());
			if (!event) {
				return;
			}
			switch (event) {
				case WebSocketEvent.onRequestDevices:
					onRequestDevices(socket);
					break;
				case WebSocketEvent.onRequestHeartRates:
					onRequestHeartRates(socket, parseInt(data));
					break;
			}
		} catch (error) {
			// Do nothing
		}
	})
});

// Start server
server.listen(port, () => {
	console.log('Real time server started on port ' + port);
});

// Enum of Web Socket events
enum WebSocketEvent {
	onConnection = 'onConnection',
	onEmitHeartRate = 'onEmitHeartRate',
	onRequestDevices = 'onRequestDevices',
	onRetrieveDevices = 'onRetrieveDevices',
	onRequestHeartRates = 'onRequestHeartRates',
	onRetrieveHeartRates = 'onRetrieveHeartRates',
	onError = 'onError'
}

type WebSocketData = any;
