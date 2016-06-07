var config = {
    domains: {
        name:{
                host            :'localhost',
                baseDirectory   :'/path/to/dir',
                allowedFileTypes:['js','css','html'],
                onPost          :function(params, file) {
                        //post stuff here
                }
        }
    },
    cgis: {
        name: {
            cgiFile: '/path/to/cgi/file',
            fileTypes:['php']
        }
    }
}

module.exports = config;