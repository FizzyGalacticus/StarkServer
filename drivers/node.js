var exec = require('child_process').exec;

NodeDriver  = function(server_vars) {
    this.server = server_vars;
    console.log(JSON.stringify(this.server));
};

NodeDriver.prototype.onGet = function(file, params, callback) {
    this.execute(file, callback, params, {});
};

NodeDriver.prototype.onPost = function(file, params, callback) {
    this.execute(file, callback, {}, params);
};

NodeDriver.prototype.execute = function(file, callback, getParams, postParams) {
    var self = this;
    var cmd  = '';
    
    exec('cat ' + file + ' | head -n 1', function(error, stdout, stderr) {
        var isNodeFile = (stdout && stdout.substring(0,6) == '//NODE');

        if(isNodeFile) {
            if(getParams && Object.keys(getParams).length > 0) {
                cmd  = 'node ' + file + ' \'' + JSON.stringify({mode:"GET", params:getParams}) + '\'';
            }
            else if(postParams && Object.keys(postParams).length > 0) {
                cmd  = 'node ' + file + ' \'' + JSON.stringify({mode:"POST", params:postParams}) + '\'';
            }
            else cmd = 'node ' + file + ' \'' + JSON.stringify({mode:"GET"}) + '\'';

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

NodeDriver.prototype.getMimeType = function() {
    return 'text/html';
};

module.exports = NodeDriver;