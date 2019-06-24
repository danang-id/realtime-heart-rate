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

import dotenv from 'dotenv';
import mysql from "promise-mysql";
import mysqlx from '@mysql/xdevapi';

dotenv.config();

class Database {

    private mysqlxConnection = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT|| 33060,
        password: process.env.DB_PASSWORD,
        user: process.env.DB_USERNAME || 'root',
        schema: process.env.DB_NAME || 'heartrate',
    };
    
    private mysqlxPoolingOptions = { 
        pooling: { 
            enabled: true,
             maxSize: 3
        } 
    };

    private mysqlConnectionConfig: mysql.ConnectionConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'heartrate',
        timezone: 'UTC',
        dateStrings: ['DATE', 'DATETIME']
    };

    constructor() {

    }

    private async createLegacyClient() {
        try {
            const client = await mysql.createConnection(this.mysqlConnectionConfig);
            await client.query('SET time_zone=\'+00:00\';');
            return client;
        } catch (error) {
            throw error;
        }
    }

    private async createXProtocolClient() {
        return mysqlx.getClient(this.mysqlxConnection, this.mysqlxPoolingOptions);
    }
    
    public async createClient(useXProtocol: boolean = true) {
        return useXProtocol ? (await this.createXProtocolClient()) : (await this.createLegacyClient());
    }
    
    public async createSession(client: any) {
        const session = await client.getSession();
        const preQuery = session.sql('SET time_zone=\'+00:00\';');
        await preQuery.execute();
        return session;
    }
    
    public async getSchema(client: any) {
        const session = await this.createSession(client);
        const schema = session.getSchema(this.mysqlxConnection.schema);
        return (await schema.existsInDatabase()) 
            ? schema 
            : (await session.createSchema(this.mysqlxConnection.schema));
    }
    
    public async getTable(client: any, name: string) {
        const schema = await this.getSchema(client);
        const table = schema.getTable(name);
        return (await table.existsInDatabase())
            ? table
            : (await schema.createTable(name));
    }

    public async close(client: any) {
        !!client.close ? await client.close() : await client.end();
    }

}

export const database = new Database();
export default database;
