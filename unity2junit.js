var fs = require('fs');

unity2junit = {
    convert: function(unity_text, junit_output) 
    {
        var tests = [];

        if(!fs.existsSync(unity_text)) {
			console.log(`Specified unity output '${unity_text}' does not exist`)
			return;
		}
 
        try 
        {
            var lines = fs.readFileSync(unity_text, 'utf-8').split('\n')
            for (var i = 0; i < lines.length; i++) {
                line = lines[i];
                if (line.indexOf('--------------------') > -1) {
                    break;
                }
                if (line.indexOf('PASS') > -1 || line.indexOf('FAIL') > -1) {
                    var test = unity2junit.getTestFromLine(line);
                    if (test !== undefined) {
                        tests.push(unity2junit.getTestFromLine(line));  
                    }
                }   
            }
        }
        catch(err)
        {			
            console.log(`Failed parsing '${unity_text}'`)
            console.log(err)
            return;
        }
        unity2junit.writeToFile(tests, junit_output);
    },

    getTestFromLine: function(line) {
        /* Example output
            testrunner.c:54:test_function1:PASS
            testrunner.c:33:test_function2: FAIL: Expected TRUE Was FALSE
        */

        var parts = line.split(':');
        if (parts.length < 2) {
            return undefined;
        }

        var name = "";
        var message = "";
        var success = undefined;
        for (var i = 0; i < parts.length; i++) {
            part = parts[i];
            if (i == 0) {
                name = part;
            } else {
                if (part.indexOf('PASS') > -1) {
                    success = true;
                    if (parts.length >= i + 2) {
                        message = parts.slice(i, parts.length).join(':').trim();
                    }
                    break;
                }
                if (part.indexOf('FAIL') > -1) {
                    success = false;
                    if (parts.length >= i + 2) {
                        message = parts.slice(i, parts.length).join(':').trim();
                    }
                    break;
                } else {
                    name += ":" + part;
                } 
            }
        }

        if (success === undefined) {
            return undefined;
        } else {
            return {
                name,
                message,
                success
            }
        }
    },

    writeToFile: function(tests, junit_output) {
        var wrline = fs.createWriteStream(junit_output, {flags:'w'});
        wrline.write(`<testsuite tests=\"${tests.length}\">\n`);
        tests.forEach(test => {
            wrline.write(`\t<testcase name=\"${test.name}\">\n`);
            if (!test.success) {
                wrline.write(`\t\t<failure>${test.message}</failure>\n`);
            }
            wrline.write(`\t</testcase>\n`);
        })
        wrline.write(`</testsuite>\n`);
        console.log(`Wrote Junit file '${junit_output}'`)
    }
}

console.log("Converting Unity results to Junit");
var unity_text = process.argv.slice(2)[0];
var junit_output = process.argv.slice(2)[1];
var example_of_use = "Example: unity2junit.js unity-output.txt myreport.xml"
if (typeof unity_text === 'undefined') {
    console.log("Missing Unity input file");
    console.log(example_of_use);
	return;
} 
if (typeof junit_output === 'undefined') {
    console.log("Specify junit output file");
    console.log(example_of_use);
	return;
} 

unity2junit.convert(unity_text, junit_output);
