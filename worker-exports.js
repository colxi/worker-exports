
const WorkerExports = (function(){
    'use strict';

    // private WORKER ID counter
    let __identifierCounter__ = 0;

    return function(filepath, messageHandler = function(){} , __DEBUG__ = false){
        // todo: check argumnts types
        //
        //

        // constructor must be calld using 'new'
        if( !(this instanceof WorkerExports) ) throw new Error('Calling WorkerExports constructor without new is forbidden');

        const debug = function(...args){
            if( __DEBUG__ ) return console.log(...args);
            else return false;
        };

        const isObject = function(o){
            //
            return Object.prototype.toString.call(o) === '[object Object]';
        };

        const isArray = function(o){
            //
            return Array.isArray(o);
        };

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

            // Generate abs url to worker if not absolute url provided
            let isAbsoluteURL = new RegExp('^(?:[a-z]+:)?//', 'i');
            if(!isAbsoluteURL.test(filepath)){
                filepath = location.href.replace(/[^/]*$/, '') + filepath;
            }

            // Convert the communication layer code, into a blob
            const blob = new Blob([ '(' + loader.toString() + ')("'+filepath+'",'+__DEBUG__+');']);
            // convert the blob into a URL Blob
            const blobURL = URL.createObjectURL( blob, {
                type: 'application/javascript; charset=utf-8'
            });
            // generate the worker!
            const workerReference = new Worker( blobURL );


            // -----------------------------------------------------------------
            // PROCESS SIGNAL (on message evenet handler)
            // -----------------------------------------------------------------
            // handle the recieved messages from worker, and proces the internal
            // ones, or redrect the custom messages to he provided handler
            const postMessage = function(msg){
                __UID__++;
                debug('>> ',__UID__, msg);
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

            function onMessage(m){
                const msg = m.data;
                // HANDLED signals
                if( isObject(msg) && msg.__worker_exports__){
                    console.info('<< #'+ msg.id, msg.type, msg.data);
                    //
                    if(msg.type === 'return') {
                        __RESOLVE__[msg.id]( msg.data );
                        delete __RESOLVE__[ msg.id ];
                    }
                    //
                    else if( msg.type === 'update' ){

                    }
                    //
                    else if(msg.type === 'ready'){
                        workerExports = msg.data;
                        return resolveConstructor( new Proxy( workerExports, new proxyHandler() ) );
                    }else alert('unknown message received')
                }else return messageHandler(m);
            }

            // Manage incoming messages
            workerReference.addEventListener('message', onMessage);


            // -----------------------------------------------------------------
            // PROXY HANDLER
            // -----------------------------------------------------------------
            // handle the accesses to the worker exports and perform the
            // appropiate requests to the worker
            const proxyHandler = function( namepath = [] ){

                const updateNamepath = function(objectName){
                    let newNamepath = namepath.slice();
                    newNamepath.push(objectName);
                    return newNamepath;
                };


                return {
                    apply: function(target, thisContext, args){
                        console.log(namepath, target.name,args)
                        return postMessage({
                            type: 'apply',
                            data : [ namepath, target.name , args]
                        });
                    },
                    set: function(target, name, value){
                        throw new Error('Setter is disallowed, because it cannot be performed with a handled async call. Please use a Setter function instead.')
                        /* Workarround : use sharedbuffer array, to detect when the promise has
                        been fullfilled, hodling the setter return in a loop
                        until it happens
                        postMessage({
                            type: 'set',
                            data : [ namepath , name ,value ]
                        });
                        console.warn('The set value request has been sended and will be performed asynchroniusly in the background. The changes will not be effective until the request response is received.')
                        return true;
                        */
                    },
                    get: function(target, name){
                        //debug('get', name, namepath)
                        if(name === 'then') return undefined;

                        // is a function...
                        if( !target.hasOwnProperty(name) ){
                            return undefined;
                        }else if( Reflect.get(target,name) === 'function' ){
                            let fn = function(){};
                            Object.defineProperty(fn, 'name', { value: name });
                            return new Proxy(  fn , proxyHandler(namepath) );
                        }
                        //
                        else if( isObject( Reflect.get(target,name) ) ){
                            return new Proxy( target[name], proxyHandler( updateNamepath(name) ) );
                        }else if( isArray( Reflect.get(target,name) ) ){
                            return new Proxy( target[name], proxyHandler( updateNamepath(name) ) );
                        }
                        //
                        else{
                            console.log('requesting value')
                            return postMessage({
                                type: 'get',
                                data : [ namepath , name ],
                            });
                        }


                        let item =  postMessage({
                            type: 'get',
                            data : [ updateNamepath(name) ],
                        });
                        if( item instanceof Object ){
                            debug('returnin...')
                            return new Proxy( target[name], proxyHandler( updateNamepath(name) ) );
                        }
                        debug('item', item)
                        return item;

                        workerExports = postMessage({ type: 'get-exports' });

                        // is a not defined...
                        if( typeof target[name] == 'undefined'){
                            return undefined;
                        }
                        // is a function...
                        else if( target[name] === 'function' ){
                            return new Proxy( function(){}, proxyHandler( updateNamepath(name) ) );
                        }
                        // is an object
                        else if( target[name] instanceof Object ){
                            return new Proxy( target[name], proxyHandler( updateNamepath(name) ) );
                        }
                        // is a value
                        else{
                            return postMessage({
                                type: 'get',
                                data : [ updateNamepath(name) ],
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
function loader( filepath ,  __DEBUG__ = false ){
    let currentAction = 'load';

    const debug = function(...args){
        if( __DEBUG__ ) return console.log( '[WORKER]' , ...args);
        else return false;
    };
    debug('worker:loading');

    const postMessage = function(o){
        let msg = {
            __worker_exports__ : true,
            id : o.id || 0,
            type: o.type || 'return',
            data : o.data
        };
        self.postMessage(msg);
        currentAction = 'idle';
    };

    const isObject = function(o){
        //
        return Object.prototype.toString.call(o) === '[object Object]';
    };

    const isArray = function(o){
        //
        return Array.isArray(o);
    };

    // function to generte the namepath
    const updateNamepath = function(namepath,objectName){
        let newNamepath = namepath.slice();
        newNamepath.push(objectName);
        return newNamepath;
    };

    function resolvePath(p){
        let element = self.exports;
        for( let i=0 ; i< p.length;i++ ){
            element = element[  p[i ] ];
        }
        return element;
    }

    function parseExports( o = self.exports ){
        let e =  Array.isArray(o) ? [] : {};
        for(let i in o){
            if( o.hasOwnProperty(i) ){
                let value;
                if( isObject(o[i]) ){
                    value = parseExports( o[i] );
                }else if( isArray(o[i]) ){
                    value = parseExports( o[i] );
                }else if( typeof o[i] === 'function' ){
                    value = 'function';
                }else value = undefined;
                e[i] = value;
            }
        }
        return e;
    }

    /* Handler for self.exports */
    const proxyHandler = function( namepath = [] ){
        return {
            set :function(target,name,value){
                //debug('set','exports.'+namepath.join('.')+'.'+name+'=', value);
                // if new value, or previous is an object or an array
                // notification update is required
                //
                // todo: check if is a function!
                //
                let updateRequired=false;
                if( currentAction !== 'load' ){
                    // property name does not exist in target, or if value is an
                    // object or an array, or previous values where objects or
                    // array, but new value isn't, require update exports object
                    if( !target.hasOwnProperty(name)  || isObject(value) || isArray(value) || isObject(target[name]) || isArray(target[name]) ){
                        debug('UPDATE! NEW/OLD OBJECT/ARRAY CHANGE','exports.'+namepath.join('.')+'.'+name);
                        updateRequired=true;
                    }
                }else debug('UPDATE ignored  (loading)');

                let result = Reflect.set( target, name, value );
                if(updateRequired)  postMessage({
                    type : 'update',
                    data : [ namepath, name, parseExports() ]
                });
                return result;
            },
            get: function(target, name){
                let item =  target[name] ;
                //debug('get','exports.'+namepath.join('.')+'.'+name+'=', item);
                if( isObject( item ) ){
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
            let result = await path[ msg.data[1] ];
            if( isObject(result) ) result = parseExports(result)
            postMessage({
                id : msg.id,
                data : result
            });
        }
        else if(msg.type === 'set'){
            let path = resolvePath(msg.data[0]);
            console.log('set', path)
            await ( path[ msg.data[1] ] = msg.data[2] );
            postMessage({
                id : msg.id,
                data : true
            });
        }
        else if(msg.type === 'apply'){
            // will not work due change in resolenamepath()
            let path = resolvePath(msg.data[0]);
            let args = isArray( msg.data[2] ) ? msg.data[2] : [];
            let result = await path[ msg.data[1] ]( ...args );
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
    debug('worker: user script loaded')
    setTimeout( function(){
        postMessage({
            type : 'ready',
            data : parseExports()
        });
    } , 100 );
    // done;

}
