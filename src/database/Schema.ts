/**
 * Copyright 2019, Danang Galuh Tegar Prasetyo.
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

import Client from './Client';
import Session from './Session';
import Collection from './Collection';
import CreateCollectionOptions from './types/CreateCollectionOptions';

export class Schema {

	private readonly client: Client;
	private readonly session: Session;
	private readonly xSchema;

	constructor(session: Session, xSchema) {
		this.client = session.getClient();
		this.session = session;
		this.xSchema = xSchema;
	}

	public getClient(): Client {
		return this.client;
	}

	public getSession(): Session {
		return this.session;
}

	public getXSchema() {
		return this.xSchema;
	}

	public async createCollection(name: string, options?: CreateCollectionOptions): Promise<Collection> {
		try {
			const xCollection = await this.xSchema.createCollection(name, options);
			return new Collection(this, xCollection);
		} catch (error) {
			throw error;
		}
	}

	public async dropCollection(name: string): Promise<boolean> {
		try {
			return await this.xSchema.dropCollection(name);
		} catch (error) {
			throw error;
		}
	}

	public async existsInDatabase(): Promise<boolean> {
		try {
			return await this.xSchema.existsInDatabase();
		} catch (error) {
			throw error;
		}
	}

	public async getCollection(name: string): Promise<Collection> {
		try {
			const xCollection = await this.xSchema.getCollection(name);
			return new Collection(this, xCollection);
		} catch (error) {
			throw error;
		}
	}

	public async getCollections(): Promise<Collection[]> {
		try {
			const xCollections = await this.xSchema.getCollections();
			const collections: Collection[] = [];
			for (const xCollection of xCollections) {
				collections.push(new Collection(this, xCollection));
			}
			return collections;
		} catch (error) {
			throw error;
		}
	}

	public getName(): string {
		return this.xSchema.getName();
	}

	public inspect(): Object {
		return this.xSchema.inspect();
	}

}

export default Schema;
