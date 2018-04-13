## Worker Exports


A simple interface to reach parts of your code running inside workers. Get/Set values of the exported Objects, or call your exported functions. 

>Warning :  Alpha version in development! Behaviour changes are expected in this Stage.

## Syntax 
The WorkerExports Constructor returns a Promise, wich is resolved once the Worker is loaded and ready.

> let myWorker = await new WorkerExports( URLpath [ ,onMessage ] );

- URLpath (string) : Absolute or Relative Path to the Worker Script
- onMessageHandler (function) : Function to handle the messages sent from the worker using postMessage

## Return
The Constructor returns, once the Promise is resolved, a Proxy to the Exports Object structure.  This Proxy behaves as an interface to your exports.


## Usage 

A minimal example, to interact with worker exports:
```javascript
// create worker-exports instance
workerExports = await new WorkerExports('worker.js');

// GETTER : get exports.myVar
console.log( await workerExports.myVar );

// SETTER : set exports.myVar value
// Note : Direct assignements are not allowed, setter function has to be used to change a value
await exports.setMyVar('newvalue');
console.log( await workerExports.myVar );

// APPLY : call exports.myFunction and get returned result
console.log( await workerExports.myFunction( 10, 2 ) );

// NESTED Objects
// get exported nested object value
console.log( await workerExports.myObject.myNumber );




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

// setter function
exports.setMyVar = function(v){ return exports.myVar = v };


## How it works 
The library creates two proxies, one in each side.

**In the worker side**, creates the Exports Object Proxy, wich allows the library to detect any change on the exports object structure done in the Worker side. Each time a structyural change is dettected, it notifies the main thread, updating the structure.

**In the main thread**, creates another Proxy, wich catches all requests (get/set/apply) to the Exports. Those requests are translated internaly into an async call to the Worker, based in Promises, wich resolve, once the response is received from the worker, returning the result of the requested action.
```

## Notes / Limitations:
- Because each request (getset/apply) needs to be messaged to the worker, and its result, messaged back, all interactions with the exports are **ASYNC**.

- **Worker-exports doesn't expose the real worker exported elements**, but a proxy interface to reach them. This limits the interactions to: GET SET (using setter functions) and APPLY (function call)

- Only those values wich can be handled by the browser **Structure Clone Algorithm** are candidates to be passed/retrieved through the requests.


> All primitive types	- However not symbols
> Boolean object	 
> String object	 
> Date	 
> RegExp	- The lastIndex field is not preserved.
> Blob	 
> File	 
> FileList	 
> ArrayBuffer	 
> ArrayBufferView	- This basically means all typed arrays like Int32Array etc.
> ImageData	 
> Array	 
> Object	This just includes plain objects (e.g. from object literals)
> Map	 
> Set	 

- Direct assignements are not allowed, because , there is no way to handle the async assugnement.A possible workarround using sharedArrayBuffer could be implemented, when sharedArrayBuffers are enabled again in the browsers.