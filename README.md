node-red-node-cf-cloudant
=========================
A [Node-RED](http://nodered.org) node to write (and read soon...) to a
[Cloudant](http://cloudant.com) database that is integrated with
[IBM Bluemix](http://bluemix.net).

Install
-------
Place these files inside your `nodes/` folder.

This node will soon be published to [npm](https://www.npmjs.org/).

Usage
-----
Allows basic access to a [Cloudant](http://cloudant.com) database. Currently
it only have one node that supports `insert` and `delete`
operations.

To **insert** a new document into the database you have the option to store
the entire `msg` object or just the `msg.payload`. If the input value is not
in JSON format, it will transformed before being stored.

For **update** and **delete**, you must pass the `_id` and the `_rev`as part
of the input `msg` object.
