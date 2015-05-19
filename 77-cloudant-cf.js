/**
 * Copyright 2014 IBM Corp.
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
module.exports = function(RED) {
    "use strict";

    var url         = require('url');
    var querystring = require('querystring');
    var cfEnv       = require("cfenv");
    var Cloudant    = require("cloudant");

    var MAX_ATTEMPTS = 3;

    var appEnv   = cfEnv.getAppEnv();
    var services = [];

    // load the services bindded to this application
    for (var i in appEnv.services) {
        // filter the services to include only the Cloudant ones
        if (i.match(/^(cloudant)/i)) {
            services = services.concat(appEnv.services[i].map(function(v) {
                return { name: v.name, label: v.label };
            }));
        }
    }

    //
    // HTTP endpoints that will be accessed from the HTML file
    //
    RED.httpAdmin.get('/cloudant/vcap', function(req,res) {
        res.send(JSON.stringify(services));
    });

    // REMINDER: routes are order dependent
    RED.httpAdmin.get('/cloudant/:id', function(req,res) {
        var credentials = RED.nodes.getCredentials(req.params.id);

        if (credentials) {
            res.send(JSON.stringify(
              {
                  username: credentials.username,
                  hasPassword: (credentials.password && credentials.password !== "")
              }
            ));
        } else {
            res.send(JSON.stringify({}));
        }
    });

    RED.httpAdmin.delete('/cloudant/:id', function(req,res) {
        RED.nodes.deleteCredentials(req.params.id);
        res.send(200);
    });

    RED.httpAdmin.post('/cloudant/:id', function(req,res) {
        var newCreds = req.body;
        var credentials = RED.nodes.getCredentials(req.params.id) || {};

        if (newCreds.username == null || newCreds.username == "") {
            delete credentials.username;
        } else {
            credentials.username = newCreds.username;
        }

        if (newCreds.password == "") {
            delete credentials.password;
        } else {
            credentials.password = newCreds.password || credentials.password;
        }

        RED.nodes.addCredentials(req.params.id, credentials);
        res.send(200);
    });

    //
    // Create and register nodes
    //
    function CloudantNode(n) {
        RED.nodes.createNode(this, n);

        this.name     = n.name;
        this.hostname = n.hostname;

        var credentials = RED.nodes.getCredentials(n.id);
        if (credentials) {
            this.username = credentials.username;
            this.password = credentials.password;
        }

        var parsedUrl = url.parse(this.hostname);
        var authUrl   = parsedUrl.protocol+'//';

        if (this.username && this.password) {
            authUrl += this.username + ":" + encodeURIComponent(this.password) + "@";
        }
        authUrl += parsedUrl.hostname;

        this.url = authUrl;
    }
    RED.nodes.registerType("cloudant", CloudantNode);

    function CloudantOutNode(n) {
        RED.nodes.createNode(this,n);

        this.operation      = n.operation;
        this.payonly        = n.payonly || false;
        this.database       = n.database;
        this.cloudantConfig = _getCloudantConfig(n);

        var node = this;
        var credentials = {
            account:  node.cloudantConfig.credentials.username,
            password: node.cloudantConfig.credentials.password
        };

        Cloudant(credentials, function(err, cloudant) {
            if (err) { node.error(err); }
            else {
                // check if the database exists and create it if it doesn't
                createDatabase(cloudant, node);

                node.on("input", function(msg) {
                    handleMessage(cloudant, node, msg);
                });
            }
        });

        function createDatabase(cloudant, node) {
            cloudant.db.list(function(err, all_dbs) {
                if (err) { node.error(err); }
                else {
                    if (all_dbs && all_dbs.indexOf(node.database) < 0) {
                        cloudant.db.create(node.database);
                    }
                }
            });
        }

        function handleMessage(cloudant, node, msg) {
            if (node.operation === "insert") {
                var msg  = node.payonly ? msg.payload : msg;
                var root = node.payonly ? "payload" : "msg";
                var doc  = parseMessage(msg, root);

                insertDocument(cloudant, node, doc, MAX_ATTEMPTS, function(err, body) {
                    if (err) { node.error(err); }
                });
            }
            else if (node.operation === "delete") {
                var doc = parseMessage(msg.payload || msg, "");

                if ("_rev" in doc && "_id" in doc) {
                    var db = cloudant.use(node.database);
                    db.destroy(doc._id, doc._rev, function(err, body) {
                        if (err) { node.error(err); }
                    });
                } else {
                    node.error("_rev and _id are required to delete a document");
                }
            }
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
            return msg;
        }

        // Inserts a document +doc+ in a database +db+ that migh not exist
        // beforehand. If the database doesn't exist, it will create one
        // with the name specified in +db+. To prevent loops, it only tries
        // +attempts+ number of times.
        function insertDocument(cloudant, node, doc, attempts, callback) {
            var db = cloudant.use(node.database);
            db.insert(doc, function(err, body) {
                if (err && err.status_code === 404 && attempts > 0) {
                    // status_code 404 means the database was not found
                    return cloudant.db.create(db.config.db, function() {
                        insertDocument(cloudant, node, doc, attempts-1, callback);
                    });
                }

                callback(err, body);
            });
        }
    };
    RED.nodes.registerType("cloudant out", CloudantOutNode);

    function CloudantInNode(n) {
        RED.nodes.createNode(this,n);

        this.cloudantConfig = _getCloudantConfig(n);
        this.database       = n.database;
        this.search         = n.search;
        this.design         = n.design;
        this.index          = n.index;
        this.inputId        = "";

        var node = this;
        var credentials = {
            account:  node.cloudantConfig.credentials.username,
            password: node.cloudantConfig.credentials.password
        };

        Cloudant(credentials, function(err, cloudant) {
            if (err) { node.error(err); }
            else {
                node.on("input", function(msg) {
                    var db = cloudant.use(node.database);
                    var options = (typeof msg.payload === "object") ? msg.payload : {};

                    if (node.search === "_id_") {
                        var id = getDocumentId(msg.payload);
                        node.inputId = id;

                        db.get(id, function(err, body) {
                            sendDocumentOnPayload(err, body, msg);
                        });
                    }
                    else if (node.search === "_idx_") {
                        options.query = options.query || options.q || formatSearchQuery(msg.payload);
                        options.include_docs = options.include_docs || true;
                        options.limit = options.limit || 200;
                        
                        if (options.sort) {
                            options.sort = JSON.stringify(options.sort);
                        }

                        db.search(node.design, node.index, options, function(err, body) {
                            sendDocumentOnPayload(err, body, msg);
                        });
                    }
                    else if (node.search === "_all_") {
                        options.include_docs = options.include_docs || true;

                        db.list(options, function(err, body) {
                            sendDocumentOnPayload(err, body, msg);
                        });
                    }
                });
            }
        });

        function getDocumentId(payload) {
            if (typeof payload === "object") {
                if ("_id" in payload || "id" in payload) {
                    return payload.id || payload._id;
                }
            }

            return payload;
        }

        function formatSearchQuery(query) {
            if (typeof query === "object") {
                // useful when passing the query on HTTP params
                if ("q" in query) { return query.q; }

                var queryString = "";
                for (var key in query) {
                    queryString += key + ":" + query[key] + " ";
                }

                return queryString.trim();
            }
            return query;
        }

        function sendDocumentOnPayload(err, body, msg) {
            if (!err) {
                msg.cloudant = body;

                if ("rows" in body) {
                    msg.payload = body.rows.
                        map(function(el) {
                            if (el.doc._id.indexOf("_design/") < 0) {
                                return el.doc;
                            }
                        }).
                        filter(function(el) {
                            return el !== null && el !== undefined;
                        });
                } else {
                    msg.payload = body;
                }
            }
            else {
                msg.payload = null;

                if (err.description === "missing") {
                    node.warn("Document '" + node.inputId + "' not found in database '" +
                                node.database + "'.");
                } else {
                    node.error(err.reason);
                }
            }

            node.send(msg);
        }
    }
    RED.nodes.registerType("cloudant in", CloudantInNode);

    function _getCloudantConfig(n) {
        if (n.service === "_ext_") {
            return RED.nodes.getNode(n.cloudant);
        } else if (n.service !== "") {
            return appEnv.getService(n.service);
        }
    }
};
