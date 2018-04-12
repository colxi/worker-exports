/*
* @Author: colxi
* @Date:   2018-03-31 18:20:40
* @Last Modified by:   colxi
* @Last Modified time: 2018-04-06 04:11:25
*/

exports.myVar = 'this is my var';

exports.myFunction= function a(b,c){ return b*c };

exports.myObject = {
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

