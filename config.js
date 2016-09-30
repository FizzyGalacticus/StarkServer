var config = {
    ports: {
        http: 80,
        https:443
    },
    ssl: {
        cert:'/path/to/cert/file.pem',
        key: '/path/to/key/file.pem'
    },
    domains: {
        name:{
                host               :'localhost',
                baseDirectory      :'/path/to/dir',
                allowedFileTypes   :['js','css','html'],
                index              :'/path/to/index/file', //Optional,
                filesToIgnore      :['.gitignore'], //Optional
                directoriesToIgnore:['.git'] //Optional
        }
    },
    drivers: {
        name: {
            driverFile: '/path/to/driver/file',
            fileTypes:['driver-file-type']
        }
    }
};

module.exports = config;