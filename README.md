node-red-node-cf-cloudant
=========================
A [Node-RED](http://nodered.org) node to `insert`, `update` and `delete` documents
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
Allows basic access to a [Cloudant](http://cloudant.com) database. Currently
it only have one node that supports `insert`, `update` and `delete`
operations.

To **insert** a new document into the database you have the option to store
the entire `msg` object or just the `msg.payload`. If the input value is not
in JSON format, it will be transformed before being stored.

For **update** and **delete**, you must pass the `_id` and the `_rev`as part
of the input `msg` object.
