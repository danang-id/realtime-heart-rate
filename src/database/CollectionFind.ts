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

import Collection from './Collection';
import Document from './types/Document';
import Projection from './types/Projection';
import FindOperationResult from './FindOperationResult';

export class CollectionFind {

	private readonly collection: Collection;
	private xCollectionFind;

	constructor(collection: Collection, xCollectionFind) {
		this.collection = collection;
		this.xCollectionFind = xCollectionFind;
	}

	public fields(projections: Projection | Projection[]): CollectionFind {
		try {
			this.xCollectionFind = this.xCollectionFind.fields(projections);
			return this;
		} catch (error) {
			throw error;
		}
	}

	public async execute(): Promise<FindOperationResult> {
		try {
			const documents: Document[] = [];
			const xResult = await this.xCollectionFind.execute(document => {
				documents.push(document);
			});
			return new FindOperationResult(xResult, documents);
		} catch (error) {
			throw error;
		}
	}

}

export default CollectionFind;
