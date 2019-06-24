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
import SocketIO from 'socket.io';
import moment from 'moment';

// Import internal functions
import { getConfig } from './config';
import { docs } from './docs';
import { database } from './helpers/database';
import { router, favicon, notFound } from './helpers/express';
import { IDeviceModel } from './models/IDeviceModel';
import { IPulseModel } from './models/IPulseModel';

// Declare and define variables
const config = getConfig();
const app = express();
const onApp = router.use(app);
const server = new http.Server(app);
const io = SocketIO(server);
const port = config.PORT || process.env.PORT || 9000;

// Declare and define helper functions
function createDeviceModel(row: DeviceRow) {
	const model: IDeviceModel = {
		id: row[0],
		name: row[1],
		created_at: row[2],
		updated_at: row[3]
	};
	return model;
}
function createPulseModel(row: PulseRow) {
	const model: IPulseModel = {
		id: row[0],
		device_id: row[1],
		pulse: row[2],
		emitted_at: row[3],
		created_at: row[4]
	};
	return model;
}

// Configure HTTP Server
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
		const client = await database.createClient();
		try {
			const deviceTable = await database.getTable(client, 'devices');
			const pulseTable = await database.getTable(client, 'pulses');
			const deviceRows: DeviceRow[] = [];
			await deviceTable.select()
				.where('id = ' + pulse.device_id)
				.execute((row: DeviceRow) => deviceRows.push(row));
			if (deviceRows.length <= 0) {
				return response.status(404).json({
					success: false,
					code: 404,
					message:
						'Device with ID ' + pulse.device_id + ' is not found.'
				});
			}
			const device: IDeviceModel = createDeviceModel(deviceRows[0]);
			const result = await pulseTable.insert(pulse).execute();
			const pulseRows: PulseRow[] = [];
			await pulseTable.select()
				.where('id = ' + result.getAutoIncrementValue())
				.execute((row: PulseRow) => pulseRows.push(row));
			pulse = createPulseModel(pulseRows[0]);
			io.emit(WebSocketEvent.onEmitHeartRate, pulse);
			return response.json({
				success: true,
				code: 200,
				message: 'New pulse data recorded successfully!',
				data: pulse
			});
		} catch (e) {
			const message = e.info.msg || e.warning.msg || e.message || e.sqlMessage || 'Unkown server error.';
			const error = { message };
			return response.status(500).json({
				success: false,
				code: 500,
				message,
				error: e
			});
		} finally {
			await database.close(client);
		}
	})

// Handle not found error
app.use(notFound);

// Configure web socket for front-end
io.on('connection', function(socket) {
	socket.emit(
		WebSocketEvent.onConnection,
		'Connected to Real-Time server using Web Socket.'
	);
	socket.on(WebSocketEvent.onRequestDevices, async emit => {
		const client = await database.createClient();
		try {
			const table = await database.getTable(client, 'devices');
			const rows: DeviceRow[] = [];
			const devices: IDeviceModel[] = [];
			await table.select()
				.execute((row: DeviceRow) => rows.push(row));
			for (const row of rows) {
				devices.push(createDeviceModel(row));
			}
			console.log(devices);
			emit(WebSocketEvent.onRetrieveDevices, devices);
		} catch (e) {
			const message = e.info.msg || e.warning.msg || e.message || e.sqlMessage || 'Unkown server error.';
			const error = { message };
			emit(WebSocketEvent.onError, error);
		} finally {
			await database.close(client);
		}
	});
	socket.on(WebSocketEvent.onRequestHeartRates, async (deviceId, emit) => {
		const client = await database.createClient();
		try {
			const table = await database.getTable(client, 'pulses');
			const rows: PulseRow[] = [];
			const pulses: IPulseModel[] = [];
			await table.select().where('device_id = ' + deviceId)
				.execute((row: PulseRow) => rows.push(row));
			for (const row of rows) {
				pulses.push(createPulseModel(row));
			}
			emit(WebSocketEvent.onRetrieveHeartRates, pulses);
		} catch (e) {
			const message = e.info.msg || e.warning.msg || e.message || e.sqlMessage || 'Unkown server error.';
			const error = { message };
			emit(WebSocketEvent.onError, error);
		} finally {
			await database.close(client);
		}
	});
});

// Start server
server.listen(port, () => {
	console.log('Real time server started on port ' + port);
});

type DeviceRow = [ number, string, string | Date, string | Date ];
type PulseRow = [ number, number, number, string | Date, string | Date ];

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
