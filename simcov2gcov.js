const path = require('path');
const fs = require('fs');
const readline = require('readline');
const nl = require('os').EOL;

var self = {
	
	projectFolder:undefined,
	sourceFiles:undefined,
	coverageFile:undefined,
	coveredLines:undefined,
	notCoveredLines:undefined,
	rdline: undefined,	
	callback:undefined,
	isError:false,
	logData:undefined,
	resolve:undefined,
	reject:undefined,
	
	createFiles: function(coverageFile, projectFolder)
	{
		if(!fs.existsSync(projectFolder)) {
			console.log(`Specified project folder '${projectFolder}' is not valid`)
			return;
		}

		if(!fs.existsSync(coverageFile)) {
			console.log(`Specified code coverage file '${coverageFile}' is not valid`)
			return;
		}

				
		self.projectFolder = projectFolder;		
		self.coverageFile = coverageFile;
		
		var promise = new Promise(function(resolve,reject)
		{
			self.resolve = resolve;
			self.reject = reject;			
			self.isError = false;
			self.logData = '';

			try 
			{				
				self.sourceFiles = self.findFilesInProject(projectFolder);
				self.writeGcovFiles();
			}
			catch(err)
			{			
				self.isError = true;
				self.logData += err.message;
				self.exitFromGcov();
			}
		});
		return promise;
	},

	findFilesInProject: function(dir)
	{
		var files = [];
		var list = fs.readdirSync(dir);
		list.forEach(function(file) 
		{
			file = path.join(dir,file);
			var stat = fs.statSync(file);
			if(stat && stat.isDirectory()) 
			{
				//recurse into a subdirectory 
				files = files.concat(self.findFilesInProject(file));
			} 
			else 
			{
				var ext = path.extname(file);
				if(ext.match(new RegExp("^((\.cp{0,2})|(\.s)|(\.asm{0,1}))$","gi")))
				{
					files.push(path.resolve(file));			
				} 
			}
		});
		return files;
	},

	getCoverageData: function(sourceFile,callbackFunction)
	{
		console.log(`Getting coverage from '${sourceFile}'`)

		var sFile = sourceFile;
		var fileName = path.basename(sFile,'.c');
		var fileName = `${fileName}.c`;
		var coverFile = self.coverageFile;
		self.callback = callbackFunction;	
		self.coveredLines = [];
		self.notCoveredLines = [];
		var isFileData = false;
		var isCodeCovered = false;
		
		var dataIn = fs.createReadStream(coverFile);		
		dataIn.on('error', function(err)
		{
			self.isError = true;
			self.logData = err.message;
			self.exitFromGcov();
		});
		
		self.rdline = readline.createInterface({
			input: dataIn,
			ctrlfDelay: Infinity
		});
		
		self.rdline.on('line',(line) => {		

		
			if(line.indexOf('Code Coverage Map') > -1) {			
				isCodeCovered = true;
			}
			if(line.indexOf('Code Not Covered Map') > -1) {			
				isCodeCovered = false;
			}
		
			if(isFileData == false) {			
				regx = `\/${fileName}$`;
				if(line.match(new RegExp(regx,"g"))) {
					isFileData = true; 
				}
			}
			if(isFileData == true) {
				if(line.indexOf('from Line') > -1) {
					var data = line.split(',');
					data = data[0].split('=');
					data = data[1];
					if(true == isCodeCovered){
						self.coveredLines.push(parseInt(data));
					} else {
						self.notCoveredLines.push(parseInt(data));
					}
				}
				if(line.indexOf('to Line') > -1) {
					var data = line.split(',');
					data = data[0].split('=');
					data = data[1];
					if(true == isCodeCovered){
						self.coveredLines.push(parseInt(data));
					} else {
						self.notCoveredLines.push(parseInt(data));
					}				
					isFileData = false;
				}
			}
		});
		
		self.rdline.on('close',function() {
			
			self.coveredLines = self.coveredLines.sort((a, b) => a - b);
			self.notCoveredLines = self.notCoveredLines.sort((a, b) => a - b);	

			var data = {'sourceFile':sFile,
						'coveredLines':self.coveredLines,
						'notCoveredLines':self.notCoveredLines};
			if(data.coveredLines.length || data.notCoveredLines.length)
				self.writeGcovFile(data);
			else
				self.callback();
		});
	},

	writeGcovFile: function(data)
	{
		var sourceFile = data.sourceFile;
		var coveredLines = data.coveredLines;
		var notCoveredLines = data.notCoveredLines;		
		var gcovFile = `${sourceFile}.gcov`;	
		var fileName = path.basename(sourceFile,'.c');	
		var wrline = fs.createWriteStream(gcovFile, {flags:'w'});

		console.log(`Writing to ${sourceFile}`);
		
		wrline.write(`        -:    0:Source:${sourceFile}${nl}`);
		wrline.write(`        -:    0:Graph:${fileName}.gcno${nl}`);
        wrline.write(`        -:    0:Data:${fileName}.gcda${nl}`);
        wrline.write(`        -:    0:Runs:1${nl}`);
        wrline.write(`        -:    0:Programs:1${nl}`);
		
		var lineCntr = 1;
		var coveredCntr = 0;
		var notCoveredCntr = 0;
		var inRange = false;
		var codeCovered = false;
		var isString = false;
		
		var codeWithComments = fs.readFileSync(sourceFile,'utf8');		
		var codeWithoutComments = self.removeComments(codeWithComments);

		cmtCodeArray = codeWithComments.split('\n');
		nocmtCodeArray = codeWithoutComments.split('\n');		
		
		for (i in cmtCodeArray)
		{
			var cmtLine = cmtCodeArray[i];
			var nocmtLine = nocmtCodeArray[i];
			cmtLine = cmtLine.trim();
			nocmtLine = nocmtLine.trim();
			
			if(nocmtLine.match(new RegExp('^\s*$','g')))  //newline
			{
				wrline.write(`        -:    ${lineCntr}:${cmtLine}${nl}`);
			}
			else if(nocmtLine.match(new RegExp('(.*)}(.*?)','g')))  // closing bracket
			{
				wrline.write(`        -:    ${lineCntr}:${cmtLine}${nl}`);	
			}
			else if(nocmtLine.match(new RegExp('(.*){(.*?)','g')))  // opening bracket
			{	
				wrline.write(`        -:    ${lineCntr}:${cmtLine}${nl}`);		
			}
			
			else if((lineCntr >= coveredLines[coveredCntr]) && (lineCntr <= coveredLines[coveredCntr+1])) // covered lines
			{
				inRange = true;
				codeCovered = true;
				wrline.write(`        1:    ${lineCntr}:${cmtLine}${nl}`);			
			}
			else if((lineCntr >= notCoveredLines[notCoveredCntr]) && (lineCntr <= notCoveredLines[notCoveredCntr+1])) // not covered lines
			{
				inRange = true;
				codeCovered = false;
				wrline.write(`    #####:    ${lineCntr}:${cmtLine}${nl}`);
			}
			else
			{
				wrline.write(`        -:    ${lineCntr}:${cmtLine}${nl}`);
			}
			if(true == inRange) 
			{
				if(true == codeCovered) 
				{
					if(lineCntr == coveredLines[coveredCntr+1])
					{
						inRange = false;
						codeCovered = false;
						coveredCntr = coveredCntr+2;
					}
				}
				else 
				{
					if(lineCntr == notCoveredLines[notCoveredCntr+1])
					{
						inRange = false;
						notCoveredCntr = notCoveredCntr+2;							
					}					
				}
			}
			else 
			{
				if(lineCntr == coveredLines[coveredCntr+1])
				{
					codeCovered = false;
					coveredCntr = coveredCntr+2;
				}
				if(lineCntr == notCoveredLines[notCoveredCntr+1])
				{
					codeCovered = false;
					notCoveredCntr = notCoveredCntr+2;
				}
			}
			lineCntr++;	
		}	
		wrline.end();
		console.log(`Wrote gcov file '${gcovFile}'`);
		self.callback();
	},

	writeGcovFiles: function()
	{
		if(self.sourceFiles.length == 0)
		{
			self.exitFromGcov();
		}
		else
		{
			var sfile = self.sourceFiles.shift();
			self.getCoverageData(sfile,self.writeGcovFiles);	
		}
	},
	
	removeComments: function(program)
	{
		var len = program.length;	
		var res = '';
		var single_comment = false;
		var block_comment = false;	
		
		for(var i=0;i<len;i++)
		{
			if(single_comment==true && program[i]=='\n')
			{
				single_comment=false;
				res +=program[i];
			}
			else if(block_comment==true && program[i]=='*' && program[i+1]=='/')
			{
				block_comment=false;
				i++;
			}
			else if(single_comment || block_comment)
			{
				if(program[i]=='\n')
				{
					res+=program[i];				
				}
				continue;
			}
			else if(program[i]=='/' && program[i+1]=='/')
			{
				single_comment=true;
				i++;
			}
			else if(program[i]=='/' && program[i+1]=='*')
			{
				block_comment=true;
				i++;
			}
			else
			{
				res+= program[i];
			}
		}	
		return res;
	},
	
	exitFromGcov: function()
	{
		if(true == self.isError)
		{	
			self.reject({result:false,logData:self.logData});
		}
		else
		{
			self.resolve({result:true,logData:self.logData});
		}
	}	
}


console.log("Converting simulator coverage to gcov");
var coverage_file = process.argv.slice(2)[0];
var root = process.argv.slice(2)[1];
if (typeof coverage_file === 'undefined') {
    console.log("Missing code coverage input file");
	return;
} 
if (typeof root === 'undefined') {
    console.log("Missing project folder argument");
	return;
} 

self.createFiles(coverage_file, root)
