/*
* @Author: colxi
* @Date:   2018-03-31 18:20:40
* @Last Modified by:   colxi
* @Last Modified time: 2018-04-13 14:42:21
*/



exports.myArray = [1,2,3, { myObject : { myValue : 444 } } ];

exports.myVar = 'this is my var';

exports.myFunction= function a(b,c){ return b*c };

exports.setval = function(v){
    console.log('setval executed')
    exports.val = v
    console.log('setval done', exports)
    return v;
};


exports.myObject = {
    setval : function(v){ exports.val=v },
    myFunction : function(a,b){ return a+b},
    myStrimg : 'test',
    myDate : new Date(),
    myNumber :  234,
    myNested :  {
        a: 1,
        b: 2,
        c : function(){ return 'abc'}
    }
};
