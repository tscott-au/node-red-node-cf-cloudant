/**
 * Copyright 2014,2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var Cloudant = require('cloudant');
var debug = require('debug')('node-red:cloudant:out');
var utils = require('../utils');

var MAX_ATTEMPTS = 3;

module.exports = function(RED) {
    return function(config) {
        RED.nodes.createNode(this, config);

        this.operation = config.operation;
        this.payonly = config.payonly || false;
        this.database = utils.cleanDatabaseName(config.database, this);
        this.cloudantConfig = utils.getCloudantConfig(RED, config);

        var node = this;
        var credentials = {
            account: node.cloudantConfig.account,
            key: node.cloudantConfig.username,
            password: node.cloudantConfig.password,
            url: node.cloudantConfig.url
        };

        Cloudant(credentials, function(err, cloudant) {
            if (err) {
                node.error(err.description);
                return;
            }

            // check if the database exists and create it if it doesn't
            createDatabase(cloudant, node.database, function(err, body) {
                if (err) {
                    node.error('Failed to create database: ' + err.description, err);
                }
            });

            node.on('input', function(msg) {
                // Node-RED adds a _msgid field to every message.
                //we probably don't need to store it
                delete msg._msgid;
                handleMessage(cloudant, node, msg);
            });
        });
    };
};

function createDatabase(cloudant, database, callback) {
    cloudant.db.create(database, function(err, body) {
        if (err) {
            if (err.error === 'file_exists') {
                // database already exists. we're all good
                return;
            }

            if (err.error === 'forbidden') {
                // we are probably using an api key, so we can assume
                // the database already exists
                return;
            }
        }

        if (callback) {
            process.nextTick(function() {
                callback(err, body);
            });
        }
    });
}

function handleMessage(cloudant, node, msg) {
    if (node.operation === 'insert') {
        var msg = node.payonly ? msg.payload : msg;
        var root = node.payonly ? 'payload' : 'msg';
        var doc = parseMessage(msg, root);
        var db = cloudant.use(node.database);

        insertDocument(doc, db, MAX_ATTEMPTS, function(err, body) {
            if (err) {
                var errorMessage = 'Failed to insert document: ' + err.description;
                debug(errorMessage);
                node.error(errorMessage, msg);
                return;
            }

            msg.payload = body;
            node.send(msg);
        });
    }
    else if (node.operation === "delete") {
        var doc = parseMessage(msg.payload || msg, "");
        var db = cloudant.use(node.database);

        deleteDocument(doc, db);
    }
}

// Inserts a document +doc+ in a database +db+ that migh not exist
// beforehand. If the database doesn't exist, it will create one
// with the name specified in +db+. To prevent loops, it only tries
// +attempts+ number of times.
function insertDocument(doc, db, attempts, callback) {
    db.insert(doc, function(err, body) {
        if (err && attempts > 0) {
            if (err.error === 'not_found') {
                // database not found, let's create it
                createDatabase(cloudant, db.config.db, function() {
                    insertDocument(doc, db, attempts-1, callback);
                });
            }
            else {
                insertDocument(doc, db, attempts-1, callback);
            }

            return;
        }

        if (callback) {
            process.nextTick(function() {
                callback(err, body);
            });
        }
    });
}

function deleteDocument(doc, db, callback) {
    if (!("_rev" in doc) || !("_id" in doc)) {
        var err = new Error("_id and _rev are required to delete a document");

        if (callback) {
            process.nextTick(function() {
                callback(err);
            });
        }
    }

    db.destroy(doc._id, doc._rev, callback);
}

function parseMessage(msg, root) {
    if (typeof msg !== "object") {
        try {
            msg = JSON.parse(msg);
            // JSON.parse accepts numbers, so make sure that an
            // object is return, otherwise create a new one
            if (typeof msg !== "object") {
                msg = JSON.parse('{"' + root + '":"' + msg + '"}');
            }
        } catch (e) {
            // payload is not in JSON format
            msg = JSON.parse('{"' + root + '":"' + msg + '"}');
        }
    }
    return utils.cleanMessage(msg);
}
