var fs       = require('fs');
var http     = require('http');

SimpleServer = function() {
    this.dispatcher = require('httpdispatcher');
    this.domains    = [];
};

SimpleServer.prototype.addDomains = function(doms) {
    this.domains.push(doms);
};

SimpleServer.prototype.setAllowedFileTypes = function(domain, types) {
    for (var i = this.domains.length - 1; i >= 0; i--) {
        if(this.domains[i].name == domain) {
            this.domains[i].allowedFileTypes = types;
            break;
        }
    };
};