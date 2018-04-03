## Worker Exports

Warning : In development! Alpha version.

A simple interface to reach parts of your code running inside workers. Get/Set values of the exported Objects, or call your exported functions. 

## Usage :

A simple example, to import and interact with worker exports:
```javascript
// create worker-exports instance
workerExports = await new WorkerExports('http://ABSOLUTE/PATH/TO/worker.js');

// get exports.myVar
console.log( await workerExports.myVar );
// call exports.myFunction
console.log( await workerExports.myFunction( 10, 2 ) );
// get exported nested object value
console.log( await workerExports.myObject.myNumber );
// set exports.myVar value
await ( workerExports.myVar = 'newvalue' );
console.log( await workerExports.myVar );



```

worker.js
```javascript
exports.myVar = 'this is my var';

exports.myFunction= function a(b,c){ return b*c };

exports.myObject = {
	myFunction : function(a,b){ return a+b},
	myStrimg : 'test',
	myDate : new Date(),
	myNumber :  234,
	myNested :  {}
};

myPrivateVar = "i'm private";

myPrivateFunction(){/* i'm private too */}
```

## Notes / Limitations:
Because each request (getset/apply) needs to be messaged to the worker, and its result, messaged back, all interactions with the exports are **ASYNC**.

**Worker-exports doesn't expose the real worker exported elements**, but a proxy interface to reach them. This limits the interactions to: GET SET and APPLY (function call)

Only those values wich can be handled by the browser **Structure Clone Algorithm** are candidates to be passed/retrieved through the requests.


- All primitive types	- However not symbols
- Boolean object	 
- String object	 
- Date	 
- RegExp	- The lastIndex field is not preserved.
- Blob	 
- File	 
- FileList	 
- ArrayBuffer	 
- ArrayBufferView	- This basically means all typed arrays like Int32Array etc.
- ImageData	 
- Array	 
- Object	This just includes plain objects (e.g. from object literals)
- Map	 
- Set	 
