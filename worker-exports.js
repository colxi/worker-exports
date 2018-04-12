
const WorkerExports = (function(){
    'use strict';

    // private ID counter
    let __identifierCounter__ = 0;

    return function(filepath, messageHandler = function(){} ){
        // todo: check argumnts types
        //
        //

        // constructor must be calld using 'new'
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
            // PROCESS SIGNAL (on message evenet handler)
            // -----------------------------------------------------------------
            // handle the recieved messages from worker, and proces the internal
            // ones, or redrect the custom messages to he provided handler
            workerReference.addEventListener('message',  function(m){
                console.log('main:msg received');
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
                    else if(msg.type === 'ready'){
                        workerExports = msg.data;
                        console.log(workerExports)
                        return resolveConstructor( new Proxy( workerExports, new proxyHandler() ) );
                    }
                }else return messageHandler(m);
            });


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
                            type: 'apply',
                            data : [namepath, args]
                        });
                    },
                    set: function(target, name, value){
                        return postMessage({
                            type: 'set',
                            data : [ setNamepath(name) , value ]
                        });
                    },
                    get: async function(target, name){
                        //console.log('get', name, namepath)
                        if(name==='then') return undefined;
                        let item = await postMessage({
                            type: 'get',
                            data : [ setNamepath(name) ],
                        });
                        if( item instanceof Object ){
                            console.log('returnin...')
                            return new Proxy( target[name], proxyHandler( setNamepath(name) ) );
                        }
                        console.log('item', item)
                        return item;

                        workerExports = postMessage({ type: 'get-exports' });

                        // is a not defined...
                        if( typeof target[name] == 'undefined'){
                            return undefined;
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
                                type: 'get',
                                data : [ setNamepath(name) ],
                            });
                        }
                    }
                };
            };



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
    console.log('worker:loading')
    let currentAction = 'load';

    function postMessage(o){
        let msg = {
            __worker_exports__ : true,
            id : o.id,
            type: o.type || 'proxy-call-result',
            data : o.data
        };
        console.log('worker: msg out', msg)
        self.postMessage(msg);
        currentAction = 'idle';
    }

    function isObject(o){
        //
        return (typeof o === 'object' && o instanceof Object) ? true : false;
    }
    function isArray(o){
        //
        return (o instanceof Array) ? true : false;
    }
    // function to generte the namepath
    const updateNamepath = function(namepath,objectName){
        let newNamepath = namepath.slice();
        newNamepath.push(objectName);
        return newNamepath;
    };

    function resolvePath(p){
        let target = p.pop();
        let element = self.exports;
        for( let i=0 ; i< p.length;i++ ){
            element = element[  p[i ] ];
        }
        return {context: element, target: target };
    }

    function parseExports( o = self.exports ){
        let e = {};
        for(let i in o){
            if( o.hasOwnProperty(i) ){
                let type;
                if( typeof o[i] === 'object' && o[i] instanceof Object){
                    type = parseExports( o[i] );
                }else if( typeof o[i] === 'function' && o[i] instanceof Function){
                    type = 'function';
                }else type = o[i];
                e[i] = type;
            }
        }
        return e;
    }

    /* Handler for self.exports */
    const proxyHandler = function( namepath = [] ){
        return {
            set :function(target,name,value){
                //console.log('set','exports.'+namepath.join('.')+'.'+name+'=', value);
                // if new value, or previous is an object or an array
                // notification update is required
                if( isObject(value) || isArray(value)  ||
                    isObject(target[name]) || isArray(target[name]) ){
                    if( currentAction !== 'load' ){
                        console.log('UPDATE! ','exports.'+namepath.join('.')+'.'+name);
                        postMessage({
                            type : 'update-exports',
                            data : [ namepath, name, parseExports() ]
                        });
                    }else console.log('UPDATE IGNORED  (loading)');
                }
                return Reflect.set( target, name, value );
            },
            get: function(target, name){
                let item =  target[name] ;
                //console.log('get','exports.'+namepath.join('.')+'.'+name+'=', item);
                if(typeof item === 'object' && item instanceof Object){
                    return new Proxy( item, proxyHandler( updateNamepath(namepath,name) ) );
                }else return item;
            }
        };
    };
    self.exports = new Proxy( {}, proxyHandler() );

    self.addEventListener ( 'message',  async function (e) {
        let msg = e.data;
        currentAction = msg.type;

        if( !msg.hasOwnProperty('__worker_exports__') ) return;

        // the message is an internal worker-exports message, prvent the message
        // to reach any user onmessage event listener, declared in he worker script
        e.stopImmediatePropagation();


        // parse-exports
        if(msg.type === 'get'){
            let path = resolvePath(msg.data[0]);
            let result = await path.context[path.target];
            if( typeof result === 'object' && result instanceof Object) result = parseExports(result)
            postMessage({
                id : msg.id,
                data : result
            });
        }
        else if(msg.type === 'set'){
            let path = resolvePath(msg.data[0]);
            await ( path.context[path.target] = msg.data[1] );
            postMessage({
                id : msg.id,
                data : true
            });
        }
        else if(msg.type === 'apply'){
            let path = resolvePath(msg.data[0]);
            let args =  (msg.data[1] instanceof Array) ? msg.data[1] : [];
            let result = await  path.context[path.target]( ...args );
            postMessage({
                id : msg.id,
                data : result
            });
        }
        else if(msg.type === 'get-exports'){
            postMessage({
                id : msg.id,
                data : parseExports()
            });

        }
    }, false );

    // DONE !
    // Worker ready. notify to main thread
    importScripts(filepath);
    console.log('worker: user script loaded')
    postMessage({
        type : 'ready',
        data : parseExports()
    });
    // done;

}
