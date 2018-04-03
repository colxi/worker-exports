
const WorkerExports = (function(){
    'use strict';

    // private ID counter
    let __identifierCounter__ = 0;

    return function(filepath, messageHandler = function(){} ){
        // todo: check argumnts types
        //
        //

        // constructor must be calld usk g 'new'
        if( !(this instanceof WorkerExports) ) throw new Error('Calling WorkerExports constructor without new is forbidden');

        // because the worker script is loaded in asynchonic, and all the
        // messages sended to him , before the load is completed, will be
        // dismissed, the best option is to return a Promise, to ensure, nobody
        // will use the worker until is totally operative.
        return new Promise( resolveConstructor =>{
            // internal counter, used to assign an ID to each message send to
            // the worker, to properly handle the responses
            let __UID__ = 0;
            // object containing all the RESOLVE references, required to
            // return the control after each worker call is completed.
            const __RESOLVE__ = [];
            // object to store the worker exports structure
            let workerExports = {};

            function postMessage(msg){
                __UID__++;
                console.log('>> ',__UID__, msg);
                return new Promise( ( resolve )=>{
                    __RESOLVE__[__UID__] = resolve;
                    workerReference.postMessage({
                        __worker_exports__ : true,
                        id:__UID__ ,
                        type: msg.type,
                        data : msg.data
                    });
                });
            }


            // -----------------------------------------------------------------
            // GENERATE THE WORKER
            // -----------------------------------------------------------------
            // The worker will require a minimal comunication layer code
            // to load the requested script andnroute andnhandle each request...
            //
            // Convert the communication layer code, into a blob
            const blob = new Blob([ '(' + loader.toString() + ')("'+filepath+'");']);
            // convert the blob into a URL Blob
            const blobURL = URL.createObjectURL( blob, {
                type: 'application/javascript; charset=utf-8'
            });
            // generate the worker!
            const workerReference = new Worker( blobURL );


            // -----------------------------------------------------------------
            // PROXY HANDLER
            // -----------------------------------------------------------------
            // handle the accesses to the worker exports and perform the
            // appropiate requests to the worker
            const proxyHandler = function( namepath = [] ){
                const setNamepath = function(objectName){
                    let newNamepath = namepath.slice();
                    newNamepath.push(objectName);
                    return newNamepath;
                };

                return {
                    apply: function(target, thisContext, args){
                        return postMessage({
                            type: 'proxy-apply',
                            data : [namepath, args]
                        });
                    },
                    set: function(target, name, value){
                        return postMessage({
                            type: 'proxy-set',
                            data : [ setNamepath(name) , value ]
                        });
                    },
                    get: function(target, name){
                        //console.log('get', name, namepath)
                        if(name==='then') return undefined;
                        // is a not defined...
                        if( typeof target[name] == 'undefined'){
                            return new Promise( ( resolve )=>{
                                __RESOLVE__[__UID__] = resolve;
                                workerReference.postMessage({
                                    __worker_exports__ : true,
                                    id:__UID__ ,
                                    type: 'get-exports'
                                });
                            });
                            console.log('updatd cache')
                        }
                        // is a function...
                        else if( target[name] === 'function' ){
                            return new Proxy( function(){}, proxyHandler( setNamepath(name) ) );
                        }
                        // is an object
                        else if( target[name] instanceof Object ){
                            return new Proxy( target[name], proxyHandler( setNamepath(name) ) );
                        }
                        // is a value
                        else{
                            return postMessage({
                                type: 'proxy-get',
                                data : [ setNamepath(name) ],
                            });
                        }
                    }
                };
            };


            // -----------------------------------------------------------------
            // PROCESS SIGNAL (on message evenet handler)
            // -----------------------------------------------------------------
            // handle the recieved messages from worker, and proces the internal
            // ones, or redrect the custom messages to he provided handler
            workerReference.addEventListener('message',  function(m){
                const msg = m.data;
                // HANDLED signals
                if(typeof msg === 'object' && msg.__worker_exports__){
                    //
                    if(msg.type === 'proxy-call-result') {
                        console.log('<<', msg.id, msg.data);
                        __RESOLVE__[msg.id]( msg.data );
                        delete __RESOLVE__[ msg.id ];
                    }
                    //
                    else if(msg.type === 'worker-ready'){
                        workerExports = msg.data;
                        console.log(workerExports)
                        return resolveConstructor( new Proxy( workerExports, new proxyHandler() ) );
                    }
                }else return messageHandler(m);
            });
        });
    };
})();



/*******************************************************************************
 *
 *
 * INJECTED WORKER EXPORTS HANDLER
 * -------------------------------
 *
 *
 ******************************************************************************/
function loader(filepath){
    self.exports = {};

    function parseExports( o = self.exports ){
        let e = {};
        for(let i in o){
            if( o.hasOwnProperty(i) ){
                let type;
                if( typeof o[i] === 'object' && o[i] instanceof Object){
                    type = parseExports( o[i] );
                }else type = typeof o[i];
                e[i] = type;
            }
        }
        return e;
    }

    function resolvePath(p){
        let target = p.pop();
        let element = self.exports;
        for( let i=0 ; i< p.length;i++ ){
            element = element[  p[i ] ];
        }
        return {context: element, target: target };
    }

    self.addEventListener ( 'message',  async function (e) {
        let msg = e.data;

        if( !msg.hasOwnProperty('__worker_exports__') ) return;

        // the message is an internal worker-exports message, prvent the message
        // to reach any user onmessage event listener, declared in he worker script
        e.stopImmediatePropagation();


        // parse-exports
        if(msg.type === 'proxy-get'){
            let path = resolvePath(msg.data[0]);
            let result = await path.context[path.target];
            self.postMessage({
                __worker_exports__ : true,
                id : msg.id,
                type:'proxy-call-result',
                data : result
            });
        }
        if(msg.type === 'proxy-set'){
            let path = resolvePath(msg.data[0]);
            await ( path.context[path.target] = msg.data[1] );
            self.postMessage({
                __worker_exports__ : true,
                id : msg.id,
                type:'proxy-call-result',
                data : true
            });
        }
        else if(msg.type === 'proxy-apply'){
            let path = resolvePath(msg.data[0]);
            let args =  (msg.data[1] instanceof Array) ? msg.data[1] : [];
            let result = await  path.context[path.target]( ...args );
            self.postMessage({
                __worker_exports__ : true,
                id : msg.id,
                type:'proxy-call-result',
                data : result
            });
        }
    }, false );

    // DONE !
    // Worker ready. notify to main thread
    importScripts(filepath);
    self.postMessage({
        __worker_exports__ : true,
        type : 'worker-ready',
        data : parseExports()
    });

}
