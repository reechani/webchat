/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

window.Janey = (function(window, document, undefined ) {
	var Janey = {};
	
	//	random function
	//		random between min and max
	Janey.random = function (min, max) {
		'use strict';
		var randNr = Math.floor((Math.random()*max)+min);
		return randNr;
	}
	// Expose public methods
	return Janey;
  
})(window, window.document);