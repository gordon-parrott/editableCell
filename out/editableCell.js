!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.editableCell=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],3:[function(require,module,exports){
var koBindingHandlers = require('./ko'),
    events = require('./events');

exports.selectCell = function (cell) {
    var table = cell.parentNode.parentNode.parentNode,
        selection = table._cellSelection;

    selection.setRange(cell, cell);
};

exports.getTableSelection = function (table) {
    var selection = table._cellSelection;

    return selection;
};

exports.setCellValue = function (cell, value) {
    var table = cell.parentNode.parentNode.parentNode,
        selection = table._cellSelection;

    selection.updateCellValue(cell, value);
};

// --------
// Eventing
// --------

exports.on = function (event, listener) {
    events.public.on(event, listener);
};

exports.removeListener = function () {
    events.public.removeListener.apply(events.public, arguments);
};

exports.removeAllListeners = function () {
    events.public.removeAllListeners.apply(events.public, arguments);
};

// Proxy internal events

var proxyEvents = ['cellValueChanged', 'beforeCopy'],
    eventName,
    i;

for (i = 0; i < proxyEvents.length; ++i) {
    eventName = proxyEvents[i];

    events.private.on(eventName, createProxy(eventName));    
}

function createProxy (eventName) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(eventName);
        events.public.emit.apply(events.public, args);
    };
}
},{"./events":4,"./ko":8}],4:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter,
	publicEvents = new EventEmitter(),
	privateEvents = new EventEmitter();

module.exports.public = publicEvents;
module.exports.private = privateEvents;
},{"events":1}],5:[function(require,module,exports){
var utils = require('./utils'),
    events = require('../events'),
    ko = require('./wrapper');

var editableCell = {
    init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        var table = $(element).parents('table')[0],
            selection = utils.initializeSelection(table),
            valueBindingName = 'editableCell';

        selection.registerCell(element);

        if (allBindings.has('cellValue')) {
            valueBindingName = 'cellValue';
            valueAccessor = function () { return allBindings.get('cellValue'); };
        }

        element._cellTemplated = element.innerHTML.trim() !== '';
        element._cellValue = valueAccessor;
        element._cellContent = function () { return allBindings.get('cellHTML') || allBindings.get('cellText') || this._cellValue(); };
        element._cellText = function () { return allBindings.get('cellText'); };
        element._cellHTML = function () { return allBindings.get('cellHTML'); };
        element._cellReadOnly = function () { return ko.utils.unwrapObservable(allBindings.get('cellReadOnly')); };
        element._cellValueUpdater = function (newValue) {
            utils.updateBindingValue(element, valueBindingName, this._cellValue, allBindings, newValue);

            if (!ko.isObservable(this._cellValue())) {
                ko.bindingHandlers.editableCell.update(element, valueAccessor, allBindings, viewModel, bindingContext);
            }
        };

        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            selection.unregisterCell(element);

            element._cellValue = null;
            element._cellContent = null;
            element._cellText = null;
            element._cellHTML = null;
            element._cellReadOnly = null;
            element._cellValueUpdater = null;
        });

        if (element._cellTemplated) {
            ko.utils.domData.set(element, 'editableCellTemplate', {});
            return { 'controlsDescendantBindings': true };
        }

        element.initialBind = true;
    },
    update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        var value = ko.utils.unwrapObservable(valueAccessor());

        if (element._cellTemplated) {
            var template = ko.utils.domData.get(element, 'editableCellTemplate');

            if (!template.savedNodes) {
                template.savedNodes = utils.cloneNodes(ko.virtualElements.childNodes(element), true /* shouldCleanNodes */);
            }
            else {
                ko.virtualElements.setDomNodeChildren(element, utils.cloneNodes(template.savedNodes));
            }

            ko.applyBindingsToDescendants(bindingContext.createChildContext(value), element);
        }
        else {
            if (element._cellHTML()) {
                element.innerHTML = ko.utils.unwrapObservable(element._cellHTML());
            }
            else {
                element.textContent = ko.utils.unwrapObservable(element._cellText() || element._cellValue());
            }
        }

        if (!element.initialBind) {
            events.private.emit('cellValueChanged', element);
        }

        if (element.initialBind) {
            element.initialBind = undefined;
        }
    }
};

module.exports = editableCell;

},{"../events":4,"./utils":9,"./wrapper":10}],6:[function(require,module,exports){
var utils = require('./utils'),
    ko = require('./wrapper');

var editableCellScrollHost = {
    init: function (element) {
        if (element.tagName !== 'TABLE') {
            throw new Error('editableCellScrollHost binding can only be applied to tables');
        }

        utils.initializeSelection(element);
    },
    update: function (element, valueAccessor) {
        var table = element,
            selection = table._cellSelection,
            scrollHost = ko.utils.unwrapObservable(valueAccessor());

        selection.setScrollHost(scrollHost);
    }
};

module.exports = editableCellScrollHost;

},{"./utils":9,"./wrapper":10}],7:[function(require,module,exports){
var utils = require('./utils'),
    ko = require('./wrapper');

var editableCellSelection = {
    _selectionMappings: [],

    init: function (element, valueAccessor, allBindingsAccessor) {
        if (element.tagName !== 'TABLE') {
            throw new Error('editableCellSelection binding can only be applied to tables');
        }

        var table = element,
            selection = utils.initializeSelection(table);

        // Update supplied observable array when selection range changes
        selection.on('change', rangeChanged);

        function rangeChanged (newSelection) {
            newSelection = ko.utils.arrayMap(newSelection, function (cell) {
                return {
                    cell: cell,
                    value: cell._cellValue(),
                    content: cell._cellContent()
                };
            });

            utils.updateBindingValue(element, 'editableCellSelection', valueAccessor, allBindingsAccessor, newSelection);
        }

        // Keep track of selections
        ko.bindingHandlers.editableCellSelection._selectionMappings.push([valueAccessor, table]);

        // Perform clean-up when table is removed from DOM
        ko.utils.domNodeDisposal.addDisposeCallback(table, function () {
            // Remove selection from list
            var selectionIndex = ko.utils.arrayFirst(ko.bindingHandlers.editableCellSelection._selectionMappings, function (tuple) {
                return tuple[0] === valueAccessor;
            });
            ko.bindingHandlers.editableCellSelection._selectionMappings.splice(selectionIndex, 1);

            // Remove event listener
            selection.removeListener('change', rangeChanged);
        });
    },
    update: function (element, valueAccessor, allBindingsAccessor) {
        var table = element,
            selection = table._cellSelection,
            newSelection = ko.utils.unwrapObservable(valueAccessor()) || [];

        // Empty selection, so simply clear it out
        if (newSelection.length === 0) {
            selection.clear();
            return;
        }

        var start = newSelection[0],
            end = newSelection[newSelection.length - 1];

        var isDirectUpdate = start.tagName === 'TD' || start.tagName === 'TH';

        // Notification of changed selection, either after programmatic
        // update or after changing current selection in user interface
        if (!isDirectUpdate) {
            start = start.cell;
            end = end.cell;
        }

        // Make sure selected cells belongs to current table, or else hide selection
        var parentRowHidden = !start.parentNode;
        var belongingToOtherTable = start.parentNode && start.parentNode.parentNode && start.parentNode.parentNode.parentNode !== table;

        if (parentRowHidden || belongingToOtherTable) {
            // Selection cannot be cleared, since that will affect selection in other table
            selection.view.hide();
            return;
        }

        // Programmatic update of selection, i.e. selection([startCell, endCell]);
        if (isDirectUpdate) {
            selection.setRange(start, end);
        }
    }
};

module.exports = editableCellSelection;

},{"./utils":9,"./wrapper":10}],8:[function(require,module,exports){
var polyfill = require('../polyfill');
var ko = require('./wrapper');

// Knockout binding handlers
var bindingHandlers = {
    editableCell: require('./editableCellBinding'),
    editableCellSelection: require('./editableCellSelectionBinding'),
    editableCellScrollHost: require('./editableCellScrollHostBinding')
};

// Register Knockout binding handlers if Knockout is loaded
if (typeof ko !== 'undefined') {
    for (var bindingHandler in bindingHandlers) {
        ko.bindingHandlers[bindingHandler] = bindingHandlers[bindingHandler];
    }
}

},{"../polyfill":11,"./editableCellBinding":5,"./editableCellScrollHostBinding":6,"./editableCellSelectionBinding":7,"./wrapper":10}],9:[function(require,module,exports){
var Selection = require('../selection'),
    ko = require('./wrapper');

module.exports = {
    initializeSelection: initializeSelection,
    updateBindingValue: updateBindingValue,
    cloneNodes: cloneNodes
};

function initializeSelection (table) {
    var selection = table._cellSelection;

    if (selection === undefined) {
        table._cellSelection = selection = new Selection(table, ko.bindingHandlers.editableCellSelection._selectionMappings);

        ko.utils.domNodeDisposal.addDisposeCallback(table, function () {
            table._cellSelection.destroy();
        });
    }

    return selection;
}

// `updateBindingValue` is a helper function borrowing private binding update functionality
// from Knockout.js for supporting updating of both observables and non-observables.
function updateBindingValue (element, bindingName, valueAccessor, allBindingsAccessor, newValue) {
    var options = {
        cell: element
    };

    if (ko.isWriteableObservable(valueAccessor())) {
        valueAccessor()(newValue, options);
        return;
    }

    var propertyWriters = allBindingsAccessor()._ko_property_writers;
    if (propertyWriters && propertyWriters[bindingName]) {
        propertyWriters[bindingName](newValue, options);
    }

    if (!ko.isObservable(valueAccessor())) {
        allBindingsAccessor()[bindingName] = newValue;
    }
}

// Borrowed from Knockout.js
function cloneNodes (nodesArray, shouldCleanNodes) {
    for (var i = 0, j = nodesArray.length, newNodesArray = []; i < j; i++) {
        var clonedNode = nodesArray[i].cloneNode(true);
        newNodesArray.push(shouldCleanNodes ? ko.cleanNode(clonedNode) : clonedNode);
    }
    return newNodesArray;
}

},{"../selection":12,"./wrapper":10}],10:[function(require,module,exports){
if (typeof ko !== 'undefined') {
  module.exports = ko;
}
else {
  module.exports = window.require('knockout');
}

},{}],11:[function(require,module,exports){
function forEach (list, f) {
  var i;

  for (i = 0; i < list.length; ++i) {
    f(list[i], i);
  }
}

forEach([Array, window.NodeList, window.HTMLCollection], extend);

function extend (object) {
  var prototype = object && object.prototype;

  if (!prototype) {
    return;
  }

  prototype.forEach = prototype.forEach || function (f) {
    forEach(this, f);
  };

  prototype.filter = prototype.filter || function (f) {
    var result = [];

    this.forEach(function (element) {
      if (f(element, result.length)) {
        result.push(element);
      }
    });

    return result;
  };

  prototype.map = prototype.map || function (f) {
    var result = [];

    this.forEach(function (element) {
      result.push(f(element, result.length));
    });

    return result;
  };
}
},{}],12:[function(require,module,exports){
var SelectionView = require('./selectionView'),
    SelectionRange = require('./selectionRange'),
    EventEmitter = require('events').EventEmitter,
    polyfill = require('./polyfill'),
    events = require('./events'),
    ko = require('./ko/wrapper'),
    inherits = require('inherits');

module.exports = Selection;

function Selection(table, selectionMappings) {
    this.table = table;
    this.selectionMappings = selectionMappings;

    this.range = new SelectionRange(this.getRowByIndex.bind(this), this.getCellByIndex.bind(this), this.cellIsSelectable.bind(this), this.cellIsVisible.bind(this));
    this.view = new SelectionView(this.table, this);

    this.range.on('change', this.onSelectionChange.bind(this));
}

inherits(Selection, EventEmitter);

Selection.prototype.onSelectionChange = function(newSelection) {
    this.emit('change', newSelection);
    if (newSelection.length === 0) {
        this.view.hide();
        return;
    }
    this.view.update(newSelection[0], newSelection[newSelection.length - 1]);
};

Selection.prototype.setRange = function(start, end) {
    this.range.setStart(start);
    this.range.setEnd(end);
};

Selection.prototype.getRange = function() {
    return {
        start: this.range.start,
        end: this.range.end
    };
};

Selection.prototype.clear = function() {
    this.range.clear();
};

Selection.prototype.getCells = function() {
    return this.range.selection;
};

Selection.prototype.destroy = function() {
    this.view.destroy();
    this.view = null;

    this.range.destroy();
    this.range = null;

    this.removeAllListeners();

    this.table._cellSelection = null;
    this.table = null;
};

Selection.prototype.focus = function() {
    this.view.focus();
};

Selection.prototype.setScrollHost = function(scrollHost) {
    this.view.scrollHost = scrollHost;
};

Selection.prototype.registerCell = function(cell) {
    cell.addEventListener("mousedown", this.onMouseDown.bind(this));
    cell.addEventListener("mouseover", this.onMouseOver.bind(this));
    cell.addEventListener("focus", this.onCellFocus.bind(this));
};

Selection.prototype.unregisterCell = function(cell) {
    cell.removeEventListener('mousedown', this.onMouseDown.bind(this));
    cell.removeEventListener('mouseover', this.onMouseOver.bind(this));
    cell.removeEventListener('focus', this.onCellFocus.bind(this));
};

Selection.prototype.onMouseDown = function(event) {
    var cell = event.target;
    if (this.isEditingCell(cell)) {
        return;
    }

    this.onCellMouseDown(cell, event.shiftKey);
    event.preventDefault();
};

Selection.prototype.updateCellValue = function(cell, newValue) {
    var value;

    if (!this.cellIsEditable(cell)) {
        return undefined;
    }

    if (newValue === undefined) {
        value = this.view.inputElement.value;
    } else {
        value = newValue;
    }

    cell._cellValueUpdater(value);

    return value;
};

Selection.prototype.startEditing = function() {
    this.startEditingCell(this.range.start);
};

Selection.prototype.startLockedEditing = function() {
    this.startEditingCell(this.range.start, true);
};

Selection.prototype.startEditingCell = function(cell, isLockedToCell) {
    if (!this.cellIsEditable(cell)) {
        return;
    }

    if (this.range.start !== cell) {
        this.range.setStart(cell);
    }

    this.view.inputElement.style.top = this.table.offsetTop + cell.offsetTop + 'px';
    this.view.inputElement.style.left = this.table.offsetLeft + cell.offsetLeft + 'px';
    this.view.inputElement.style.width = cell.offsetWidth + 'px';
    this.view.inputElement.style.height = cell.offsetHeight + 'px';
    this.view.inputElement.value = ko.utils.unwrapObservable(cell._cellValue());
    this.view.inputElement.style.display = 'block';
    this.view.inputElement.focus();
    this.view.isLockedToCell = isLockedToCell;

    document.execCommand('selectAll', false, null);
    this.view.element.style.pointerEvents = 'none';
};

Selection.prototype.isEditingCell = function(cell) {
    return this.view.inputElement.style.display === 'block';
};

Selection.prototype.cancelEditingCell = function(cell) {
    this.view.inputElement.style.display = 'none';
    this.view.element.style.pointerEvents = 'inherit';
};

Selection.prototype.endEditingCell = function(cell) {
    this.view.inputElement.style.display = 'none';
    this.view.element.style.pointerEvents = 'inherit';
    return this.updateCellValue(cell);
};

Selection.prototype.cellIsSelectable = function(cell) {
    return cell._cellValue !== undefined;
};

Selection.prototype.cellIsEditable = function(cell) {
    return cell._cellReadOnly() !== true;
};

Selection.prototype.cellIsVisible = function(cell) {
    return cell && cell.offsetHeight !== 0;
};

Selection.prototype.getRowByIndex = function(index, originTable) {
    var targetTable = originTable || this.table;

    // Check if we're moving out of table
    if (index === -1 || index === targetTable.rows.length) {
        // Find selection mapping for table
        var selectionMapping = this.getSelectionMappingForTable(targetTable);

        // We can only proceed check if mapping exists, i.e. that editableCellSelection binding is used
        if (selectionMapping) {
            // Find all selection mappings for selection, excluding the one for the current table
            var tableMappings = this.selectionMappings.filter(function(tuple) {
                return tuple[0]() === selectionMapping[0]() && tuple[1] !== targetTable;
            });

            var tables = tableMappings.map(function(tuple) {
                return tuple[1];
            });

            var beforeTables = tables.filter(function(t) {
                return t.getBoundingClientRect().bottom <= table.getBoundingClientRect().top;
            });

            var afterTables = tables.filter(function(t) {
                return t.getBoundingClientRect().top >= table.getBoundingClientRect().bottom;
            });

            // Moving upwards
            if (index === -1 && beforeTables.length) {
                targetTable = beforeTables[beforeTables.length - 1];
                index = targetTable.rows.length - 1;
            }
            // Moving downwards
            else if (index === targetTable.rows.length && afterTables.length) {
                targetTable = afterTables[0];
                index = 0;
            }
        }
    }

    return targetTable.rows[index];
};

Selection.prototype.getCellByIndex = function(row, index) {
    var i, colSpanSum = 0;

    for (i = 0; i < row.children.length; i++) {
        if (index < colSpanSum) {
            return row.children[i - 1];
        }
        if (index === colSpanSum) {
            return row.children[i];
        }

        colSpanSum += row.children[i].colSpan;
    }
};

Selection.prototype.getSelectionMappingForTable = function(table) {
    return this.selectionMappings.filter(function(tuple) {
        return tuple[1] === table;
    })[0];
};

Selection.prototype.updateSelectionMapping = function(newStartOrEnd) {
    var newTable = newStartOrEnd &&
                   newStartOrEnd.parentNode &&
                   newStartOrEnd.parentNode.parentNode &&
                   newStartOrEnd.parentNode.parentNode.parentNode;

    if (newTable !== this.table) {
        var mapping = this.getSelectionMappingForTable(newTable);
        if (mapping) {
            var selection = mapping[0]();
            selection([newStartOrEnd]);
        }
    }
};

Selection.prototype.onCellMouseDown = function(cell, shiftKey) {
    if (shiftKey) {
        this.range.setEnd(cell);
    } else {
        this.range.setStart(cell);
    }

    this.view.beginDrag();
    event.preventDefault();
};

Selection.prototype.onMouseOver = function(event) {
    var cell = event.target;

    if (!this.view.isDragging) {
        return;
    }

    while (cell && !(cell.tagName === 'TD' || cell.tagName === 'TH')) {
        cell = cell.parentNode;
    }

    if (cell && cell !== range.end) {
        this.range.setEnd(cell);
    }
};

Selection.prototype.onCellFocus = function(event) {
    var cell = event.target;

    if (cell === this.range.start) {
        return;
    }

    setTimeout(function() {
        this.range.setStart(cell);
    }, 0);
};

Selection.prototype.onReturn = function(event, preventMove) {
    if (preventMove !== true) {
        this.range.moveInDirection('Down');
    }
    event.preventDefault();
};

Selection.prototype.onArrows = function(event) {
    var newStartOrEnd, newTable;

    if (event.shiftKey && !event.ctrlKey) {
        newStartOrEnd = this.range.extendInDirection(this.keyCodeIdentifier[event.keyCode]);
    } else if (!event.ctrlKey) {
        newStartOrEnd = this.range.moveInDirection(this.keyCodeIdentifier[event.keyCode]);
        newTable = newStartOrEnd && newStartOrEnd.parentNode && newStartOrEnd.parentNode.parentNode.parentNode;

        this.updateSelectionMapping(newStartOrEnd);
    } else if (event.ctrlKey) {
        if (event.shiftKey) {
            // Extend selection all the way to the end.
            newStartOrEnd = this.range.extendInDirection(this.keyCodeIdentifier[event.keyCode], true);
        } else {
            // Move selection all the way to the end.
            newStartOrEnd = this.range.moveInDirection(this.keyCodeIdentifier[event.keyCode], true);
            this.updateSelectionMapping(newStartOrEnd);
        }
    }

    if (newStartOrEnd) {
        event.preventDefault();
    }
};

Selection.prototype.onCopy = function() {
    var cells = this.range.getCells(),
        cols = cells[cells.length - 1].cellIndex - cells[0].cellIndex + 1,
        rows = cells.length / cols,
        lines = [],
        i = 0,
        copyEventData = {
            text: ''
        };

    cells.forEach(function(cell) {
        var lineIndex = i % rows,
            rowIndex = Math.floor(i / rows);

        lines[lineIndex] = lines[lineIndex] || [];
        lines[lineIndex][rowIndex] = ko.utils.unwrapObservable(cell._cellValue());

        i++;
    });

    copyEventData.text = lines.map(function(line) {
        return line.join('\t');
    }).join('\r\n');


    events.private.emit('beforeCopy', copyEventData);

    return copyEventData.text;
};

Selection.prototype.onPaste = function(text) {
    var selStart = this.range.getCells()[0],
        cells,
        values = text.trim().split(/\r?\n/).map(function(line) {
            return line.split('\t');
        }),
        row = values.length,
        col = values[0].length,
        rows = 1,
        cols = 1,
        i = 0;

    this.range.setStart(selStart);

    while (row-- > 1 && this.range.extendInDirection('Down')) {
        rows++;
    }
    while (col-- > 1 && this.range.extendInDirection('Right')) {
        cols++;
    }

    cells = this.range.getCells();

    for (col = 0; col < cols; col++) {
        for (row = 0; row < rows; row++) {
            this.updateCellValue(cells[i], values[row][col]);
            i++;
        }
    }
};

Selection.prototype.onTab = function(event) {
    range.start.focus();
};

Selection.prototype.keyCodeIdentifier = {
    37: 'Left',
    38: 'Up',
    39: 'Right',
    40: 'Down'
};

},{"./events":4,"./ko/wrapper":10,"./polyfill":11,"./selectionRange":13,"./selectionView":14,"events":1,"inherits":2}],13:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter,
    polyfill = require('./polyfill');

module.exports = SelectionRange;

SelectionRange.prototype = EventEmitter.prototype;

function SelectionRange (getRowByIndex, getCellByIndex, cellIsSelectable, cellIsVisible) {
    var self = this;

    self.start = undefined;
    self.end = undefined;
    self.selection = [];

    function setSelection (cells) {
        self.selection = cells;
        self.emit('change', cells);
    }

    self.moveInDirection = function (direction, toEnd) {
        var newStart = toEnd ? self.getLastSelectableCellInDirection(self.start, direction) : self.getSelectableCellInDirection(self.start, direction),
            startChanged = newStart !== self.start,
            belongingToOtherTable = newStart.parentNode.parentNode.parentNode !== self.start.parentNode.parentNode.parentNode;

        if (!belongingToOtherTable && (startChanged || self.start !== self.end)) {
            self.setStart(newStart);
        }

        if (startChanged) {
            return newStart;
        }
    };

    self.extendInDirection = function (direction, toEnd) {
        var newEnd = toEnd ? self.getLastSelectableCellInDirection(self.end, direction) : self.getCellInDirection(self.end, direction),
            endChanged = newEnd && newEnd !== self.end;

        if (newEnd) {
            self.setEnd(newEnd);
        }

        if (endChanged) {
            return newEnd;
        }
    };

    self.getCells = function () {
        return self.getCellsInArea(self.start, self.end);
    };

    self.clear = function () {
        self.start = undefined;
        self.end = undefined;
        setSelection([]);
    };

    self.destroy = function () {
        self.removeAllListeners('change');
        self.start = undefined;
        self.end = undefined;
        self.selection = null;
        self = null;
    };

    self.setStart = function (element) {
        self.start = element;
        self.end = element;
        setSelection(self.getCells());
    };
    self.setEnd = function (element) {
        if (element === self.end) {
            return;
        }
        self.start = self.start || element;

        var cellsInArea = self.getCellsInArea(self.start, element),
            allEditable = true;

        cellsInArea.forEach(function (cell) {
            allEditable = allEditable && cellIsSelectable(cell);
        });

        if (!allEditable) {
            return;
        }

        self.end = element;
        setSelection(self.getCells());
    };
    self.getCellInDirection = function (originCell, direction) {

        var rowIndex = originCell.parentNode.rowIndex;
        var cellIndex = getCellIndex(originCell);

        var table = originCell.parentNode.parentNode.parentNode,
            row = getRowByIndex(rowIndex + getDirectionYDelta(direction), table),
            cell = row && getCellByIndex(row, cellIndex + getDirectionXDelta(direction, originCell));

        if (direction === 'Left' && cell) {
            return cellIsVisible(cell) && cell || self.getCellInDirection(cell, direction);
        }
        if (direction === 'Up' && row && cell) {
            return cellIsVisible(cell) && cell || self.getCellInDirection(cell, direction);
        }
        if (direction === 'Right' && cell) {
            return cellIsVisible(cell) && cell || self.getCellInDirection(cell, direction);
        }
        if (direction === 'Down' && row && cell) {
            return cellIsVisible(cell) && cell || self.getCellInDirection(cell, direction);
        }

        return undefined;
    };
    self.getSelectableCellInDirection = function (originCell, direction) {
        var lastCell,
            cell = originCell;

        while (cell) {
            cell = self.getCellInDirection(cell, direction);

            if (cell && cellIsSelectable(cell)) {
                return cell;
            }
        }

        return originCell;
    };
    self.getLastSelectableCellInDirection = function (originCell, direction) {
        var nextCell = originCell;
        do {
            cell = nextCell;
            nextCell = self.getSelectableCellInDirection(cell, direction);
        } while(nextCell !== cell);

        return cell;
    };
    self.getCellsInArea = function (startCell, endCell) {
        var startX = Math.min(getCellIndex(startCell), getCellIndex(endCell)),
            startY = Math.min(startCell.parentNode.rowIndex, endCell.parentNode.rowIndex),
            endX = Math.max(getCellIndex(startCell), getCellIndex(endCell)),
            endY = Math.max(startCell.parentNode.rowIndex, endCell.parentNode.rowIndex),
            x, y,
            cell,
            cells = [];

        for (x = startX; x <= endX; ++x) {
            for (y = startY; y <= endY; ++y) {
                cell = getCellByIndex(getRowByIndex(y), x);
                if(cellIsVisible(cell)) {
                    cells.push(cell || {});
                }
            }
        }

        return cells;
    };

    function getDirectionXDelta (direction, cell) {
        if (direction === 'Left') {
            return -1;
        }

        if (direction === 'Right') {
            return cell.colSpan;
        }

        return 0;
    }

    function getDirectionYDelta (direction) {
        if (direction === 'Up') {
            return -1;
        }

        if (direction === 'Down') {
            return 1;
        }

        return 0;
    }

    function getCellIndex (cell) {
        var row = cell.parentNode,
            colSpanSum = 0,
            i;

        for (i = 0; i < row.children.length; i++) {
            if (row.children[i] === cell) {
                break;
            }

            colSpanSum += row.children[i].colSpan;
        }

        return colSpanSum;
    }
}

},{"./polyfill":11,"events":1}],14:[function(require,module,exports){
var polyfill = require('./polyfill');

module.exports = SelectionView;

SelectionView.prototype = {};

function SelectionView (table, selection) {
    var self = this,
        html = document.getElementsByTagName('html')[0];

    self.element = document.createElement('div');
    self.element.className = 'editable-cell-selection';
    self.element.style.position = 'absolute';
    self.element.style.display = 'none';
    self.element.tabIndex = -1;

    self.inputElement = document.createElement('input');
    self.inputElement.className = 'editable-cell-input';
    self.inputElement.style.position = 'absolute';
    self.inputElement.style.display = 'none';

    self.copyPasteElement = document.createElement('textarea');
    self.copyPasteElement.style.position = 'absolute';
    self.copyPasteElement.style.opacity = '0.0';
    self.copyPasteElement.style.display = 'none';

    table.parentNode.insertBefore(self.element, table.nextSibling);
    table.parentNode.insertBefore(self.inputElement, table.nextSibling);
    table.appendChild(self.copyPasteElement);

    self.destroy = function () {
        self.element.removeEventListener('mousedown', self.onMouseDown);
        self.element.removeEventListener('dblclick', self.onDblClick);
        self.element.removeEventListener('keypress', self.onKeyPress);
        self.element.removeEventListener('keydown', self.onKeyDown);

        self.inputElement.removeEventListener('keydown', self.onInputKeydown);
        self.inputElement.removeEventListener('blur', onInputBlur);

        html.removeEventListener('mouseup', self.onMouseUp);

        table.parentNode.removeChild(self.element);
        table.parentNode.removeChild(self.inputElement);
        table.removeChild(self.copyPasteElement);
        
        selection = null;
        self = null;
    };
    self.show = function () {
        self.element.style.display = 'block';
        self.element.focus();

        var rect = selection.getRange().end.getBoundingClientRect(),
            horizontalMargin = rect.width,
            verticalMargin = rect.height,
            scrollHost = self.scrollHost || document.body,
            viewport = scrollHost.getBoundingClientRect(),
            viewportTop = Math.max(viewport.top, 0),
            viewportLeft = Math.max(viewport.left, 0),
            viewportBottom = Math.min(viewport.bottom, window.innerHeight),
            viewportRight = Math.min(viewport.right, window.innerWidth),
            topOffset = rect.top - verticalMargin - viewportTop,
            bottomOffset = viewportBottom - rect.bottom - verticalMargin,
            leftOffset = rect.left - horizontalMargin - viewportLeft,
            rightOffset = viewportRight - rect.right - horizontalMargin;

        if (topOffset < 0) {
            scrollHost.scrollTop += topOffset;
        }
        if (bottomOffset < 0) {
            scrollHost.scrollTop -= bottomOffset;
        }
        if (leftOffset < 0) {
            scrollHost.scrollLeft += leftOffset;
        }
        if (rightOffset < 0) {
            scrollHost.scrollLeft -= rightOffset;
        }
    };
    
    function resolve (value) {
        if (typeof value === 'function') {
            return value();
        }

        return value;
    }

    self.hide = function () {
        self.element.style.display = 'none';
    };
    self.focus = function () {
        self.element.focus();
    };
    self.update = function (start, end) {
        var top = Math.min(start.offsetTop, end.offsetTop),
            left = Math.min(start.offsetLeft, end.offsetLeft),
            bottom = Math.max(start.offsetTop + start.offsetHeight,
                            end.offsetTop + end.offsetHeight),
            right = Math.max(start.offsetLeft + start.offsetWidth,
                            end.offsetLeft + end.offsetWidth);

        self.element.style.top = table.offsetTop + top + 1 + 'px';
        self.element.style.left = table.offsetLeft + left + 1 + 'px';
        self.element.style.height = bottom - top - 1 + 'px';
        self.element.style.width = right - left - 1 + 'px';
        self.element.style.backgroundColor = 'rgba(245, 142, 00, 0.15)';

        self.show();
    };
    self.beginDrag = function () {
        self.canDrag = true;
        self.element.addEventListener('mousemove', self.doBeginDrag);
    };
    self.doBeginDrag = function () {
        self.element.removeEventListener('mousemove', self.doBeginDrag);

        if (!self.canDrag) {
            return;
        }

        self.isDragging = true;
        self.element.style.pointerEvents = 'none';
    };
    self.endDrag = function () {
        self.element.removeEventListener('mousemove', self.doBeginDrag);
        self.isDragging = false;
        self.canDrag = false;
        self.element.style.pointerEvents = 'inherit';
    };

    self.onMouseUp = function (event) {
        self.endDrag();
    };
    self.onMouseDown = function (event) {
        if (event.button !== 0) {
            return;
        }

        self.hide();

        var cell = event.view.document.elementFromPoint(event.clientX, event.clientY);
        selection.onCellMouseDown(cell, event.shiftKey);

        event.preventDefault();
    };
    self.onDblClick = function (event) {
        selection.startLockedEditing();
    };
    self.onKeyPress = function (event) {
        selection.startEditing();
    };
    self.onKeyDown = function (event) {
        if (event.keyCode === 13) {
            selection.onReturn(event);
        } else if ([37, 38, 39, 40].indexOf(event.keyCode) !== -1) {
            selection.onArrows(event);
        } else if (event.keyCode === 86 && event.ctrlKey) {
            self.copyPasteElement.value = '';
            self.copyPasteElement.style.display = 'block';
            self.copyPasteElement.focus();
            setTimeout(function () {
                selection.onPaste(self.copyPasteElement.value);
                self.copyPasteElement.style.display = 'none';
                self.focus();
            }, 0);
        } else if (event.keyCode === 67 && event.ctrlKey) {
            self.copyPasteElement.value = selection.onCopy();
            self.copyPasteElement.style.display = 'block';
            self.copyPasteElement.focus();
            document.execCommand('selectAll', false, null);
            setTimeout(function () {
                self.copyPasteElement.style.display = 'none';
                self.focus();
            }, 0);
        } else if (event.keyCode === 9) {
            selection.onTab(event);
        } else if (event.keyCode === 46 || (event.keyCode === 8 && event.ctrlKey)) {
            // either DELETE key || CTRL + BACKSPACE
            var cell = selection.getRange().start;
            selection.updateCellValue(cell, null);
        }
    };
    self.onInputKeydown = function (event) {
        var cell = selection.getRange().start;

        if (event.keyCode === 13) { // Return
            var value = selection.endEditingCell(cell);

            if (event.ctrlKey) {
                selection.getCells().forEach(function (cellInSelection) {
                    if (cellInSelection !== cell) {
                        selection.updateCellValue(cellInSelection, value);
                    }
                });
            }

            selection.onReturn(event, event.ctrlKey);
            self.focus();
            event.preventDefault();
        }
        else if (event.keyCode === 27) { // Escape
            selection.cancelEditingCell(cell);
            self.focus();
        }
        else if ([37, 38, 39, 40].indexOf(event.keyCode) !== -1) { // Arrows
            if(!self.isLockedToCell) {
                self.focus();
                selection.onArrows(event);
                event.preventDefault();
            }
        }
    };
    function onInputBlur (event) {
        if (!selection.isEditingCell()) {
            return;
        }
        selection.endEditingCell(selection.getRange().start);
    }

    self.element.addEventListener("mousedown", self.onMouseDown);
    self.element.addEventListener("dblclick", self.onDblClick);
    self.element.addEventListener("keypress", self.onKeyPress);
    self.element.addEventListener("keydown", self.onKeyDown);

    self.inputElement.addEventListener("keydown", self.onInputKeydown);
    self.inputElement.addEventListener("blur", onInputBlur);

    html.addEventListener("mouseup", self.onMouseUp);
}
},{"./polyfill":11}]},{},[3])(3)
});