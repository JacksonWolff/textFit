/**
 * textFit v2.3.1
 * Previously known as jQuery.textFit
 * 11/2014 by STRML (strml.github.com)
 * MIT License
 *
 * To use: textFit(document.getElementById('target-div'), options);
 *
 * Will make the *text* content inside a container scale to fit the container
 * The container is required to have a set width and height
 * Uses binary search to fit text with minimal layout calls.
 * Version 2.0 does not use jQuery.
 */
/*global define:true, document:true, window:true, HTMLElement:true*/

(function(root, factory) {
  "use strict";

  // UMD shim
  if (typeof define === "function" && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof exports === "object") {
    // Node/CommonJS
    module.exports = factory();
  } else {
    // Browser
    root.textFit = factory();
  }

}(typeof global === "object" ? global : this, function () {
  "use strict";

  var defaultSettings = {
    alignVert: false, // if true, textFit will align vertically using css tables
    alignHoriz: false, // if true, textFit will set text-align: center
    multiLine: false, // if true, textFit will not set white-space: no-wrap
    stopOverflow: false, // if true, a error we be thrown if the content is overflowing
    maxLines: false, // if true, textFit will throw and error if the text is over the supplied number of lines
    detectMultiLine: true, // disable to turn off automatic multi-line sensing
    fontUnit: 'px', // what unit should the final font be. using rems or mm is sometimes useful
    fontChangeSize: 1, // how much should the font size by ajusted by each time. 0.1 and 0.01 is useful for when using a rem font unit
    minFontSize: 6, 
    maxFontSize: 80, 
    reProcess: true, // if true, textFit will re-process already-fit nodes. Set to 'false' for better performance
    widthOnly: false, // if true, textFit will fit text to element width, regardless of text height
    alignVertWithFlexbox: false, // if true, textFit will use flexbox for vertical alignment
  };

  return function textFit(els, options) {

    if (!options) options = {};

    // Extend options.
    var settings = {};
    for(var key in defaultSettings){
      if(options.hasOwnProperty(key)){
        settings[key] = options[key];
      } else {
        settings[key] = defaultSettings[key];
      }
    }

    // Convert jQuery objects into arrays
    if (typeof els.toArray === "function") {
      els = els.toArray();
    }

    // Support passing a single el
    var elType = Object.prototype.toString.call(els);
    if (elType !== '[object Array]' && elType !== '[object NodeList]' &&
            elType !== '[object HTMLCollection]'){
      els = [els];
    }

    // Process each el we've passed.
    for(var i = 0; i < els.length; i++){
      processItem(els[i], settings);
    }
  };

  /**
   * The meat. Given an el, make the text inside it fit its parent.
   * @param  {DOMElement} el       Child el.
   * @param  {Object} settings     Options for fit.
   */
  function processItem(el, settings){
    if (!isElement(el) || (!settings.reProcess && el.getAttribute('textFitted'))) {
      return false;
    }

    // Set textFitted attribute so we know this was processed.
    if(!settings.reProcess){
      el.setAttribute('textFitted', 1);
    }

    var innerSpan, originalHeight, originalHTML, originalWidth;
    var low, mid, high;

    // Get element data.
    originalHTML = el.innerHTML;
    originalWidth = innerWidth(el);
    originalHeight = innerHeight(el);

    // Don't process if we can't find box dimensions
    if (!originalWidth || (!settings.widthOnly && !originalHeight)) {
      if(!settings.widthOnly)
        throw new Error('Set a static height and width on the target element ' + el.outerHTML +
          ' before using textFit!');
      else
        throw new Error('Set a static width on the target element ' + el.outerHTML +
          ' before using textFit!');
    }

    // Add textFitted span inside this container.
    if (originalHTML.indexOf('textFitted') === -1) {
      innerSpan = document.createElement('span');
      innerSpan.className = 'textFitted';
      // Inline block ensure it takes on the size of its contents, even if they are enclosed
      // in other tags like <p>
      innerSpan.style['display'] = 'inline-block';
      innerSpan.innerHTML = originalHTML;
      el.innerHTML = '';
      el.appendChild(innerSpan);
    } else {
      // Reprocessing.
      innerSpan = el.querySelector('span.textFitted');
      // Remove vertical align if we're reprocessing.
      if (hasClass(innerSpan, 'textFitAlignVert')){
        innerSpan.className = innerSpan.className.replace('textFitAlignVert', '');
        innerSpan.style['height'] = '';
        el.className.replace('textFitAlignVertFlex', '');
      }
    }

    // Prepare & set alignment
    if (settings.alignHoriz) {
      el.style['text-align'] = 'center';
      innerSpan.style['text-align'] = 'center';
    }

    // Check if this string is multiple lines
    // Not guaranteed to always work if you use wonky line-heights
    var multiLine = settings.multiLine;
    if (settings.detectMultiLine && !multiLine &&
        innerSpan.scrollHeight >= parseInt(window.getComputedStyle(innerSpan)['font-size'], 10) * 2) {
      multiLine = true;
    }

    // If we're not treating this as a multiline string, don't let it wrap.
    if (!multiLine) {
      el.style['white-space'] = 'nowrap';
    }
    var startingSize = innerSpan.style.fontSize;

    low = settings.minFontSize;
    high = settings.maxFontSize;
    // Binary search for highest best fit
    var size = low;
    while (low <= high) {
      mid = parseFloat(((high + low) / 2).toFixed(2));
      // mid = (high + low) >> 1;
      // console.table('low: ' + low + ' mid: ', + mid +  ' high: ' + high);
      innerSpan.style.fontSize = mid + settings.fontUnit;
      if(innerSpan.scrollWidth <= originalWidth && (settings.widthOnly || innerSpan.scrollHeight <= originalHeight)) {
        size = mid;
        low = mid + settings.fontChangeSize;
      } else {
        high = mid - settings.fontChangeSize;
      }
      // await injection point
    }
    if (startingSize !== size) {
      //console.log('textFit font changed size: ', size + settings.fontUnit)
    }
    // found, updating font if differs:
    if( innerSpan.style.fontSize != size + settings.fontUnit ) innerSpan.style.fontSize = size + settings.fontUnit;

    // add the required CSS in order to stop overflows
    if (settings.maxLines || settings.stopOverflow) {
      if (!document.getElementById("overflowStyleSheet")) {
        var style = [
          ".overflow > span {",
            "overflow: hidden;",
          "}"].join("");
    
        var css = document.createElement("style");
        css.type = "text/css";
        css.id = "overflowStyleSheet";
        css.innerHTML = style;
        document.body.appendChild(css);
    }

    el.classList.remove('overflow');

    if (settings.maxLines) {
      if (Number.isInteger(settings.maxLines)) {
        const computedStyle = window.getComputedStyle(innerSpan);
        // Checking if line-height is not set and has a normal value set by default
        const isNormal = computedStyle.getPropertyValue('line-height') == 'normal';
        // Getting the font-size of an element that will help us calculate the line-height
        const fontSize = parseFloat(computedStyle.getPropertyValue('font-size'));
        // If line-height is normal, we multiply the element's font-size with 1.14
        if ( isNormal ) innerSpan.style.lineHeight = (fontSize * 1.14) + 'px';
        const lineHeight = parseFloat(computedStyle.getPropertyValue('line-height'));
        const blockHeight = innerSpan.scrollHeight;         
        
        // Setting the element's max-height 
        const limitHeight = (lineHeight * settings.maxLines);

        innerSpan.style.maxHeight = limitHeight + 'px';

        var overflow = blockHeight > limitHeight
        if (overflow) {
          el.classList.add('overflow')
        } 
      } else {
        console.error('TextFit maxLines needs to be given a number')
      }
    }

    if (settings.stopOverflow) {      
      var overflow = innerHeight(el) < innerSpan.scrollHeight;
      if (overflow) {
        el.classList.add('overflow');
      };
      }
    }

    // Our height is finalized. If we are aligning vertically, set that up.
    if (settings.alignVert) {
      addStyleSheet();
      var height = innerSpan.scrollHeight;
      if (window.getComputedStyle(el)['position'] === "static"){
        el.style['position'] = 'relative';
      }
      if (!hasClass(innerSpan, "textFitAlignVert")){
        innerSpan.className = innerSpan.className + " textFitAlignVert";
      }
      innerSpan.style['height'] = height + "px";
      if (settings.alignVertWithFlexbox && !hasClass(el, "textFitAlignVertFlex")) {
        el.className = el.className + " textFitAlignVertFlex";
      }
    }
  }

  // Calculate height without padding.
  function innerHeight(el){
    var style = window.getComputedStyle(el, null);
    return el.clientHeight -
      parseInt(style.getPropertyValue('padding-top'), 10) -
      parseInt(style.getPropertyValue('padding-bottom'), 10);
  }

  // Calculate width without padding. 
  function innerWidth(el){
    var style = window.getComputedStyle(el, null);
    return el.clientWidth -
      parseInt(style.getPropertyValue('padding-left'), 10) -
      parseInt(style.getPropertyValue('padding-right'), 10);
  }

  //Returns true if it is a DOM element
  function isElement(o){
    return (
      typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
      o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName==="string"
    );
  }

  function hasClass(element, cls) {
    return (' ' + element.className + ' ').indexOf(' ' + cls + ' ') > -1;
  }

  // Better than a stylesheet dependency
  function addStyleSheet() {
    if (document.getElementById("textFitStyleSheet")) return;
    var style = [
      ".textFitAlignVert{",
        "position: absolute;",
        "top: 0; right: 0; bottom: 0; left: 0;",
        "margin: auto;",
        "display: flex;",
        "justify-content: center;",
        "flex-direction: column;",
      "}",
      ".textFitAlignVertFlex{",
        "display: flex;",
      "}",
      ".textFitAlignVertFlex .textFitAlignVert{",
        "position: static;",
      "}",].join("");

    var css = document.createElement("style");
    css.type = "text/css";
    css.id = "textFitStyleSheet";
    css.innerHTML = style;
    document.body.appendChild(css);
  }

}));
