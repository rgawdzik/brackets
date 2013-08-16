/*
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, forin: true, maxerr: 50, regexp: true */
/*global define, $, brackets, window */

define(function LiveDevelopment(require, exports, module) {
    "use strict";

    function ServerRequestManager(config) {
        console.assert(config.server.setRequestFilterPaths);

        this._server        = config.server;
        this._pathResolver  = config.pathResolver; // ProjectManager.makeProjectRelativeIfPossible(doc.file.fullPath)
        this._liveDocuments = {};
        this._onRequest     = this._onRequest.bind(this);
        this._started       = false;
    }

    ServerRequestManager.prototype._documentKey = function (liveDocument) {
        return "/" + encodeURI(this._pathResolver(liveDocument.doc.file.fullPath));
    };

    /**
     * Adds a live document to the request filter
     * @param {Object} liveDocument A document that supports instrumentation (setInstrumentationEnabled)
     */
    ServerRequestManager.prototype.add = function (liveDocument) {
        if (!liveDocument && !liveDocument.setInstrumentationEnabled) {
            return;
        }
        
        // enable instrumentation
        liveDocument.setInstrumentationEnabled(true);

        // use the project relative path as a key to lookup requests
        var key = this._documentKey(liveDocument);
        this._liveDocuments[key] = liveDocument;
        
        // update the paths to watch
        this._updateRequestFilterPaths();
    };

    /**
     * Removes a live document from the request filter.
     * @param {Object} liveDocument A document that supports instrumentation (setInstrumentationEnabled)
     */
    ServerRequestManager.prototype.remove = function (liveDocument) {
        var key = this._liveDocuments[this._documentKey(liveDocument)];
        
        if (key) {
            delete this._liveDocuments[key];
        }
        
        this._updateRequestFilterPaths();
    };

    ServerRequestManager.prototype.clear = function () {
        this._liveDocuments = {};
        this._updateRequestFilterPaths();
    };

    /**
     * @private
     * Update the list of paths that fire "request" events
     */
    ServerRequestManager.prototype._updateRequestFilterPaths = function () {
        if (!this._started) {
            return;
        }

        var paths = [];

        Object.keys(this._liveDocuments).forEach(function (path) {
            paths.push(path);
        });

        this._server.setRequestFilterPaths(paths);
    };

    ServerRequestManager.prototype._onRequest = function (event, request) {
        var key             = request.location.pathname,
            liveDocument    = this._liveDocuments[key],
            response;

        // send instrumented response or null to fallback to static file
        response = liveDocument && liveDocument.getResponseData ? liveDocument.getResponseData() : null;
        request.send(response);
    };

    ServerRequestManager.prototype.start = function () {
        if (!this._started) {
            this._started = true;

            this._updateRequestFilterPaths();
            
            // Send custom HTTP response for the current live document
            $(this._server).on("request.ServerRequestManager", this._onRequest);
        }
    };

    ServerRequestManager.prototype.stop = function () {
        if (this._started) {
            // remoe event handler
            $(this._server).off(".ServerRequestManager", this._onRequest);
            
            // clear filters
            this._server.setRequestFilterPaths([]);
        }

        this._started = false;
    };

    exports.ServerRequestManager = ServerRequestManager;
});