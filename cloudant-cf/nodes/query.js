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
var debug = require('debug')('node-red:cloudant:in');
var utils = require('../utils');

module.exports = function(RED) {
    return function(config) {
        RED.nodes.createNode(this, config);

        this.cloudantConfig = utils.getCloudantConfig(RED, config);
        this.database = utils.cleanDatabaseName(config.database, this);
        this.search = config.search;
        this.design = config.design;
        this.index = config.index;
        this.inputId = '';

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

            node.on('input', function(msg) {
                var db = cloudant.use(node.database);
                var options = (typeof msg.payload === 'object') ? msg.payload : {};

                if (node.search === '_id_') {
                    var id = utils.getDocumentId(msg);
                    node.inputId = id;

                    db.get(id, function(err, body) {
                        sendDocumentOnPayload(err, body, node, msg);
                    });
                }
                else if (node.search === '_idx_') {
                    options.query = options.query || options.q || formatSearchQuery(msg.payload);
                    options.include_docs = options.include_docs || true;
                    options.limit = options.limit || 200;

                    db.search(node.design, node.index, options, function(err, body) {
                        sendDocumentOnPayload(err, body, node, msg);
                    });
                }
                else if (node.search === '_all_') {
                    options.include_docs = options.include_docs || true;

                    db.list(options, function(err, body) {
                        sendDocumentOnPayload(err, body, node, msg);
                    });
                }
            });
        });
    };
};

function formatSearchQuery(query) {
    if (typeof query === 'object') {
        // useful when passing the query on HTTP params
        if ('q' in query) { return query.q; }

        var queryString = '';
        for (var key in query) {
            queryString += key + ':' + query[key] + ' ';
        }

        return queryString.trim();
    }
    return query;
}

function sendDocumentOnPayload(err, body, node, msg) {
    if (err) {
        msg.payload = null;

        if (err.error === 'not_found') {
            var notFoundMsg = 'Document "' + node.inputId + '" not found in database "' + node.database + '".';
            node.warn(notFoundMsg, msg);
        } else {
            var errorMessage = 'Failed to retrieve documents: ' + err.description;
            node.error(errorMessage, msg);
        }

        node.send(msg);
        return;
    }

    var payload = '';

    if ('rows' in body) {
        payload = body.rows.
            map(function(el) {
                if (el.doc._id.indexOf('_design/') < 0) {
                    return el.doc;
                }
            }).
            filter(function(el) {
                return el !== null && el !== undefined;
            });
    } else {
        payload = body;
    }

    msg.payload = payload;
    msg.cloudant = payload;

    node.send(msg);
}
