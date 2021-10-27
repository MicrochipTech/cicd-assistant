var net = require('net');
var fs = require('fs');
var done = false;

socket2file = {
    run: function (output_file, host, port) {
        function cleanData(data) {
            try {
                if (data === null) {
                    return "";
                }
                // Keep only normal text chars
                var invalidChars = /[^\n\r\u0020 -~]+/g;
                return data.toString().replace(invalidChars, "").trim();
            } catch (e) {
                console.log("Exception " + str(e));
                return "";
            }
        }
        
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

        client.on('data', function (raw) {
            var data = cleanData(raw);
            if (data.length > 0) {
                console.log('Received data:' + data);
                wrline.write(data);
            }
        });

        client.on('close', function () {
            console.log('Connection closed');
            if (!done) {
                client.connect(port, host, function () {
                    console.log('Reconnected');
                });
            }
        });

        client.on('error', function () {
            console.log('Connection error');
            process.exit(-1);
        })

        process.on('SIGINT', function () {
            console.log('Recieved SIGINT, shutting down..')
            try {
                done = true;
                client.destroy();
            } catch (e) {
                console.log("Failed to destroy connection" + e.message);
            }
            console.log("Socket destroyed");
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

// Remove possible leading zeros
host = host.split('.').map(Number).join('.');

socket2file.run(output_file, host, port)
