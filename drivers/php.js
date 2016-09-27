var exec = require('child_process').exec;

PHPDriver   = function(server_vars) {
    this.server = server_vars;
};

PHPDriver.prototype.onGet = function(file, params, callback) {
    this.execute(file, callback, params, {});
};

PHPDriver.prototype.onPost = function(file, params, callback) {
    this.execute(file, callback, {}, params);
};

PHPDriver.prototype.execute = function(file, callback, getParams, postParams) {
    var self         = this;
    var paramObjects = [[this.server, '$_SERVER'], [getParams, '$_GET'], [postParams, '$_POST']];
    var cmd          = '';

    this.server.script_filename = file;
    this.server.script_name     = file.substring(this.server.document_root.length);

    cmd += 'php -e -r \'';

    for(var i = 0; i < paramObjects.length; i++) {
        for(var j = 0; j < Object.keys(paramObjects[i][0]).length; j++) {
            var key   = Object.keys(paramObjects[i][0])[j];
            var value = paramObjects[i][0][key];
            if(paramObjects[i][1] == '$_SERVER')
                key = key.toUpperCase();

            cmd += 'empty(' + paramObjects[i][1] + '["' + key + '"]);';
            cmd += paramObjects[i][1] + '["' + key + '"] = ' + (typeof value == 'string' ? ('"' + value + '"'):value) + ';';
        }
    }

    cmd += 'include "' + file + '";';
    cmd += '\'';
    cmd = cmd.replace(/\\\'/g, "''");

    exec(cmd, function(error, stdout, stderr) {
        callback(self.getMimeType(), stdout, stderr);
    });
};

PHPDriver.prototype.getMimeType = function() {
    return 'text/html';
};

module.exports = PHPDriver;