var net = require('net');
var fs = require('fs');

socket2file = {
    run: function (output_file, host, port) {
        var wrline = fs.createWriteStream(output_file, { flags: 'w' });
        wrline.on('error', function(err) {
            console.log(`Error writing to '${output_file}'`);
            console.log(err);
            process.exit(-1);
        })
        console.log(`Writing to file '${output_file}'`)
        var client = new net.Socket();

        console.log(`Connecting to ${host}:${port}..`);
        client.connect(port, host, function () {
            console.log('Connected');
        });

        client.on('data', function (data) {
            console.log('Recieved data: ' + data);
            wrline.write(`${data}\n`);
        });

        client.on('close', function () {
            console.log('Connection closed');
        });

        client.on('error', function () {
            console.log('Connection error');
            process.exit(-1);
        })

        process.on('SIGINT', function () {
            client.destroy();
            process.exit();
        });
    }
}

console.log("Write socket output to file");
var output_file = process.argv.slice(2)[0];
var host = process.argv.slice(2)[1];
var port = process.argv.slice(2)[2];
var example_of_use = "Example: socket2file.js output.txt 127.0.0.1 65432"

if (typeof output_file === 'undefined') {
    console.log("Missing output file");
    console.log(example_of_use);
    return;
}
if (typeof host === 'undefined') {
    console.log("Missing host");
    console.log(example_of_use);
    return;
}
if (typeof port === 'undefined') {
    console.log("Missing port");
    console.log(example_of_use);
    return;
}

socket2file.run(output_file, host, port)
