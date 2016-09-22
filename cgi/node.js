var exec = require('child_process').exec;

NodeCGI  = function() {};

NodeCGI.prototype.onGet = function(file, params, callback) {
    this.execute(file, callback, params, {});
};

NodeCGI.prototype.onPost = function(file, params, callback) {
    this.execute(file, callback, {}, params);
};

NodeCGI.prototype.execute = function(file, callback, getParams, postParams) {
    var self = this;
    var cmd  = '';

    exec('cat ' + file + ' | head -n 1', function(error, stdout, stderr) {
        var isNodeFile = (stdout && stdout.substring(0,6) == '//NODE');

        if(isNodeFile) {
            if(getParams && Object.keys(getParams).length > 0) {
                cmd  = 'node ' + file + ' ' + JSON.stringify(getParams);
            }
            else if(postParams && Object.keys(postParams).length > 0) {
                cmd  = 'node ' + file + ' ' + JSON.stringify(postParams);
            }
            else cmd = 'node ' + file;

            exec(cmd, function(error, stdout, stderr) {
                callback(self.getMimeType(), stdout, stderr);
            });
        }
        else {
            if(callback)
                callback('NOT_SUPPORTED_FILE', file);
        }
    });
};

NodeCGI.prototype.getMimeType = function() {
    return 'text/html';
};

module.exports = new NodeCGI();