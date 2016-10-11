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

module.exports = function(RED) {
    'use strict';

    var cfEnv = require('cfenv');
    var CloudantConfigNode = require('./nodes/configuration')(RED);
    var CloudantModifyNode = require('./nodes/modify')(RED);
    var CloudantQueryNode = require('./nodes/query')(RED);
    var CloudantAttachmentNode = require('./nodes/attachments')(RED);

    // HTTP endpoint to list CloudFoundry services that are available to the app
    RED.httpAdmin.get('/cloudant/vcap', function(req,res) {
        var appEnv = cfEnv.getAppEnv();
        var services = [];

        for (var service in appEnv.services) {
            // filter the services to include only the Cloudant ones
            if (service.match(/^(cloudant)/i)) {
                services = services.concat(appEnv.services[service].map(function(v) {
                    return { name: v.name, label: v.label };
                }));
            }
        }

        res.send(JSON.stringify(services));
    });

    // Register nodes
    RED.nodes.registerType('cloudant', CloudantConfigNode, {
        credentials: {
            pass: { type: 'password' },
            username: { type: 'text' }
        }
    });

    RED.nodes.registerType('cloudant out', CloudantModifyNode);
    RED.nodes.registerType('cloudant mid out', CloudantModifyNode);

    RED.nodes.registerType('cloudant in', CloudantQueryNode);

    RED.nodes.registerType('cloudant attachment in', CloudantAttachmentNode);
};
