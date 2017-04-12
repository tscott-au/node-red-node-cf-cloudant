node-red-node-cf-cloudant
=========================
A pair of [Node-RED](http://nodered.org) nodes to work with documents
in a [Cloudant](http://cloudant.com) database that is integrated with
[IBM Bluemix](http://bluemix.net).

Install
-------
Install from [npm](http://npmjs.org)
```
npm install node-red-node-cf-cloudant
```

Usage
-----
Allows basic access to a [Cloudant](http://cloudant.com) database to
`insert`, `update`, `delete` and `search` for documents.

To **insert** a new document into the database you have the option to store
the entire `msg` object or just the `msg.payload`. If the input value is not
in JSON format, it will be transformed before being stored.

For **update** and **delete**, you must pass the `_id` and the `_rev`as part
of the input `msg` object.

For **insert** and **update**, you can specify that an output message is generated.
For successful inserts or updates, the message output will be the original message 
with the _id and _rev fields updated in either the message body or in the payload.

To **search** for a document you have two options: get a document directly by
its `_id` or use an existing [search index](https://cloudant.com/for-developers/search/)
from the database. For both cases, the query should be passed in the
`msg.payload` input object as a string.

When getting documents by id, the `payload` will be the desired `_id` value.
For `search indexes`, the query should follow the format `indexName:value`.

Errors are returned via node.error(err, msg) calls and can be caught by Catch nodes present
on the same tab, msg objects are returned and available to the Catch nodes.
Additional database error details are added to msg.dbError.

Authors
-------
* Luiz Gustavo Ferraz Aoqui - [laoqui@ca.ibm.com](mailto:laoqui@ca.ibm.com)
* Túlio Pascoal
